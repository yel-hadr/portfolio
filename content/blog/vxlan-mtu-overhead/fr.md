---
title: VXLAN retire 50 octets au MTU de chaque paquet
summary: VXLAN ajoute 50 octets d’en-têtes à chaque trame, 70 sur IPv6. Sur un underlay à 1500 octets, fixez le MTU de l’overlay à 1450 ou passez aux trames jumbo, sinon les gros transferts bloquent alors que les pings passent.
---

## Le problème

Un nouvel overlay VXLAN semble en bonne santé : les hôtes se pinguent et les connexions SSH fonctionnent. Puis une copie de fichier, un dump de base de données ou une grosse réponse HTTPS se fige en plein milieu, sans erreur d’un côté ni de l’autre. Les petits paquets passent ; ceux de taille maximale, non.

## Pourquoi

VXLAN transporte des trames Ethernet dans de l’UDP. Chaque trame de l’overlay est enveloppée dans de nouveaux en-têtes avant de traverser l’underlay :

| En-tête | Octets |
| --- | --- |
| IPv4 externe | 20 |
| UDP externe | 8 |
| VXLAN | 8 |
| Ethernet interne (l’en-tête de la trame d’origine) | 14 |
| **Total** | **50** |

L’en-tête Ethernet interne compte, car pour l’underlay il fait désormais partie de la charge utile. Sur un underlay IPv6, l’en-tête IP externe fait 40 octets, et le total passe à 70.

Le MTU d’une interface limite la taille du paquet IP : sur un underlay standard à 1500 octets, le paquet IP interne ne peut donc pas dépasser 1500 - 50 = 1450 octets. Si l’interface de l’overlay annonce toujours 1500, les paquets de taille maximale ne tiennent plus une fois encapsulés. Ils sont rejetés ou fragmentés, et quand les messages ICMP dont dépend la découverte du MTU du chemin ne reviennent pas, les connexions TCP se bloquent dès qu’elles envoient des segments pleins. Voilà pourquoi les pings et les petites requêtes passent alors que les gros transferts restent bloqués.

Que les points de terminaison du tunnel se découvrent par inondation ou par un plan de contrôle BGP EVPN n’y change rien : l’encapsulation du plan de données, et son surcoût, restent les mêmes.

## La solution

Au choix :

- **Baisser le MTU de l’overlay** au MTU de l’underlay moins le surcoût : 1450 sur un underlay IPv4 à 1500 octets, 1430 sur IPv6.
- **Augmenter le MTU de l’underlay** avec les trames jumbo (toute valeur d’au moins 1550, souvent 9000) sur chaque lien et chaque switch du chemin, pour que l’overlay puisse garder 1500.

Fixez le MTU de l’overlay explicitement plutôt que de vous fier à une valeur par défaut, puis testez le chemin avec le bit Don’t Fragment :

```shell
# Underlay à 1500 octets - 50 octets d'encapsulation :
# IPv4 externe (20) + UDP (8) + VXLAN (8) + Ethernet interne (14)
ip link add vxlan100 type vxlan id 100 dstport 4789 local 10.0.0.1 nolearning
ip link set vxlan100 mtu 1450 up

# Vérifier le chemin sans fragmentation : 1422 + ICMP (8) + IPv4 (20) = 1450
ping -M do -s 1422 10.200.0.2
```

Si ce ping réussit, un paquet de taille maximale de l’overlay traverse bien le tunnel. Avec `-s 1423`, ping signale une erreur : le paquet de 1451 octets dépasse le MTU de 1450 de l’interface. Pour vérifier l’underlay lui-même, pinguez le point de terminaison distant du tunnel avec `-M do -s 1472` (1472 + 8 + 20 = 1500).

## À retenir

Chaque tunnel consomme de la marge. Quand les gros transferts bloquent alors que les pings passent, comparez le MTU de l’overlay au MTU de l’underlay moins le surcoût d’encapsulation avant de chercher ailleurs. Les overlays construits sur VXLAN, comme certains plugins réseau de Kubernetes, ont la même limite.
