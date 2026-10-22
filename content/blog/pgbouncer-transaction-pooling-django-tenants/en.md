---
title: PgBouncer transaction pooling breaks django-tenants
summary: django-tenants picks the tenant with a session-level SET search_path, which PgBouncer's transaction mode does not keep. Why queries can reach the wrong schema, and two fixes.
---

## The problem

[django-tenants](https://django-tenants.readthedocs.io/) gives each tenant its own PostgreSQL schema. To route queries, it runs `SET search_path` on the database connection when the active tenant changes, then lets every following query rely on that setting.

Put PgBouncer in front of PostgreSQL in **transaction** pooling mode and this assumption no longer holds. Queries can run against the wrong schema: another tenant's, or `public`. Nothing fails loudly, which is what makes it dangerous.

## Why it happens

`SET search_path` is session state: it stays on the PostgreSQL server connection that executed it, until that connection changes it again or closes.

In transaction mode, PgBouncer lends a server connection to a client only for the length of one transaction, then returns it to the pool. With Django's default autocommit, every query outside an explicit `atomic()` block is its own transaction. So:

1. Django sends `SET search_path = tenant_a, public`. PgBouncer runs it on server connection 1 and releases it.
2. Django sends `SELECT ... FROM orders`. PgBouncer picks whichever server connection is free, say connection 2, whose `search_path` is whatever the last client left there.
3. Connection 1 now carries `tenant_a`'s search path, ready to be lent to another client.

PgBouncer's documentation is explicit that session-level features such as `SET` are not supported in transaction pooling: the client simply does not keep the same server connection.

## The fix

Pick one of these for the tenant application:

- **Session pooling.** In session mode, a client keeps the same server connection until it disconnects, so the `SET` and the queries after it always share a connection. PgBouncer still caps the number of server connections; size the pool for the number of concurrent Django connections. `pool_mode` can also be set per database in the `[databases]` section if other apps on the same PgBouncer need transaction mode.
- **No PgBouncer for this app.** Connect Django straight to PostgreSQL and keep connections open between requests with `CONN_MAX_AGE`.

The PgBouncer side:

```ini
; pgbouncer.ini
[databases]
app = host=postgres port=5432 dbname=app

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
; django-tenants issues a session-level SET search_path:
; it must run on the same server connection as the queries
pool_mode = session
default_pool_size = 20
```

The Django side, when connecting directly:

```python
DATABASES = {
    "default": {
        "ENGINE": "django_tenants.postgresql_backend",
        "NAME": "app",
        "HOST": "postgres",
        "PORT": 5432,
        # Reuse each connection for up to 60 seconds instead of opening one per request
        "CONN_MAX_AGE": 60,
        # Check a reused connection before the request uses it (Django 4.1+)
        "CONN_HEALTH_CHECKS": True,
    }
}
```

## Takeaway

Before putting a transaction pooler in front of an application, look for anything it keeps in the session: `SET`, advisory locks, prepared statements, `LISTEN`. Schema-per-tenant libraries depend on exactly that kind of state.
