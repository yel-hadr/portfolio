---
title: Fractales 500×500 : projection isométrique et mémoire
summary: Comment mon FdF de 42 projette une carte de hauteurs en fil de fer isométrique 2:1 en C, avec des lignes de Bresenham, et pourquoi changer de carte 500×500 en WebGL exige la rigueur de free().
description: FdF en C et en WebGL : la projection isométrique d’un fil de fer 2:1, les lignes de Bresenham, et pourquoi dispose() est au WebGL ce que free() est au C.
---

## Le sujet

FdF (« fil de fer ») est le premier projet graphique de 42. Le sujet demande « une représentation simple en fil de fer d’un paysage 3D, en reliant des points (x, y, z) par des segments », lue dans un fichier `.fdf`, et pose la seule contrainte forte sur l’image : le programme doit représenter le modèle en projection isométrique.

Les règles autour façonnent le code autant que les maths : les images de la MiniLibX sont obligatoires, Échap et le bouton de fermeture doivent quitter proprement, les variables globales sont interdites et, comme dans tout projet de 42, toute la mémoire allouée sur le tas doit être libérée : les fuites de mémoire ne sont pas tolérées.

Cet article reprend la projection, le tracé des lignes et les règles de mémoire de ma version en C ([my_fdf_42 sur GitHub](https://github.com/yel-hadr/my_fdf_42)), puis la visionneuse en direct de ce site, qui dessine en WebGL six cartes de test du dépôt, dont deux fractales de 500 × 500.

![julia.fdf dans la visionneuse avec les couleurs du fichier : un plan rouge sombre et des pics blancs en forme d’ensemble de Julia, avec un relevé de 250 000 sommets et 499 000 arêtes](/blog-media/fdf-isometric-projection-and-memory/julia-file-colors.webp "julia.fdf, dessinée avec les couleurs écrites dans le fichier : 250 000 points reliés par 499 000 arêtes.")

[Lancer la visionneuse FdF en direct](/?demo=fdf)

## Le fichier est la grille

Un fichier `.fdf` est une carte de hauteurs. Chaque ligne est une rangée (y), chaque nombre une colonne (x), et le nombre lui-même est l’altitude (z). Un point peut porter sa propre couleur après une virgule :

```text
0  0  0  0  0
0 10 10 10  0
0 10,0xFF0000 10  0  0
```

Le sujet précise que le but du projet n’est pas d’analyser des cartes, et laisse le programme supposer un fichier bien formé. Le mien lit tout de même chaque fichier deux fois. La première passe compte les rangées, vérifie qu’elles ont toutes le même nombre de colonnes (sinon elle s’arrête sur `MAP_ERROR`) et trouve l’altitude la plus basse et la plus haute. La seconde lit les valeurs et les couleurs. Une couleur, ce sont les chiffres hexadécimaux après `0x`, et un point sans couleur est blanc (`0xFFFFFF`).

La visionneuse web fait ce travail à la construction du site. Un script Node transforme chaque `.fdf` en JSON. Dans ces cartes, les couleurs suivent l’altitude : elles sont donc stockées comme une table de l’altitude vers la couleur, et le script s’arrête sur un fichier qui donnerait deux couleurs à une même altitude plutôt que d’en perdre une. Les deux cartes de 500 × 500 ne sont téléchargées que si on les choisit, et leurs altitudes vont dans un `Int16Array` : 2 octets par point au lieu des 8 des nombres d’un tableau ordinaire.

```js
const width = Math.min(...rows.map((row) => row.length));
// 16-bit: every altitude in these maps fits, in a quarter of a plain array's memory
const z = Int16Array.from(rows.flatMap((row) => row.slice(0, width)));
let min = Infinity;
let max = -Infinity;
z.forEach((value) => {
  if (value < min) min = value;
  if (value > max) max = value;
});
```

La boucle a une raison d’être : `Math.min(...z)` passerait un quart de million d’arguments et ferait déborder la pile d’appels.

## La projection, sous forme de matrice

Une vue isométrique regarde la grille depuis un coin : on la tourne de 45° dans son plan, puis on l’incline vers l’observateur. L’isométrie exacte incline jusqu’à ce que les trois axes soient raccourcis de la même façon, une élévation de arctan(1/√2) ≈ 35,26°, qui réduit la profondeur du sol à sin(35,26°) = 1/√3 ≈ 0,577.

Ma version en C fait comme la plupart des FdF et du pixel art : elle tourne la grille de 45° et divise la verticale par deux. Chaque ligne de la grille monte alors d’un pixel pour deux en largeur, et les lignes avancent en marches régulières sur la grille de pixels. C’est l’isométrie « 2:1 », une élévation de arcsin(1/2) = 30°. Voici la fonction, avec ses angles par défaut de −45° :

```c
point.x = len_win.zoom * ((cos((len_win.angel_x * 3.14) / 180) * (double)matrix.x)
		+ (-sin((len_win.angel_y * 3.14) / 180) * ((double)matrix.y)));
point.y = len_win.zoom * ((sin((len_win.angel_x * 3.14) / 180) * ((double)matrix.x))
		+ (cos((len_win.angel_y * 3.14) / 180) * ((double)matrix.y)))
		+ (-((len_win.depth) * (double)matrix.z));
point.x += len_win.start_x;
point.y /= 2;
```

Avec les deux angles à −45°, un zoom s et une profondeur d, c’est une seule matrice 2 × 3 appliquée à chaque point :

```text
[ x' ]   [  s/√2    s/√2     0   ] [ x ]
[ y' ] = [ -s/2√2   s/2√2   -d/2 ] [ y ]
                                   [ z ]
```

La première ligne place un point en largeur selon x + y, sa diagonale. La seconde le place en hauteur selon y − x, divisé par deux, et le soulève de son altitude. Deux détails, en toute honnêteté : les degrés sont convertis avec 3,14 plutôt que π, et les angles sont des entiers, donc la rotation se fait par degrés entiers.

La fenêtre est elle aussi dimensionnée par la projection. Le programme projette trois coins de la grille, puis réduit le zoom (et la profondeur avec lui) jusqu’à ce que l’image tienne dans 1920 × 1080 avec une marge, et ouvre une fenêtre juste assez grande.

La visionneuse WebGL ne projette rien à la main. Elle place une caméra orthographique dans la même direction, 45° autour et 30° de hauteur, et le GPU multiplie chaque sommet par les matrices de projection et de vue :

```js
const ISO_AZIMUTH = Math.PI / 4;
const ISO_ELEVATION = Math.PI / 6; // asin(1/2): the 2:1 look of halving y
const DIRECTION = new Vector3(
  Math.cos(ISO_ELEVATION) * Math.sin(ISO_AZIMUTH),
  Math.sin(ISO_ELEVATION),
  Math.cos(ISO_ELEVATION) * Math.cos(ISO_AZIMUTH)
);
```

Une caméra orthographique garde les lignes parallèles parallèles, ce qui fait de l’isométrie une projection parallèle. Cela compte pour la liste des bonus plus bas.

## Tracer les lignes

Chaque point est relié à ses voisins de droite et du dessous : une grille L × H a donc (L − 1) × H + L × (H − 1) arêtes, soit 499 000 pour une carte de 500 × 500.

En C, chaque arête est tracée avec l’algorithme de Bresenham. Il avance d’un bout à l’autre pixel par pixel, en choisissant entre un pas droit et un pas en diagonale grâce à un terme d’erreur entier : la boucle ne fait que des additions et des comparaisons d’entiers. La couleur de chaque pixel est mélangée entre celles des deux extrémités, canal par canal (`ft_gradient`) : une ligne d’un point bas à un point haut passe d’une couleur à l’autre.

En WebGL, ces arêtes deviennent un tampon d’indices : deux indices par arête dans un seul tableau de points, dessinés en `LineSegments`. Les indices au-delà de 65 535 demandent 32 bits, et ces cartes comptent 250 000 points. Le GPU mélange les couleurs le long de chaque ligne, le travail que `ft_gradient` faisait à la main :

```js
const index = new (width * height > 65535 ? Uint32Array : Uint16Array)(edgesOf(map) * 2);
let n = 0;
for (let row = 0; row < height; row += 1) {
  for (let col = 0; col < width; col += 1) {
    const i = row * width + col;
    if (col < width - 1) {
      index[n++] = i;
      index[n++] = i + 1;
    }
    if (row < height - 1) {
      index[n++] = i;
      index[n++] = i + width;
    }
  }
}
geometry.setIndex(new BufferAttribute(index, 1));
```

## Les bonus

Le sujet propose cinq bonus : une projection supplémentaire (parallèle ou conique, par exemple), le zoom, la translation, la rotation, et un bonus au choix.

Mon build bonus en C (`exut_fdf_bonus`) a des touches pour le zoom, la translation (10 pixels par appui), la rotation (5° par appui, les deux angles ensemble, donc la grille tourne autour de son axe vertical) et la profondeur, l’échelle des altitudes, plus deux angles prédéfinis. Il n’a pas de seconde projection : les deux préréglages sont d’autres angles de la même.

La visionneuse web garde ces commandes et ajoute ce que la version en C n’avait pas :

- **La projection supplémentaire.** L’isométrique, par défaut, est orthographique. La perspective est une projection conique : une caméra perspective de 40°, où les lignes parallèles se rejoignent en des points de fuite. P passe de l’une à l’autre, et chacune repart de la vue par défaut de la carte affichée.
- **Le zoom.** Avec la caméra orthographique, le zoom agrandit la projection (`camera.zoom`). Avec la caméra perspective, il avance la caméra sur sa ligne de visée, dans des limites ajustées à la carte.
- **La translation.** Les flèches déplacent la caméra et sa cible selon ses propres axes droite et haut, les deux premières colonnes de sa matrice : « haut » est toujours le haut de l’écran.
- **La rotation.** R tourne le modèle de 15° autour de son axe vertical, la rotation de l’original, amortie avec `MathUtils.damp` (immédiate quand les animations sont réduites). Un glisser avec le bouton droit tourne librement grâce aux `OrbitControls` de drei.
- **En plus.** Un curseur d’échelle des altitudes qui étire le modèle en y au lieu de réécrire 250 000 hauteurs, des palettes par altitude ou issues du fichier, et les six cartes.

![mars.fdf côte à côte : la vue isométrique à gauche, où les bords de la grille restent parallèles, et la vue en perspective à droite, où ils convergent](/blog-media/fdf-isometric-projection-and-memory/mars-iso-vs-perspective.webp "mars.fdf dans les deux projections : isométrique (parallèle) à gauche, perspective (conique) à droite.")

## La mémoire : free() en C, dispose() en WebGL

En C, la règle se voit au moment de redessiner. Chaque appui sur une touche détruit l’image de la fenêtre avant d’en créer une nouvelle ; sans cette destruction, chaque appui ferait fuir une image entière de la taille de la fenêtre :

```c
mlx_destroy_image(fdf->mlx.mlx, fdf->img.img);
fdf->img.img = mlx_new_image(fdf->mlx.mlx, fdf->win_len->len_win.x,
		fdf->win_len->len_win.y);
```

Échap appelle `exit(0)` : le processus se termine, et le système d’exploitation reprend les rangées de la carte et la fenêtre. Un second regard sur le code montre que les lignes renvoyées par `get_next_line` lors de la seconde passe ne sont jamais libérées. C’est sans conséquence dans un processus qui se termine juste après, et c’est une fuite continue dans tout ce qui dure. Un onglet de navigateur, lui, ne se termine pas.

Voici ce que garde une carte de 500 × 500 une fois dessinée :

| Tampon | Taille |
| --- | --- |
| Positions : 250 000 points × 3 flottants × 4 octets | 3 000 000 octets |
| Couleurs : 250 000 points × 3 octets (normalisés) | 750 000 octets |
| Indices : 499 000 arêtes × 2 × 4 octets | 3 992 000 octets |
| **Total** | **environ 7,7 Mo** |

three.js envoie ces tableaux dans des tampons GPU la première fois que la géométrie est dessinée, et le moteur de rendu garde sa propre référence à la géométrie et à ses tampons. Lâcher la dernière référence dans mon code ne libère ni l’une ni les autres : seul `geometry.dispose()` les supprime. Aller et venir dix fois entre les cartes de Julia et de Mandelbrot sans lui laisserait environ 77 Mo de mémoire GPU derrière soi, jusqu’à la disparition du contexte lui-même.

React Three Fiber trace une frontière entre ce qu’il possède et ce que je possède, un peu comme la pile et le tas en C. Un objet écrit en JSX, comme `<planeGeometry />`, est créé et libéré par R3F avec son composant. Un objet créé avec `new` est à moi : son composant le libère quand il est démonté. Version condensée de la visionneuse :

```jsx
const Model = ({ map, materials, ...props }) => {
  // Not created in JSX, so R3F does not own it: freed on unmount below
  const geometry = useMemo(() => buildGeometry(map), [map]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  // ...
};

const Wireframe = ({ map, ...props }) => {
  // Made once per canvas and shared by every map, so a switch compiles no shaders
  const materials = useMemo(
    () => ({ lines: new LineBasicMaterial({ vertexColors: true }) /* ... */ }),
    []
  );
  useEffect(() => () => materials.lines.dispose(), [materials]);
  return <Model key={map.id} map={map} materials={materials} {...props} />;
};
```

`key={map.id}` donne à chaque carte son propre `Model`. Choisir une autre carte démonte l’ancien, le nettoyage de son effet s’exécute, et sa géométrie est libérée : un `free()` pour chaque `malloc()`, lié à une durée de vie au lieu d’être écrit à la main à chaque sortie. Les matériaux survivent exprès aux cartes : changer de carte ne recompile jamais de shader.

La règle sur les variables globales a aussi son équivalent. Le programme en C passe une seule structure `t_myfdf` à chaque gestionnaire de la MiniLibX au lieu de garder l’état dans des globales. Dans la visionneuse, tout ce qui occupe de la mémoire GPU appartient à un composant et disparaît avec lui. La portée du module ne contient que des constantes, quelques vecteurs de travail réutilisés, et un cache des données de cartes téléchargées, gardé exprès pour que choisir à nouveau une carte ne la retélécharge pas. Aucun d’eux n’occupe de mémoire GPU.

Le contexte WebGL suit la même discipline un niveau au-dessus. Un navigateur n’autorise que quelques contextes actifs et abandonne le plus ancien au-delà. La page n’en garde qu’un : ouvrir la visionneuse démonte d’abord le canvas 3D de la page, et la fermer appelle aussitôt `gl.forceContextLoss()`, ce que le WebGL a de plus proche de `mlx_destroy_window`.

## Les cartes

La visionneuse propose six cartes de test du dépôt :

- `42`, l’exemple du sujet, dessiné immédiatement ;
- `julia` et `elem-fract`, des ensembles de Julia et de Mandelbrot de 500 × 500, avec leurs couleurs dans le fichier ;
- `t1`, un paysage de 200 × 200 ;
- `mars`, un terrain de 200 × 116 ;
- `pyra`, un pic en gradins à côté de son creux en miroir.

Chaque carte a sa propre échelle d’altitude, pour que son relief se lise à une taille raisonnable, là où l’original règle l’échelle au clavier. Le relevé affiche la ligne de commande du build bonus pour la carte montrée : le lien avec le programme en C reste visible.

![julia.fdf avec la palette par altitude : le même ensemble de Julia, du bleu aux points les plus bas à l’orange aux plus hauts](/blog-media/fdf-isometric-projection-and-memory/julia-altitude.webp "La même carte avec la palette par altitude : le bleu, le cyan-vert et l’orange du site, du plus bas au plus haut.")

## À retenir

- L’isométrie est une matrice de projection. La version 2:1 courante (rotation de 45°, hauteur divisée par deux, une vue à 30°) est choisie pour le rendu des lignes sur les pixels, pas pour l’exactitude géométrique.
- Bresenham trace une ligne avec des additions d’entiers seulement. Sur le GPU, un tampon d’indices d’arêtes fait le même travail pour un demi-million de lignes à la fois.
- `free()` et `dispose()` répondent à la même règle. En C, la fin du processus masque une fuite ; dans un onglet qui reste ouvert, rien ne la masque.
