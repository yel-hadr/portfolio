---
title: From C to WebGL: Recreating Wolfenstein 3D’s DDA Raycasting
summary: How my 42 cub3D casts one ray per screen column through a grid in C, parses and validates .cub maps, and how the same ideas carry a React Three Fiber game on this site.
description: How cub3D casts one ray per screen column in C, validates .cub maps with a flood fill, and how collisions, doors and mouse look carry over to WebGL.
---

## The assignment

The 42 subject for cub3D opens with Wolfenstein 3D: developed by id Software under John Carmack and John Romero, published in 1992, and called “the first true First Person Shooter”. The task is to rebuild its trick in C: a “realistic” 3D view of the inside of a maze, drawn with ray-casting, through MiniLibX (I used MLX42, Codam’s build of it). The allowed functions are a short list (`open`, `read`, `malloc`, `free`, the math library, the graphics library and a few more), so everything else is written by hand.

This post walks through the math, the map parser and the bonuses in my C version ([cub3D_42 on GitHub](https://github.com/yel-hadr/cub3D_42)), then how the same ideas became the live demo and the Game Mode on this site, in React Three Fiber.

![The live cub3D demo: the repository’s own map.cub with a different texture on each wall side, and the minimap’s rays in the top right corner](/blog-media/cub3d-raycasting-from-c-to-webgl/cub3d-demo.webp "The live demo, built from the repository’s maps/map.cub. Run it from the cub3D card on the home page.")

[Run the live cub3D demo](/?demo=cub3d)

## A 2D grid, seen from inside

A `.cub` map is a grid: `1` is a wall, `0` is floor. The world never has a second floor or a slope, so a 3D view of it only needs one number per screen column: how far away the nearest wall is in that direction.

My C version works in units of 64 per cell (`BLOCK`), in a 1600 × 900 window, with a 60° field of view. For each of the 1600 columns it casts one ray, starting at the view angle minus 30° and turning 60/1600 of a degree per column:

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

## Stepping through the grid: the DDA

The naive way to find the wall is to march along the ray in small steps and test each point. It is slow, and a step that is too long jumps over the corner of a wall. A Digital Differential Analyzer (DDA) only tests the points where the ray crosses a grid line, because a wall can only start there. Between two crossings of horizontal grid lines, the ray always moves exactly one cell (64 units) in y and 64 / tan(θ) in x. So after the first crossing, every next one is a constant addition.

My C version runs this walk twice per ray, once over horizontal grid lines and once over vertical ones, and keeps the nearer hit. Which of the two won also says which face of the wall was hit: a horizontal hit is a north or south face, a vertical one an east or west face. That is how the four textures of the subject (NO, SO, WE, EA) get picked. Condensed from `h_v_check.c`:

```c
/* The first horizontal grid line the ray crosses, then one cell per step */
ray.yintercept = floor(player_y / BLOCK) * BLOCK;
if (ray.north_south == SOUTH)
	ray.yintercept += BLOCK;
ray.xintercept = player_x + (ray.yintercept - player_y) / tan(ray_angle);
ray.ystep = (ray.north_south == NORTH) ? -BLOCK : BLOCK;
ray.xstep = BLOCK / tan(ray_angle);   /* its sign follows the ray's east or west */
while (inside_the_map(ray.next_x, ray.next_y))
{
	/* facing north, look into the cell above the line, not below it */
	if (ft_haswallat(data, ray.next_x, ray.next_y - (ray.north_south == NORTH), &ray))
		break ;
	ray.next_x += ray.xstep;
	ray.next_y += ray.ystep;
}
```

Each ray visits at most one cell per grid line it crosses, so its cost is bounded by the size of the map, O(width + height), not by how finely it is sampled.

The same walk can run in a single loop, the version usually credited to Lode Vandevenne’s raycasting tutorial. `deltaX` is how far the ray travels between two vertical grid lines (|1 / dx| for a unit direction), and the loop always advances whichever crossing is nearer. The web version uses it for the minimap’s rays and for aiming:

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

## From a distance to a wall on screen

Two details turn a distance into a believable wall.

**The fisheye.** Rays at the edges of the screen travel farther than the one in the middle to reach the same flat wall, so the Euclidean distance makes straight walls bulge. The fix is to keep only the part of the distance along the view direction: multiply by the cosine of the angle between the ray and the view.

**The projection plane.** The screen is a plane at a distance d from the eye, chosen so that the 60° field of view fills its 1600 columns: d = (1600 / 2) / tan(30°) ≈ 1385.6. A wall slice of height 64 at distance D then measures 64 / D × d pixels on screen.

```c
ray->distance = distance(player_x, player_y, ray->next_x, ray->next_y);
ray->distance *= cos(normalize_angle(angle - data->camera.angle));  /* no fisheye */

data->distance_proj_plane = (WINDOW_WIDTH / 2) / tan(FOV_ANGLE / 2 * DEGRE);
ray.wall_strip_height = (BLOCK / ray.distance) * data->distance_proj_plane;
ray.wall_top = (WINDOW_HEIGHT / 2) - (ray.wall_strip_height / 2);
```

A wall two cells straight ahead (128 units) is 64 / 128 × 1385.6 ≈ 693 pixels tall, three quarters of the window. The texture column comes from where the ray hit inside the cell: `hit_y % 64` on a vertical wall, `hit_x % 64` on a horizontal one. Then every pixel of the column is written by hand: the ceiling color, the wall’s texels, the floor color. That is 1.44 million `mlx_put_pixel` calls per frame, all on the CPU.

## Parsing .cub, strictly

The subject is precise about the file:

- Six elements, in any order, separated by any number of empty lines: `NO`, `SO`, `WE` and `EA` with a texture path, then `F` and `C` with an R,G,B color, each channel in [0, 255].
- The map comes last and uses only `0`, `1` and one of `N`, `S`, `E`, `W` for the player’s start and facing. Spaces are a valid part of the map.
- The map must be closed, surrounded by walls.
- On any misconfiguration, the program must exit cleanly and print `Error` followed by an explicit message.

My parser reads the whole file with `get_next_line`, then checks it in the order the errors can happen:

1. **Identifiers.** Every non-empty line before the map must start with one of the six identifiers and have exactly two fields. A texture already set, or a color given twice, is an error, so a duplicate cannot silently win.
2. **Colors.** `F` and `C` are split on commas: exactly three parts, digits only, none above 255. The three channels are packed into one RGBA value once, at load time.
3. **Textures.** Each path is opened once to prove it exists before MLX tries to load it.
4. **The player.** Exactly one `N`, `S`, `E` or `W`: a second one is an error, none is an error. The letter sets the start angle. The y axis points down on screen, so north is 3π/2.
5. **Closed map.** A flood fill from the player through every cell that is not a wall. If it ever reaches the first or last row or column, the player could walk out of the world, and the map is rejected.

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
	/* ... the same for the three other neighbours ... */
	curr = curr->next;
}
ft_lstclear(&head);
```

Spaces inside the map are turned into floor before the fill, and short lines are padded. A gap in a wall, even one hidden behind a space, is therefore found. The check is a breadth-first search: the linked list is its queue, and every visited cell stays in it.

One thing I would change today: `valid_coords` asks whether a cell was visited by walking that list, so the fill is O(n²) in the number of cells. That is invisible on a map of a few hundred cells. The web parser keeps a `Uint8Array` with one byte per cell instead, which makes the same fill O(n).

## The bonuses, in C and in the browser

The subject’s bonus list is wall collisions, a minimap, doors that open and close, animated sprites, and turning with the mouse. Here is how each one looks in C and in the Game Mode on this site, a full-screen cub3D world written in React Three Fiber.

![Game Mode on this site: a wall terminal in the About room, the radar in the top right corner with doors, threats and the player’s view cone, and the mission list on the left](/blog-media/cub3d-raycasting-from-c-to-webgl/game-mode.webp "Game Mode: the same grid, map format and rules, rendered by the GPU. Open it with Enter Game Mode on the home page.")

**Wall collisions.** In C, a move is allowed only if the target point is not in a wall, and neither is a point four steps further on each axis. That margin keeps the camera from touching a wall. On the web, the player is a small square (0.2 cell from its center to its edge) tested by its four corners. Each axis is tested on its own, so walking diagonally into a wall slides along it instead of stopping dead:

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

Collisions are tests against the grid, not rays. Rays are for seeing, and in Game Mode for aiming: a target counts as hit only if it is closer than the wall that the center ray reaches with the DDA above.

**Minimap.** In C it is a second MLX image, redrawn pixel by pixel every frame over the 3D view. In the web demo it is a 2D canvas over the WebGL view, with its rays cast by the DDA. Game Mode’s radar draws the whole map from a cached layer of walls, then draws doors, threats and the player’s view cone on top every frame.

**Doors.** In C, a `D` in the map is a door. Space toggles the cell in front of the player between `D` (closed: drawn with a door texture, stops rays and the player) and `O` (open). In Game Mode, the door cells are listed while the map is parsed, and their state is one entry per cell in a ref. The collision test reads it:

```js
const solid = (cx, cz) => !isFloor(cx, cz) || doors.current[cz * W + cx] === true;
```

The doors are drawn as one instanced mesh whose halves slide into the walls when they open, or switch at once under reduced motion.

**Mouse look.** In C, MLX hides the cursor and a cursor hook turns the view. In the browser, the Pointer Lock API gives the mouse’s raw movement. Each move adds to a pending turn, and the camera eases through it every frame, which gives a little inertia (instant under reduced motion).

**Animated sprites.** In C, it is the weapon: four frames (holding, firing, two of recoil) cycled after a shot. In Game Mode, the weapons are low-poly 3D models with recoil, bob and sway, all dropped under reduced motion.

## What changes between C and WebGL

| Aspect | C with MLX42 | React Three Fiber |
| --- | --- | --- |
| Walls | One ray per column, every pixel written by `mlx_put_pixel` on the CPU | Wall faces as instanced geometry, rasterized by the GPU; the depth buffer does what the nearest-hit test did |
| Projection | d = (W / 2) / tan(30°), from a 60° horizontal FOV | A perspective camera, which takes a vertical FOV derived from the same 60° |
| Frame loop | The MLX loop redraws the whole window on every tick | Frames are drawn on demand, only when something changed; continuously only while the game is played |
| State | One `t_data` struct passed to every hook | Refs for what changes every frame (position, doors), React state only for what the interface shows |
| Memory | `malloc` and `free`, `mlx_delete_texture` | GPU buffers and textures freed with `dispose()`; one WebGL context at a time on the page |

The web version does not cast a ray per column, and that is a choice: the GPU already solves visibility for every pixel with its depth buffer. Casting 1600 rays in JavaScript, painting the result into a texture and uploading it every frame would do the GPU’s job more slowly. What carries over is everything around the drawing: the grid, the `.cub` parser and its flood fill, the DDA for lines of sight, and collisions on cells.

The one formula that needs translating is the field of view. three.js cameras take a vertical angle, and the subject’s 60° is horizontal, so it is converted for the window’s aspect ratio:

```js
const aspect = size.width / Math.max(size.height, 1);
eye.fov = (2 * Math.atan(Math.tan((FOV * Math.PI) / 360) / aspect) * 180) / Math.PI;
```

Memory is the other change. In C, a texture lives until `mlx_delete_texture`. In WebGL, a geometry or texture created by hand holds GPU memory until `dispose()` is called on it, whatever JavaScript’s garbage collector does. A browser also allows only a few live WebGL contexts at once, so the page keeps one: it releases its own context before a demo or Game Mode creates theirs, and gets it back when they close.

## Takeaways

- Raycasting is a 2D problem: the grid and one distance per column are the whole world model.
- The DDA is fast because it only visits grid lines, so each ray costs the size of the map, not the distance.
- A strict parser checks in the order errors happen, and a flood fill is the honest test of a closed map.
- Moving to the GPU changes how pixels get drawn, not the model: the grid, the parser, the DDA and the collisions carried over almost line for line.
