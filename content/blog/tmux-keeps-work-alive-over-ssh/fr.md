---
title: tmux garde le travail distant en vie quand SSH coupe
summary: Travaillez sur un serveur dans une session tmux nommée. Si la connexion tombe, le shell et les commandes en cours survivent, et tmux attach les récupère. Quelques raccourcis par défaut couvrent le quotidien.
description: Travaillez dans une session tmux nommée : si SSH coupe, le shell et ses commandes survivent et tmux attach les récupère. Et les raccourcis du quotidien.
---

## Le problème

Vous lancez une longue migration, une sauvegarde ou une mise à jour de paquets en SSH. Le Wi-Fi décroche, l’ordinateur se met en veille ou le VPN se reconnecte, et la session SSH se termine. La commande aussi : elle dépendait de votre shell de connexion, parti avec la connexion. Reste à deviner où elle en était.

## Pourquoi

Quand une connexion SSH se ferme, le shell de connexion distant reçoit un signal de raccrochage (`SIGHUP`) et se termine, et les tâches qu’il a lancées s’arrêtent normalement avec lui. Tout ce que vous exécutiez dépendait de cette seule connexion.

tmux coupe ce lien. Il fait tourner sur la machine distante un processus serveur qui possède vos shells. Votre session SSH n’exécute qu’un *client* tmux, qui affiche une session et lui transmet vos frappes. Quand la connexion tombe, le client disparaît, mais le serveur tmux, la session, ses shells et leurs commandes en cours continuent.

## La solution

Travaillez sur le serveur dans une session nommée, et rattachez-vous après une coupure :

```shell
tmux new -s deploy      # créer une session nommée
tmux attach -t deploy   # s'y rattacher après une coupure SSH
tmux ls                 # lister les sessions

# Raccourcis par défaut, tapés après le préfixe (Ctrl-b) :
#   d  se détacher             %  diviser gauche / droite
#   "  diviser haut / bas      z  agrandir le panneau courant
#   [  défiler (mode copie)    s  changer de session
#   :setw synchronize-panes on  -> taper dans tous les panneaux à la fois
```

Quelques remarques pour le quotidien :

- **Une commande pour les deux cas.** `tmux new -A -s deploy` se rattache à `deploy` si la session existe et la crée sinon : un alias tout trouvé.
- **Se détacher volontairement.** `Ctrl-b` puis `d` laisse tout tourner ; vous pouvez vous déconnecter et revenir plus tard, y compris depuis une autre machine.
- **Le défilement.** L’historique de votre terminal ne voit pas celui de tmux. `Ctrl-b` puis `[` ouvre le mode copie, où les flèches et Page précédente font défiler ; `q` en sort.
- **Plusieurs serveurs à la fois.** Dans une fenêtre divisée, `synchronize-panes` envoie les mêmes frappes à tous les panneaux. Désactivez-le avec `:setw synchronize-panes off`.
- **Un raccourci oublié ?** `Ctrl-b` puis `?` les liste tous.

## Les limites

tmux protège d’une connexion perdue, pas d’une machine perdue : un redémarrage du serveur arrête le serveur tmux et tout ce qu’il contient. Pour un travail qui doit y survivre, passez par un vrai service ou un planificateur de tâches.

## À retenir

Faites de `tmux new -A -s <nom>` le premier réflexe sur un serveur avant toute tâche longue. Une connexion perdue coûte alors un simple rattachement, pas une tâche à relancer.
