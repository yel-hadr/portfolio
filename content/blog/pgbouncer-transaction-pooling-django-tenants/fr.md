---
title: Le pooling par transaction de PgBouncer casse django-tenants
summary: django-tenants choisit le tenant avec un SET search_path de session, que le mode transaction de PgBouncer ne conserve pas. Pourquoi des requêtes visent le mauvais schéma, et deux solutions.
---

## Le problème

[django-tenants](https://django-tenants.readthedocs.io/) donne à chaque tenant son propre schéma PostgreSQL. Pour aiguiller les requêtes, il exécute `SET search_path` sur la connexion à la base quand le tenant actif change, puis laisse toutes les requêtes suivantes s’appuyer sur ce réglage.

Placez PgBouncer devant PostgreSQL en mode de pooling **par transaction** et cette hypothèse ne tient plus. Des requêtes peuvent viser le mauvais schéma : celui d’un autre tenant, ou `public`. Rien n’échoue bruyamment, et c’est bien ce qui rend le problème dangereux.

## Pourquoi

`SET search_path` modifie l’état de la session : le réglage reste sur la connexion serveur PostgreSQL qui l’a exécuté, jusqu’à ce qu’elle le change à nouveau ou se ferme.

En mode transaction, PgBouncer ne prête une connexion serveur à un client que le temps d’une transaction, puis la rend au pool. Avec l’autocommit par défaut de Django, chaque requête exécutée hors d’un bloc `atomic()` explicite forme sa propre transaction. Donc :

1. Django envoie `SET search_path = tenant_a, public`. PgBouncer l’exécute sur la connexion serveur 1, puis la libère.
2. Django envoie `SELECT ... FROM orders`. PgBouncer prend la première connexion serveur libre, disons la 2, dont le `search_path` est celui que le dernier client y a laissé.
3. La connexion 1 porte désormais le search path de `tenant_a`, prête à être prêtée à un autre client.

La documentation de PgBouncer le dit clairement : les fonctionnalités liées à la session, comme `SET`, ne sont pas prises en charge en pooling par transaction, tout simplement parce que le client ne garde pas la même connexion serveur.

## La solution

Choisissez l’une de ces options pour l’application multi-tenant :

- **Le pooling par session.** En mode session, un client garde la même connexion serveur jusqu’à sa déconnexion : le `SET` et les requêtes qui le suivent partagent donc toujours la même connexion. PgBouncer plafonne toujours le nombre de connexions serveur ; dimensionnez le pool selon le nombre de connexions Django simultanées. `pool_mode` peut aussi se régler par base dans la section `[databases]`, si d’autres applications du même PgBouncer ont besoin du mode transaction.
- **Pas de PgBouncer pour cette application.** Connectez Django directement à PostgreSQL et gardez les connexions ouvertes entre les requêtes avec `CONN_MAX_AGE`.

Côté PgBouncer :

```ini
; pgbouncer.ini
[databases]
app = host=postgres port=5432 dbname=app

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
; django-tenants exécute un SET search_path au niveau de la session :
; il doit passer par la même connexion serveur que les requêtes
pool_mode = session
default_pool_size = 20
```

Côté Django, en connexion directe :

```python
DATABASES = {
    "default": {
        "ENGINE": "django_tenants.postgresql_backend",
        "NAME": "app",
        "HOST": "postgres",
        "PORT": 5432,
        # Réutiliser chaque connexion jusqu'à 60 secondes au lieu d'en ouvrir une par requête
        "CONN_MAX_AGE": 60,
        # Vérifier une connexion réutilisée avant que la requête s'en serve (Django 4.1+)
        "CONN_HEALTH_CHECKS": True,
    }
}
```

## À retenir

Avant de placer un pooler par transaction devant une application, cherchez tout ce qu’elle garde dans la session : `SET`, verrous consultatifs (advisory locks), requêtes préparées, `LISTEN`. Les bibliothèques à un schéma par tenant reposent précisément sur ce type d’état.
