// test_maps/42.fdf from github.com/yel-hadr/my_fdf_42, verbatim: each number is the altitude of
// one point of a 19 x 11 grid (a .fdf may also carry ",0xRRGGBB" colors; this one has none).
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

/** A .fdf file as { width, height, z: number[] (row by row), min, max } */
export const parseFdf = (text) => {
  const rows = text
    .trim()
    .split('\n')
    .map((line) =>
      line
        .trim()
        .split(/\s+/)
        // "10,0xFF0000": the altitude is the part before the comma
        .map((cell) => Number.parseInt(cell, 10) || 0)
    );
  const width = Math.min(...rows.map((r) => r.length));
  const z = rows.flatMap((r) => r.slice(0, width));
  return { width, height: rows.length, z, min: Math.min(...z), max: Math.max(...z) };
};
