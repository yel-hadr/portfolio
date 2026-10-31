---
title: Rendering 500×500 Fractals: Isometric Math and Memory
summary: How my 42 FdF projects a heightmap to a 2:1 isometric wireframe in C with Bresenham lines, and why switching 500×500 maps in WebGL takes the same discipline as free().
description: FdF in C and WebGL: the isometric projection behind a 2:1 wireframe, Bresenham lines, and why a 500×500 map switch needs dispose() as C needs free().
---

## The assignment

FdF (“fil de fer”, wireframe) is the first graphics project at 42. The subject asks for “a simple wireframe model representation of a 3D landscape by linking various points (x, y, z) thanks to line segments”, read from a `.fdf` file, and states the one hard requirement on the picture: “Your program has to represent the model in isometric projection.”

The rules around it shape the code as much as the math does: MiniLibX images are mandatory, Escape and the window’s close button must quit cleanly, global variables are forbidden, and, as in every 42 project, “All heap-allocated memory must be properly freed when necessary. Memory leaks will not be tolerated.”

This post covers the projection, the line drawing and the memory rules in my C version ([my_fdf_42 on GitHub](https://github.com/yel-hadr/my_fdf_42)), then the live viewer on this site, which draws six of the repository’s own test maps in WebGL, two of them 500 × 500 fractals.

![julia.fdf in the live viewer with the file’s own colors: a flat dark red plane with white peaks in the shape of a Julia set, and a readout of 250,000 vertices and 499,000 edges](/blog-media/fdf-isometric-projection-and-memory/julia-file-colors.webp "julia.fdf, drawn with the colors written in the file: 250,000 points joined by 499,000 edges.")

[Run the live FdF viewer](/?demo=fdf)

## The file is the grid

A `.fdf` file is a heightmap. Each line is a row (y), each number on it a column (x), and the number itself is the altitude (z). A point can carry its own color after a comma:

```text
0  0  0  0  0
0 10 10 10  0
0 10,0xFF0000 10  0  0
```

The subject is clear that “the goal of this project is not to parse maps” and lets the program assume a well-formed file. Mine still reads every file twice. The first pass counts the rows, checks that each has the same number of columns (or stops with `MAP_ERROR`), and finds the lowest and highest altitudes. The second pass reads the values and colors. A color is the hex digits after `0x`, and a point without one is white (`0xFFFFFF`).

The web viewer does that work at build time. A Node script turns each `.fdf` into JSON. The colors in these maps follow the altitude, so they are stored as a table from altitude to color, and the script stops on a file that gives two colors to one altitude rather than lose one. The two 500 × 500 maps are fetched only when picked, and their altitudes go into an `Int16Array`, 2 bytes per point instead of the 8 of a plain array’s numbers:

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

The loop is there for a reason: `Math.min(...z)` passes a quarter of a million arguments and overflows the call stack.

## The projection, as a matrix

An isometric view looks at the grid from a corner: turn it 45° in its own plane, then tilt it toward the viewer. True isometric tilts until the three axes are equally foreshortened, an elevation of arctan(1/√2) ≈ 35.26°, which squashes the ground’s depth to sin(35.26°) = 1/√3 ≈ 0.577.

My C version does what most FdF projects and most pixel art do: it turns the grid 45° and halves the vertical. Every grid line then rises one pixel for every two across, so lines step evenly on a pixel grid. It is the “2:1 isometric” look, an elevation of arcsin(1/2) = 30°. Here is the function, with its default angles of −45°:

```c
point.x = len_win.zoom * ((cos((len_win.angel_x * 3.14) / 180) * (double)matrix.x)
		+ (-sin((len_win.angel_y * 3.14) / 180) * ((double)matrix.y)));
point.y = len_win.zoom * ((sin((len_win.angel_x * 3.14) / 180) * ((double)matrix.x))
		+ (cos((len_win.angel_y * 3.14) / 180) * ((double)matrix.y)))
		+ (-((len_win.depth) * (double)matrix.z));
point.x += len_win.start_x;
point.y /= 2;
```

With both angles at −45°, zoom s and depth d, it is one 2 × 3 matrix applied to every point:

```text
[ x' ]   [  s/√2    s/√2     0   ] [ x ]
[ y' ] = [ -s/2√2   s/2√2   -d/2 ] [ y ]
                                   [ z ]
```

The first row places a point across the screen by x + y, its diagonal. The second places it down the screen by y − x, halved, and lifts it by its altitude. Two honest details: the degrees are converted with 3.14 rather than π, and the angles are integers, so rotation goes in whole degrees.

The window is sized from the projection too. The program projects three corners of the grid, then lowers the zoom (and the depth with it) until the picture fits in 1920 × 1080 with a margin, and opens a window just large enough.

The WebGL viewer does not project anything by hand. It places an orthographic camera along the same direction, 45° around and 30° up, and the GPU multiplies every vertex by the projection and view matrices:

```js
const ISO_AZIMUTH = Math.PI / 4;
const ISO_ELEVATION = Math.PI / 6; // asin(1/2): the 2:1 look of halving y
const DIRECTION = new Vector3(
  Math.cos(ISO_ELEVATION) * Math.sin(ISO_AZIMUTH),
  Math.sin(ISO_ELEVATION),
  Math.cos(ISO_ELEVATION) * Math.cos(ISO_AZIMUTH)
);
```

An orthographic camera keeps parallel lines parallel, which is what makes isometric a parallel projection. That matters for the bonus list below.

## Drawing the lines

Each point is joined to its right and lower neighbours, so a W × H grid has (W − 1) × H + W × (H − 1) edges: 499,000 for a 500 × 500 map.

In C, each edge is drawn with Bresenham’s line algorithm. It walks from one end to the other one pixel at a time, choosing between a straight and a diagonal step with an integer error term, so the inner loop only adds and compares integers. Each pixel’s color is blended between the two end colors, channel by channel (`ft_gradient`), so a line from a low point to a high one fades from one color to the other.

In WebGL, those edges become an index buffer: two indices per edge into one array of points, drawn as `LineSegments`. Indices above 65,535 need 32 bits, and these maps have 250,000 points. The GPU blends the colors along each line, the work `ft_gradient` did by hand:

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

## The bonuses

The subject lists five bonuses: one extra projection (“such as parallel or conic”), zoom, translate, rotate, and one more of your choice.

My C bonus build (`exut_fdf_bonus`) has keys for zoom, translation (10 pixels per press), rotation (5° per press, both angles together, so the grid turns about its vertical axis) and depth, the altitude scale, plus two preset angles. It has no second projection: both presets are other angles of the same one.

The web viewer keeps those controls and adds what the C version did not have:

- **The extra projection.** Isometric, the default, is orthographic. Perspective is a conic projection: a 40° perspective camera, where parallel lines meet at vanishing points. P switches between them, and each starts from its default view of the current map.
- **Zoom.** With the orthographic camera, zoom scales the projection (`camera.zoom`). With the perspective camera it moves the camera along its line of sight, within limits fitted to the map.
- **Translate.** The arrow keys move the camera and its target along the camera’s own right and up axes, the first two columns of its matrix, so “up” is always up on screen.
- **Rotate.** R turns the model 15° about its vertical axis, the original’s rotation, eased with `MathUtils.damp` (at once under reduced motion). A right-drag orbits freely through drei’s `OrbitControls`.
- **More.** A z-scale slider that scales the model’s y instead of rewriting 250,000 heights, palettes by altitude or from the file, and the six maps.

![mars.fdf side by side: the isometric view on the left, where the grid’s edges stay parallel, and the perspective view on the right, where they converge](/blog-media/fdf-isometric-projection-and-memory/mars-iso-vs-perspective.webp "mars.fdf in both projections: isometric (parallel) on the left, perspective (conic) on the right.")

## Memory: free() in C, dispose() in WebGL

In C, the rule shows in the redraw. Every key press destroys the window’s image before making a new one; without the destroy, each press would leak a whole window-sized image:

```c
mlx_destroy_image(fdf->mlx.mlx, fdf->img.img);
fdf->img.img = mlx_new_image(fdf->mlx.mlx, fdf->win_len->len_win.x,
		fdf->win_len->len_win.y);
```

Escape calls `exit(0)`: the process ends, and the operating system takes back the map rows and the window. A second look at the code shows that the lines `get_next_line` returns in the second pass are never freed. That is harmless in a process that exits a moment later, and a steady leak in anything that lives on. A browser tab does not end. The viewer lives in a page that keeps running, so every map switch has to give back what the last map held, and JavaScript’s garbage collector does not cover all of it.

Here is what one 500 × 500 map holds once it is drawn:

| Buffer | Size |
| --- | --- |
| Positions: 250,000 points × 3 floats × 4 bytes | 3,000,000 bytes |
| Colors: 250,000 points × 3 bytes (normalized) | 750,000 bytes |
| Index: 499,000 edges × 2 × 4 bytes | 3,992,000 bytes |
| **Total** | **about 7.7 MB** |

three.js uploads those arrays to GPU buffers the first time the geometry is drawn, and the renderer keeps its own reference to the geometry and its buffers. Dropping the last reference in my code frees neither: only `geometry.dispose()` deletes them. Going back and forth between the Julia and Mandelbrot maps ten times without it would leave about 77 MB of GPU memory behind, until the context itself goes away.

React Three Fiber draws a line between what it owns and what I own, much like the stack and the heap in C. An object written in JSX, like `<planeGeometry />`, is created and disposed by R3F with its component. An object made with `new` is mine, so its component frees it when it unmounts. Condensed from the viewer:

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

`key={map.id}` gives each map its own `Model`. Picking another map unmounts the old one, its effect’s cleanup runs, and its geometry is freed: a `free()` for every `malloc()`, tied to a lifetime instead of written by hand at each exit. The materials outlive the maps on purpose, so switching maps never recompiles a shader.

The rule on global variables carries over too. The C program passes one `t_myfdf` struct to every MiniLibX hook instead of keeping state in globals. In the viewer, everything that holds GPU memory belongs to a component and dies with it. Module scope holds only constants, a few reusable scratch vectors, and a cache of fetched map data, kept on purpose so that picking a map again does not download it again. None of them holds GPU memory.

The WebGL context follows the same discipline one level up. A browser allows only a few live contexts and drops the oldest past that limit. The page keeps one: opening the viewer unmounts the page’s own 3D canvas first, and closing it calls `gl.forceContextLoss()` at once, the closest thing WebGL has to `mlx_destroy_window`.

## The maps

The viewer offers six of the repository’s test maps:

- `42`, the subject’s own example, drawn at once;
- `julia` and `elem-fract`, 500 × 500 Julia and Mandelbrot sets with colors in the file;
- `t1`, a 200 × 200 landscape;
- `mars`, a 200 × 116 terrain;
- `pyra`, a stepped peak beside its mirror pit.

Each map has its own altitude scale, so its relief reads at a sensible size, where the original scales by key. The readout prints the bonus build’s command line for the map shown, so the link to the C program stays visible.

![julia.fdf in the altitude palette: the same Julia set shaded from blue at the lowest points to orange at the highest](/blog-media/fdf-isometric-projection-and-memory/julia-altitude.webp "The same map with the altitude palette: the site’s blue, cyan-green and orange, from lowest to highest.")

## Takeaways

- Isometric is a projection matrix. The common 2:1 version (45° turn, half height, a 30° view) is chosen for how lines look on pixels, not for exact geometry.
- Bresenham draws a line with integer additions only. On the GPU, an index buffer of edges does the same job for half a million lines at once.
- `free()` and `dispose()` answer the same rule. In C, the process ending hides a leak; in a browser tab that keeps running, nothing does.
