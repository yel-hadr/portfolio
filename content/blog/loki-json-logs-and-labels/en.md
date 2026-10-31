---
title: Loki wants JSON log lines and few labels
summary: Loki indexes labels only, so high-cardinality fields such as request or tenant IDs belong in the log line. With one JSON object per line, LogQL's json parser filters on them at query time.
description: Loki indexes only labels, so high-cardinality IDs belong in the log line. With one JSON object per line, LogQL’s json parser filters on them at query time.
---

## The problem

Coming from a full-text search engine, the natural move with Loki is to turn every useful field into a label: the level, the user, the tenant, the request ID. It works in a demo. With real traffic, ingestion slows down, queries get slower instead of faster, and Loki starts rejecting streams once it hits its stream limits.

## Why it happens

Loki indexes **labels only**, not the content of log lines. Each unique combination of label values is a separate stream, stored in its own chunks.

- A label with a few values, such as `app`, `namespace` or `environment`, creates a few streams.
- A label with unbounded values, such as a request ID or a tenant ID, creates a new stream for almost every value. That means many tiny chunks, a large index and more work for every query.

This is high cardinality, and Loki's design asks you to avoid it in labels. Labels should describe *where* logs come from; everything about *what happened* belongs in the line.

## The fix

Keep a small, fixed set of labels, and write each log line as one JSON object. Fields stay out of the index but remain easy to query. In Python, a small formatter is enough:

```python
# One JSON object per line on stdout; Grafana Alloy ships it to Loki as is
import json
import logging
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    def format(self, record):
        entry = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            # Set with logger.info("...", extra={"tenant": schema_name})
            "tenant": getattr(record, "tenant", None),
        }
        if record.exc_info:
            entry["exc"] = self.formatException(record.exc_info)
        return json.dumps(entry, default=str)
```

A collector such as Grafana Alloy reads stdout and pushes the lines to Loki with the few labels you chose. Alloy replaces Promtail, which reached end of life on 2 March 2026.

## Querying the fields

LogQL's `json` parser extracts the fields of each line at query time, and a label filter then keeps the matching lines:

```logql
{app="api"} | json | level="ERROR" | tenant="acme"
```

Two habits keep these queries fast:

- **Select streams first.** The stream selector in braces is the only part that uses the index, so make it as narrow as the labels allow.
- **Filter lines before parsing.** A line filter such as `|= "acme"` is cheap and cuts down the lines the parser has to read: `{app="api"} |= "acme" | json | tenant="acme"`.

Nested objects are flattened with underscores: `{"request": {"method": "GET"}}` becomes `request_method`.

## Takeaway

In Loki, labels are for routing and selecting streams, not for searching. Keep them few and bounded, put the details in structured JSON lines, and let LogQL parse them when you query.
