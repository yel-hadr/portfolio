// The .fdf format: one line per row of the grid, one altitude per point (the maps are in
// src/data/fdfMaps.js).

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
  // A loop, not Math.min(...z): spreading a large map overflows the call stack
  let min = Infinity;
  let max = -Infinity;
  z.forEach((value) => {
    if (value < min) min = value;
    if (value > max) max = value;
  });
  return { width, height: rows.length, z, min, max };
};
