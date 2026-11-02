// FdF map generator: turns .fdf heightmaps (the FdF project's test_maps, github.com/yel-hadr/
// my_fdf_42) into the files the live FdF viewer fetches when a map is picked:
//
//   node scripts/fdf/build-maps.mjs <folder of .fdf files> <id> [<id> ...]
//
// writes public/fdf/<id>.z16.gz for each <id>.fdf (and <id>.colors.json when it has colors) and
// prints its size and altitude range, for the map's entry in src/data/fdfMaps.js (the viewer
// takes the grid's width, height and altitude range from there, not from the file). The .fdf format: one line per row (y), one point per
// space-separated cell (x is its column), each an integer altitude (z), optionally followed by
// ",0xRRGGBB", the point's color. Rows of different lengths are cut to the shortest, as the
// viewer's parseFdf does. Every color in these maps follows the altitude (one color per z), so
// the colors are kept as a table from altitude to color; a file that gives two colors to one
// altitude stops the script rather than lose one.
//
// Output: <id>.z16.gz, every altitude as a little-endian 16-bit integer, row by row, gzipped (the
// viewer reads it straight into an Int16Array: nothing to parse, and a 500 x 500 map is 500 KB
// that compresses as well as the old JSON did, which the browser had to parse whole on the main
// thread); <id>.colors.json, { "<z>": "#rrggbb", ... }, only when the file has colors. Only text
// is read from the files: nothing in them is run.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = resolve(ROOT, 'public/fdf');

const [folder, ...ids] = process.argv.slice(2);
if (!folder || !ids.length) {
  console.error('usage: node scripts/fdf/build-maps.mjs <folder> <id> [<id> ...]');
  process.exit(1);
}

const parse = (text, name) => {
  const colors = {};
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((cell) => {
          const [altitude, color] = cell.split(',');
          const z = Number.parseInt(altitude, 10) || 0;
          if (color) {
            const hex = `#${Number.parseInt(color, 16).toString(16).padStart(6, '0')}`;
            if (colors[z] && colors[z] !== hex) {
              throw new Error(`${name}: altitude ${z} has two colors (${colors[z]}, ${hex})`);
            }
            colors[z] = hex;
          }
          return z;
        })
    );
  const width = Math.min(...rows.map((row) => row.length));
  const trimmed = rows.map((row) => row.slice(0, width));
  let min = Infinity;
  let max = -Infinity;
  trimmed.forEach((row) =>
    row.forEach((z) => {
      if (z < min) min = z;
      if (z > max) max = z;
    })
  );
  return { rows: trimmed, colors, width, height: rows.length, min, max };
};

await mkdir(OUT, { recursive: true });
for (const id of ids) {
  const text = await readFile(resolve(folder, `${id}.fdf`), 'utf8');
  const { rows, colors, width, height, min, max } = parse(text, `${id}.fdf`);
  const bytes = Buffer.alloc(width * height * 2);
  rows.flat().forEach((z, i) => bytes.writeInt16LE(z, i * 2));
  const gz = gzipSync(bytes, { level: 9 });
  await writeFile(resolve(OUT, `${id}.z16.gz`), gz);
  if (Object.keys(colors).length) {
    await writeFile(resolve(OUT, `${id}.colors.json`), `${JSON.stringify(colors)}\n`);
  }
  console.log(
    `${id}: ${width} x ${height}, z ${min}..${max}, ${Object.keys(colors).length} colors, ` +
      `${Math.round(gz.length / 1024)} KB gzipped`
  );
}
