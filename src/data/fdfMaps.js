// The FdF viewer's maps: six of the FdF project's test_maps (github.com/yel-hadr/my_fdf_42), its
// own .fdf files. 42.fdf is inline (the default, drawn at once); the others are binary files in
// public/fdf/ (<id>.z16.gz, each altitude a little-endian 16-bit integer, row by row, gzipped,
// plus <id>.colors.json for maps with their own colors), made from the .fdf files by
// scripts/fdf/build-maps.mjs and fetched only when picked: the two 500 x 500 fractals are a
// quarter of a million points each, read straight into an Int16Array (parsing them as JSON
// blocked the page for about a quarter of a second).
//
// Each entry: `file` its path in the repo; its grid, altitude range and whether it carries its
// own colors (",0xRRGGBB", one per altitude); `altitude` the world height per altitude unit at a
// z-scale of 1, so each map's relief reads at its own size (the original scales by key instead).

import { parseFdf } from '../components/Fdf/heightmap';

// test_maps/42.fdf, verbatim: each number is the altitude of one point of a 19 x 11 grid
export const MAP_42 = `0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0
0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0
0  0 10 10  0  0 10 10  0  0  0 10 10 10 10 10  0  0  0
0  0 10 10  0  0 10 10  0  0  0  0  0  0  0 10 10  0  0
0  0 10 10  0  0 10 10  0  0  0  0  0  0  0 10 10  0  0
0  0 10 10 10 10 10 10  0  0  0  0 10 10 10 10  0  0  0
0  0  0 10 10 10 10 10  0  0  0 10 10  0  0  0  0  0  0
0  0  0  0  0  0 10 10  0  0  0 10 10  0  0  0  0  0  0
0  0  0  0  0  0 10 10  0  0  0 10 10 10 10 10 10  0  0
0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0
0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0`;

const src = (id, file) => `${import.meta.env.BASE_URL}fdf/${id}${file}`;

const GZIP = [0x1f, 0x8b];

// The altitudes, row by row. The file is gzipped bytes; a server that sends it with
// Content-Encoding has already unzipped it (no gzip magic left), else the browser's own
// DecompressionStream does, off the page's JavaScript
const altitudes = async (id) => {
  const response = await fetch(src(id, '.z16.gz'));
  if (!response.ok) throw new Error(`${response.status} ${src(id, '.z16.gz')}`);
  let buffer = await response.arrayBuffer();
  const head = new Uint8Array(buffer, 0, 2);
  if (head[0] === GZIP[0] && head[1] === GZIP[1]) {
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
    buffer = await new Response(stream).arrayBuffer();
  }
  // Little-endian, as written; every browser that runs WebGL2 is
  return new Int16Array(buffer);
};

const fileColors = async (id) => {
  const response = await fetch(src(id, '.colors.json'));
  if (!response.ok) throw new Error(`${response.status} ${src(id, '.colors.json')}`);
  return response.json();
};

export const FDF_MAPS = [
  { id: '42', width: 19, height: 11, min: 0, max: 10, colors: false, altitude: 0.1 },
  { id: 'julia', width: 500, height: 500, min: 1, max: 100, colors: true, altitude: 0.3 },
  { id: 'elem-fract', width: 500, height: 500, min: 1, max: 100, colors: true, altitude: 0.22 },
  { id: 't1', width: 200, height: 200, min: 0, max: 252, colors: true, altitude: 0.1 },
  { id: 'mars', width: 200, height: 116, min: 0, max: 15, colors: false, altitude: 0.6 },
  { id: 'pyra', width: 27, height: 27, min: -13, max: 13, colors: false, altitude: 0.35 },
].map((map) => ({ ...map, file: `test_maps/${map.id}.fdf` }));

const entry = (id) => FDF_MAPS.find((map) => map.id === id);

// A map ready to draw: its entry, plus `z` (row by row) and `colors` (altitude -> '#rrggbb')
const ready = (meta, { width, height, z, min, max }, colors = null) => ({
  ...meta,
  width,
  height,
  z,
  min,
  max,
  colors,
});

export const DEFAULT_MAP = ready(entry('42'), parseFdf(MAP_42));

// Fetched once each; a failed fetch is forgotten, so picking the map again retries
const loaded = new Map([['42', Promise.resolve(DEFAULT_MAP)]]);

/** The map with this id, ready to draw (from public/fdf/ the first time) */
export const loadMap = (id) => {
  if (!loaded.has(id)) {
    const meta = entry(id);
    // The grid and its altitude range come from the map's entry: nothing to scan
    const promise = Promise.all([altitudes(id), meta.colors ? fileColors(id) : null]).then(
      ([z, colors]) => {
        const { width, height, min, max } = meta;
        if (z.length !== width * height) throw new Error(`${id}: ${z.length} points`);
        // The colors and bounds are built from the entry's range: an altitude past it would draw
        // black lines, so a file that drifted from its entry fails to load instead
        for (let i = 0; i < z.length; i += 1) {
          if (z[i] < min || z[i] > max) throw new Error(`${id}: z ${z[i]} outside ${min}..${max}`);
        }
        return ready(meta, { width, height, z, min, max }, colors);
      }
    );
    promise.catch(() => loaded.delete(id));
    loaded.set(id, promise);
  }
  return loaded.get(id);
};
