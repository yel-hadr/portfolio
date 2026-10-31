---
title: Loki veut des logs JSON et peu de labels
summary: Loki n’indexe que les labels : les champs à forte cardinalité, comme un identifiant de requête ou de tenant, vont dans la ligne de log. Avec un objet JSON par ligne, le parseur json de LogQL filtre dessus au moment de la requête.
description: Loki n’indexe que les labels : les identifiants à forte cardinalité vont dans la ligne de log, en JSON, que le parseur json de LogQL filtre à la requête.
---

## Le problème

Quand on vient d’un moteur de recherche plein texte, le réflexe avec Loki est de transformer chaque champ utile en label : le niveau, l’utilisateur, le tenant, l’identifiant de requête. Ça marche en démo. Avec du vrai trafic, l’ingestion ralentit, les requêtes deviennent plus lentes au lieu d’accélérer, et Loki commence à rejeter des flux une fois ses limites de flux atteintes.

## Pourquoi

Loki n’indexe **que les labels**, pas le contenu des lignes de log. Chaque combinaison unique de valeurs de labels forme un flux (stream) distinct, stocké dans ses propres chunks.

- Un label à peu de valeurs, comme `app`, `namespace` ou `environment`, crée quelques flux.
- Un label aux valeurs illimitées, comme un identifiant de requête ou de tenant, crée un nouveau flux pour presque chaque valeur. Résultat : une multitude de chunks minuscules, un index volumineux et plus de travail pour chaque requête.

C’est la forte cardinalité, et la conception de Loki demande de l’éviter dans les labels. Les labels décrivent *d’où* viennent les logs ; tout ce qui concerne *ce qui s’est passé* va dans la ligne.

## La solution

Gardez un petit ensemble fixe de labels, et écrivez chaque ligne de log sous la forme d’un objet JSON. Les champs restent hors de l’index, mais faciles à interroger. En Python, un petit formateur suffit :

```python
# Un objet JSON par ligne sur stdout ; Grafana Alloy l'envoie tel quel à Loki
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
            # Défini avec logger.info("...", extra={"tenant": schema_name})
            "tenant": getattr(record, "tenant", None),
        }
        if record.exc_info:
            entry["exc"] = self.formatException(record.exc_info)
        return json.dumps(entry, default=str)
```

Un collecteur comme Grafana Alloy lit stdout et envoie les lignes à Loki avec les quelques labels choisis. Alloy remplace Promtail, arrivé en fin de vie le 2 mars 2026.

## Interroger les champs

Le parseur `json` de LogQL extrait les champs de chaque ligne au moment de la requête, puis un filtre de labels garde les lignes qui correspondent :

```logql
{app="api"} | json | level="ERROR" | tenant="acme"
```

Deux habitudes gardent ces requêtes rapides :

- **Sélectionner les flux d’abord.** Le sélecteur de flux entre accolades est la seule partie qui utilise l’index : rendez-le aussi précis que les labels le permettent.
- **Filtrer les lignes avant de les parser.** Un filtre de ligne comme `|= "acme"` coûte peu et réduit le nombre de lignes que le parseur doit lire : `{app="api"} |= "acme" | json | tenant="acme"`.

Les objets imbriqués sont aplatis avec des tirets bas : `{"request": {"method": "GET"}}` devient `request_method`.

## À retenir

Dans Loki, les labels servent à aiguiller et à sélectionner les flux, pas à chercher. Gardez-les peu nombreux et bornés, mettez les détails dans des lignes JSON structurées, et laissez LogQL les parser au moment de la requête.
