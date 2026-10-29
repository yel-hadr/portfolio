// The FdF viewer's maps: six of the FdF project's test_maps (github.com/yel-hadr/my_fdf_42), its
// own .fdf files. 42.fdf is inline (the default, drawn at once); the others are JSON files in
// public/fdf/, made from the .fdf files by scripts/fdf/build-maps.mjs and fetched only when
// picked: the two 500 x 500 fractals are a quarter of a million points each.
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

const src = (id) => `${import.meta.env.BASE_URL}fdf/${id}.json`;

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
    const promise = fetch(src(id))
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${src(id)}`);
        return response.json();
      })
      .then(({ rows, colors }) => {
        const width = Math.min(...rows.map((row) => row.length));
        // 16-bit: every altitude in these maps fits, in a quarter of a plain array's memory
        const z = Int16Array.from(rows.flatMap((row) => row.slice(0, width)));
        let min = Infinity;
        let max = -Infinity;
        z.forEach((value) => {
          if (value < min) min = value;
          if (value > max) max = value;
        });
        return ready(meta, { width, height: rows.length, z, min, max }, colors ?? null);
      });
    promise.catch(() => loaded.delete(id));
    loaded.set(id, promise);
  }
  return loaded.get(id);
};
