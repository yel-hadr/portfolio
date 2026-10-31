---
title: Du C au WebGL : le raycasting DDA de Wolfenstein 3D
summary: Comment mon cub3D de 42 lance un rayon par colonne d’écran à travers une grille en C, analyse et valide les cartes .cub, et comment ces idées portent un jeu React Three Fiber sur ce site.
description: cub3D lance un rayon par colonne d’écran en C et valide ses cartes .cub par remplissage ; collisions, portes et vue à la souris passent ensuite au WebGL.
---

## Le sujet

Le sujet cub3D de 42 s’ouvre sur Wolfenstein 3D : développé par id Software sous la direction de John Carmack et John Romero, publié en 1992, et présenté comme « le premier vrai jeu de tir à la première personne ». Le but est d’en refaire le principe en C : une vue 3D « réaliste » de l’intérieur d’un labyrinthe, dessinée par ray-casting, avec la MiniLibX (j’ai utilisé MLX42, la version de Codam). Les fonctions autorisées tiennent en une courte liste (`open`, `read`, `malloc`, `free`, la bibliothèque mathématique, la bibliothèque graphique et quelques autres) : tout le reste s’écrit à la main.

Cet article reprend les maths, l’analyseur de cartes et les bonus de ma version en C ([cub3D_42 sur GitHub](https://github.com/yel-hadr/cub3D_42)), puis montre comment ces mêmes idées sont devenues la démo en direct et le Game Mode de ce site, en React Three Fiber.

![La démo cub3D en direct : la carte map.cub du dépôt, une texture différente sur chaque face de mur, et les rayons de la mini-carte en haut à droite](/blog-media/cub3d-raycasting-from-c-to-webgl/cub3d-demo.webp "La démo en direct, construite à partir de maps/map.cub du dépôt. Lancez-la depuis la carte cub3D de la page d’accueil.")

[Lancer la démo cub3D en direct](/?demo=cub3d)

## Une grille 2D, vue de l’intérieur

Une carte `.cub` est une grille : `1` est un mur, `0` du sol. Le monde n’a jamais d’étage ni de pente : une vue 3D n’a donc besoin que d’un nombre par colonne d’écran, la distance du mur le plus proche dans cette direction.

Ma version en C compte 64 unités par case (`BLOCK`), dans une fenêtre de 1600 × 900, avec un champ de vision de 60°. Pour chacune des 1600 colonnes, elle lance un rayon, en partant de l’angle de vue moins 30° et en tournant de 60/1600 de degré par colonne :

```c
ray_angle = normalize_angle(data->camera.angle - DEGRE * FOV_ANGLE / 2);
ray = 0;
while (ray < WINDOW_WIDTH)
{
	ray_cast = cast_ray(data, ray_angle);
	if (ray_cast.wall != NO_WALL)
		ft_3d_projection(data, ray_cast, ray);
	ray_angle += (double)DEGRE * (double)FOV_ANGLE / (double)WINDOW_WIDTH;
	ray_angle = normalize_angle(ray_angle);
	ray++;
}
```

## Traverser la grille : le DDA

La méthode naïve avance le long du rayon par petits pas et teste chaque point. Elle est lente, et un pas trop long saute le coin d’un mur. Un analyseur différentiel numérique (DDA) ne teste que les points où le rayon croise une ligne de la grille, car un mur ne peut commencer que là. Entre deux lignes horizontales, le rayon avance toujours d’exactement une case (64 unités) en y et de 64 / tan(θ) en x. Après la première intersection, chaque suivante n’est donc qu’une addition constante.

Ma version en C fait ce parcours deux fois par rayon, une fois sur les lignes horizontales et une fois sur les verticales, et garde l’impact le plus proche. Le gagnant dit aussi quelle face a été touchée : un impact horizontal est une face nord ou sud, un impact vertical une face est ou ouest. C’est ainsi que les quatre textures du sujet (NO, SO, WE, EA) sont choisies. Version condensée de `h_v_check.c` :

```c
/* La première ligne horizontale croisée par le rayon, puis une case par pas */
ray.yintercept = floor(player_y / BLOCK) * BLOCK;
if (ray.north_south == SOUTH)
	ray.yintercept += BLOCK;
ray.xintercept = player_x + (ray.yintercept - player_y) / tan(ray_angle);
ray.ystep = (ray.north_south == NORTH) ? -BLOCK : BLOCK;
ray.xstep = BLOCK / tan(ray_angle);   /* son signe suit l'est ou l'ouest du rayon */
while (inside_the_map(ray.next_x, ray.next_y))
{
	/* vers le nord, on regarde la case au-dessus de la ligne, pas en dessous */
	if (ft_haswallat(data, ray.next_x, ray.next_y - (ray.north_south == NORTH), &ray))
		break ;
	ray.next_x += ray.xstep;
	ray.next_y += ray.ystep;
}
```

Chaque rayon visite au plus une case par ligne de grille croisée : son coût est borné par la taille de la carte, O(largeur + hauteur), et non par la finesse d’un échantillonnage.

Le même parcours peut tenir dans une seule boucle, la version qu’on attribue d’ordinaire au tutoriel de raycasting de Lode Vandevenne. `deltaX` est la distance parcourue par le rayon entre deux lignes verticales (|1 / dx| pour une direction unitaire), et la boucle avance toujours l’intersection la plus proche. La version web l’utilise pour les rayons de la mini-carte et pour la visée :

```js
const deltaX = Math.abs(1 / dx);
const deltaZ = Math.abs(1 / dz);
let sideX = dx === 0 ? Infinity : (dx < 0 ? x - cx : cx + 1 - x) * deltaX;
let sideZ = dz === 0 ? Infinity : (dz < 0 ? z - cz : cz + 1 - z) * deltaZ;
let dist = 0;
for (let i = 0; i < 64; i += 1) {
  if (sideX < sideZ) {
    dist = sideX;
    sideX += deltaX;
    cx += stepX;
  } else {
    dist = sideZ;
    sideZ += deltaZ;
    cz += stepZ;
  }
  if (solid(cx, cz)) break;
}
```

## D’une distance à un mur à l’écran

Deux détails transforment une distance en mur crédible.

**L’effet fish-eye.** Les rayons des bords de l’écran parcourent plus de chemin que celui du milieu pour atteindre le même mur plat : avec la distance euclidienne, les murs droits se bombent. La correction ne garde que la part de la distance dans l’axe de la vue : on la multiplie par le cosinus de l’angle entre le rayon et la vue.

**Le plan de projection.** L’écran est un plan à une distance d de l’œil, choisie pour que le champ de 60° remplisse ses 1600 colonnes : d = (1600 / 2) / tan(30°) ≈ 1385,6. Une tranche de mur de hauteur 64 à une distance D mesure alors 64 / D × d pixels à l’écran.

```c
ray->distance = distance(player_x, player_y, ray->next_x, ray->next_y);
ray->distance *= cos(normalize_angle(angle - data->camera.angle));  /* pas de fish-eye */

data->distance_proj_plane = (WINDOW_WIDTH / 2) / tan(FOV_ANGLE / 2 * DEGRE);
ray.wall_strip_height = (BLOCK / ray.distance) * data->distance_proj_plane;
ray.wall_top = (WINDOW_HEIGHT / 2) - (ray.wall_strip_height / 2);
```

Un mur à deux cases droit devant (128 unités) mesure 64 / 128 × 1385,6 ≈ 693 pixels, les trois quarts de la fenêtre. La colonne de texture vient du point d’impact dans la case : `hit_y % 64` sur un mur vertical, `hit_x % 64` sur un mur horizontal. Puis chaque pixel de la colonne est écrit à la main : la couleur du plafond, les texels du mur, la couleur du sol. Cela fait 1,44 million d’appels à `mlx_put_pixel` par image, tous sur le CPU.

## Analyser un .cub, strictement

Le sujet est précis sur le fichier :

- Six éléments, dans n’importe quel ordre, séparés par autant de lignes vides qu’on veut : `NO`, `SO`, `WE` et `EA` avec le chemin d’une texture, puis `F` et `C` avec une couleur R,G,B, chaque canal dans [0, 255].
- La carte vient en dernier et n’utilise que `0`, `1` et un seul `N`, `S`, `E` ou `W` pour la position et l’orientation de départ. Les espaces font partie de la carte.
- La carte doit être fermée, entourée de murs.
- À la moindre erreur de configuration, le programme doit quitter proprement et afficher `Error` suivi d’un message explicite.

Mon analyseur lit tout le fichier avec `get_next_line`, puis le vérifie dans l’ordre où les erreurs peuvent survenir :

1. **Les identifiants.** Chaque ligne non vide avant la carte doit commencer par l’un des six identifiants et avoir exactement deux champs. Une texture déjà définie, ou une couleur donnée deux fois, est une erreur : un doublon ne peut pas l’emporter en silence.
2. **Les couleurs.** `F` et `C` sont découpées sur les virgules : exactement trois parties, uniquement des chiffres, aucune au-dessus de 255. Les trois canaux sont regroupés en une valeur RGBA une seule fois, au chargement.
3. **Les textures.** Chaque chemin est ouvert une fois pour prouver qu’il existe avant que MLX tente de le charger.
4. **Le joueur.** Exactement un `N`, `S`, `E` ou `W` : un second est une erreur, aucun aussi. La lettre fixe l’angle de départ. L’axe y descend à l’écran, donc le nord vaut 3π/2.
5. **La carte fermée.** Un remplissage depuis le joueur à travers toutes les cases qui ne sont pas des murs. S’il atteint la première ou la dernière ligne ou colonne, le joueur pourrait sortir du monde, et la carte est refusée.

```c
head = ft_lstnew(player_x / BLOCK, player_y / BLOCK);
curr = head;
while (curr)
{
	if (curr->x == 0 || curr->y == 0 || curr->x == data->map.map_width - 1
		|| curr->y == data->map.map_height - 1)
		exit(printf(MAPSTRTERR));
	if (valid_coords(data, curr->x + 1, curr->y, head))
		ft_lstadd_back(&head, ft_lstnew(curr->x + 1, curr->y));
	/* ... de même pour les trois autres voisins ... */
	curr = curr->next;
}
ft_lstclear(&head);
```

Les espaces dans la carte deviennent du sol avant le remplissage, et les lignes courtes sont complétées. Une brèche dans un mur, même cachée derrière un espace, est donc trouvée. Ce contrôle est un parcours en largeur : la liste chaînée lui sert de file, et chaque case visitée y reste.

Une chose que je changerais aujourd’hui : `valid_coords` vérifie si une case a déjà été visitée en parcourant cette liste, ce qui rend le remplissage O(n²) en nombre de cases. C’est invisible sur une carte de quelques centaines de cases. L’analyseur web garde plutôt un `Uint8Array` d’un octet par case, ce qui rend le même remplissage O(n).

## Les bonus, en C et dans le navigateur

La liste des bonus du sujet : collisions avec les murs, mini-carte, portes qui s’ouvrent et se ferment, sprites animés, et rotation de la vue à la souris. Voici chacun en C et dans le Game Mode de ce site, un monde cub3D plein écran écrit en React Three Fiber.

![Le Game Mode de ce site : un terminal mural dans la salle About, le radar en haut à droite avec les portes, les menaces et le cône de vision du joueur, et la liste de mission à gauche](/blog-media/cub3d-raycasting-from-c-to-webgl/game-mode.webp "Le Game Mode : la même grille, le même format de carte et les mêmes règles, rendus par le GPU. Ouvrez-le avec le bouton Mode Jeu de la page d’accueil.")

**Collisions avec les murs.** En C, un déplacement n’est permis que si le point d’arrivée n’est pas dans un mur, ni un point quatre pas plus loin sur chaque axe : cette marge empêche la caméra de toucher un mur. Sur le web, le joueur est un petit carré (0,2 case de son centre à son bord) testé par ses quatre coins. Chaque axe est testé séparément : marcher en biais contre un mur fait glisser le long de celui-ci au lieu de s’arrêter net.

```js
const free = (x, z) =>
  !blocked(x - RADIUS, z - RADIUS) &&
  !blocked(x + RADIUS, z - RADIUS) &&
  !blocked(x - RADIUS, z + RADIUS) &&
  !blocked(x + RADIUS, z + RADIUS) &&
  !onProp(x, z);

if (free(eye.position.x + dx, eye.position.z)) eye.position.x += dx;
if (free(eye.position.x, eye.position.z + dz)) eye.position.z += dz;
```

Les collisions sont des tests sur la grille, pas des rayons. Les rayons servent à voir et, dans le Game Mode, à viser : une cible ne compte comme touchée que si elle est plus proche que le mur atteint par le rayon central, avec le DDA ci-dessus.

**Mini-carte.** En C, c’est une seconde image MLX, redessinée pixel par pixel à chaque image par-dessus la vue 3D. Dans la démo web, c’est un canvas 2D au-dessus de la vue WebGL, dont les rayons sont lancés par le DDA. Le radar du Game Mode dessine toute la carte à partir d’une couche de murs mise en cache, puis y ajoute à chaque image les portes, les menaces et le cône de vision du joueur.

**Portes.** En C, un `D` dans la carte est une porte. Espace bascule la case devant le joueur entre `D` (fermée : dessinée avec une texture de porte, elle arrête les rayons et le joueur) et `O` (ouverte). Dans le Game Mode, les cases de porte sont relevées pendant l’analyse de la carte, et leur état tient en une entrée par case dans une ref. Le test de collision le lit :

```js
const solid = (cx, cz) => !isFloor(cx, cz) || doors.current[cz * W + cx] === true;
```

Les portes sont dessinées par un seul maillage instancié, dont les deux moitiés glissent dans les murs à l’ouverture, ou basculent d’un coup quand les animations sont réduites.

**Vue à la souris.** En C, MLX masque le curseur et un gestionnaire de curseur fait tourner la vue. Dans le navigateur, l’API Pointer Lock donne le mouvement brut de la souris. Chaque mouvement s’ajoute à une rotation en attente, que la caméra parcourt à chaque image, avec un peu d’inertie (immédiate quand les animations sont réduites).

**Sprites animés.** En C, c’est l’arme : quatre images (au repos, le tir, deux de recul) qui défilent après un tir. Dans le Game Mode, les armes sont des modèles 3D low-poly avec recul, balancement et oscillation, tous supprimés quand les animations sont réduites.

## Ce qui change entre le C et le WebGL

| Aspect | C avec MLX42 | React Three Fiber |
| --- | --- | --- |
| Murs | Un rayon par colonne, chaque pixel écrit par `mlx_put_pixel` sur le CPU | Les faces des murs en géométrie instanciée, rastérisée par le GPU ; le tampon de profondeur fait ce que faisait le test de l’impact le plus proche |
| Projection | d = (L / 2) / tan(30°), à partir d’un champ horizontal de 60° | Une caméra perspective, qui prend un champ vertical déduit des mêmes 60° |
| Boucle d’affichage | La boucle MLX redessine toute la fenêtre à chaque tour | Les images sont dessinées à la demande, seulement quand quelque chose change ; en continu seulement pendant la partie |
| État | Une structure `t_data` passée à chaque gestionnaire | Des refs pour ce qui change à chaque image (position, portes), l’état React seulement pour ce que l’interface affiche |
| Mémoire | `malloc` et `free`, `mlx_delete_texture` | Tampons et textures GPU libérés avec `dispose()` ; un seul contexte WebGL à la fois sur la page |

La version web ne lance pas un rayon par colonne, et c’est un choix : le GPU résout déjà la visibilité de chaque pixel avec son tampon de profondeur. Lancer 1600 rayons en JavaScript, peindre le résultat dans une texture et l’envoyer au GPU à chaque image ferait son travail plus lentement. Ce qui reste, c’est tout ce qui entoure le dessin : la grille, l’analyseur `.cub` et son remplissage, le DDA pour les lignes de vue, et les collisions sur les cases.

La seule formule à traduire est le champ de vision. Les caméras three.js prennent un angle vertical, et les 60° du sujet sont horizontaux : on les convertit selon le format de la fenêtre.

```js
const aspect = size.width / Math.max(size.height, 1);
eye.fov = (2 * Math.atan(Math.tan((FOV * Math.PI) / 360) / aspect) * 180) / Math.PI;
```

L’autre changement est la mémoire. En C, une texture vit jusqu’à `mlx_delete_texture`. En WebGL, une géométrie ou une texture créée à la main garde sa mémoire GPU jusqu’à l’appel de `dispose()`, quoi que fasse le ramasse-miettes de JavaScript. Un navigateur n’autorise aussi que quelques contextes WebGL actifs à la fois : la page n’en garde qu’un, libère le sien avant qu’une démo ou le Game Mode crée le leur, et le récupère à leur fermeture.

## À retenir

- Le raycasting est un problème en 2D : la grille et une distance par colonne forment tout le modèle du monde.
- Le DDA est rapide parce qu’il ne visite que les lignes de la grille : chaque rayon coûte la taille de la carte, pas la distance.
- Un analyseur strict vérifie dans l’ordre où les erreurs surviennent, et un remplissage est le vrai test d’une carte fermée.
- Passer au GPU change la façon de dessiner les pixels, pas le modèle : la grille, l’analyseur, le DDA et les collisions ont suivi presque ligne pour ligne.
