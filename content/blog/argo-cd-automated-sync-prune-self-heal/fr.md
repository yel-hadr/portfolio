---
title: La synchronisation automatique d’Argo CD ne nettoie ni ne corrige rien par défaut
summary: La synchronisation automatique applique les nouveaux commits, mais garde les ressources supprimées de Git et ignore les modifications manuelles du cluster. Les options prune et selfHeal comblent ces deux manques.
---

## Le problème

Vous activez la synchronisation automatique d’une Application Argo CD et vous attendez à ce que le cluster reflète Git désormais. Deux choses surprennent pourtant souvent :

- Un Deployment supprimé du dépôt continue de tourner dans le cluster.
- Quelqu’un lance `kubectl scale` ou `kubectl edit` à la main, et la modification reste.

Dans les deux cas, l’Application apparaît **OutOfSync**, et Argo CD ne fait rien.

## Pourquoi

La synchronisation automatique, seule, réagit aux changements dans Git : quand l’état souhaité à la révision cible change, Argo CD l’applique. Ses valeurs par défaut sont volontairement prudentes :

- **Pas de nettoyage (prune).** Quand une ressource disparaît de Git, la synchronisation automatique ne la supprime pas du cluster. Supprimer des charges de travail automatiquement est jugé trop risqué pour être le comportement par défaut.
- **Pas d’autoréparation (self-heal).** Les modifications faites directement sur le cluster ne déclenchent pas de synchronisation automatique. Argo CD signale la dérive, mais la laisse en place.

## La solution

Activez chaque comportement explicitement dans le `syncPolicy` de l’Application :

- `prune: true` supprime les ressources que Git ne déclare plus.
- `selfHeal: true` resynchronise dès que l’état réel s’écarte de Git, ce qui annule les modifications manuelles.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: api
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/example/deploy.git
    targetRevision: main
    path: apps/api
  destination:
    server: https://kubernetes.default.svc
    namespace: api
  syncPolicy:
    automated:
      prune: true     # supprimer les ressources retirées de Git
      selfHeal: true  # annuler les modifications faites directement dans le cluster
    syncOptions:
      - CreateNamespace=true
```

Les mêmes réglages en ligne de commande :

```shell
argocd app set api --sync-policy automated --auto-prune --self-heal
```

## Les garde-fous à connaître

Avec le nettoyage, une erreur dans Git, comme un mauvais `path`, supprime désormais des ressources. Argo CD prévoit quelques protections :

- `allowEmpty` vaut `false` par défaut : avec le nettoyage activé, la synchronisation automatique refuse de supprimer toutes les ressources d’une Application parce que sa source ne produit soudain plus rien.
- Une ressource peut échapper au nettoyage avec l’annotation `argocd.argoproj.io/sync-options: Prune=false`.
- L’autoréparation annule aussi les correctifs d’urgence faits avec `kubectl`. Pendant un incident, faites la modification dans Git, ou mettez d’abord la synchronisation automatique en pause.

## À retenir

Dans Argo CD, « automatique » veut dire « appliquer Git automatiquement », pas « rendre le cluster identique à Git ». Si Git doit être l’unique source de vérité, activez `prune` et `selfHeal` en connaissance de cause et vérifiez ce qu’ils vont supprimer ou annuler.
