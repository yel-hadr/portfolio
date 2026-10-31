---
title: Argo CD automated sync neither prunes nor self-heals by default
summary: Automated sync applies new commits, but it keeps resources deleted from Git and ignores manual changes in the cluster. The prune and selfHeal options close those two gaps.
---

## The problem

You turn on automated sync for an Argo CD Application and expect the cluster to mirror Git from then on. Two things still surprise people:

- A Deployment you deleted from the repository keeps running in the cluster.
- Someone runs `kubectl scale` or `kubectl edit` by hand, and the change stays.

In both cases the Application shows as **OutOfSync**, yet Argo CD does nothing about it.

## Why it happens

Automated sync, on its own, reacts to changes in Git: when the desired state at the target revision changes, Argo CD applies it. Its defaults are deliberately cautious:

- **No pruning.** When a resource disappears from Git, automated sync does not delete it from the cluster. Deleting workloads automatically is considered too risky to be the default.
- **No self-healing.** Changes made directly to the live cluster do not trigger an automated sync. Argo CD reports the drift but leaves it in place.

## The fix

Turn each behavior on explicitly in the Application's `syncPolicy`:

- `prune: true` deletes resources that Git no longer declares.
- `selfHeal: true` syncs again when the live state drifts from Git, which reverts manual changes.

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
      prune: true     # delete resources removed from Git
      selfHeal: true  # revert changes made directly in the cluster
    syncOptions:
      - CreateNamespace=true
```

The same settings from the CLI:

```shell
argocd app set api --sync-policy automated --auto-prune --self-heal
```

## Safety nets worth knowing

Pruning means a mistake in Git, such as a wrong `path`, now deletes things. Argo CD has a few guards:

- `allowEmpty` defaults to `false`: with pruning on, automated sync refuses to delete every resource of an Application because its source suddenly renders nothing.
- A single resource can opt out of pruning with the annotation `argocd.argoproj.io/sync-options: Prune=false`.
- Self-healing also reverts emergency fixes made with `kubectl`. During an incident, make the change in Git, or pause automated sync first.

## Takeaway

"Automated" in Argo CD means "apply Git automatically", not "make the cluster equal to Git". If you want Git to be the only source of truth, set `prune` and `selfHeal` on purpose and review what they will delete or revert.
