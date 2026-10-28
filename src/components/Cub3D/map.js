// The demo's world: maps/map.cub from github.com/yel-hadr/cub3D_42, verbatim. The .cub format
// gives one texture per wall side (NO, SO, WE, EA), the floor (F) and ceiling (C) colors as R,G,B,
// then the map: 1 = wall, 0 = floor, D = door, N/S/E/W = the player's start and facing.
export const MAP_CUB = `NO ./textures/CRATE_1D.png
SO ./textures/BRICK_6D.png
WE ./textures/CONSOLE_1B.png
EA ./textures/PIPES_1A.png

F 220,100,0
C 225,30,0

        1111111111111111111111110
        1000000000110000000000001
        1011000000000100000000001
        1001000000000010000000001
111111111011000001110000000000001
100000000011000001110111110111111
11100111111110111000000100001
11110111111111011101010010001
11000000110101011100000010001
100000000000000011000000D0001
10000000000000001101010011011
11000001110101011111011110N01
11110111111010101101111010001
11111111 1111111 111111111111`;

// Facing as a yaw angle (radians, three.js: 0 looks toward -z, which is north on the map)
const FACING = { N: 0, W: Math.PI / 2, S: Math.PI, E: -Math.PI / 2 };
const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Parses a .cub file into { floor, ceiling, width, height, player, doors, walkable }. Cells are
 * indexed z * width + x: `doors` lists the door cells, and `walkable` (1 per cell) marks the cells
 * reachable from the player (a flood fill, as cub3D's own map check does), so cells outside the
 * enclosed area never count as floor. The texture lines are skipped: the demo paints its own.
 */
export const parseCub = (text) => {
  const lines = text.split('\n');
  let floor = [0, 0, 0];
  let ceiling = [0, 0, 0];
  let first = 0;
  for (; first < lines.length; first += 1) {
    const line = lines[first];
    const [key, value] = line.trim().split(/\s+/);
    if (key === 'F') floor = value.split(',').map(Number);
    else if (key === 'C') ceiling = value.split(',').map(Number);
    else if (key && /^[ 01NSEWD]+$/.test(line)) break;
  }
  const rows = lines.slice(first);
  const width = Math.max(...rows.map((r) => r.length));
  const height = rows.length;
  const at = (x, z) => rows[z]?.[x] ?? ' ';

  let player = null;
  const doors = [];
  rows.forEach((row, z) =>
    [...row].forEach((char, x) => {
      if (char in FACING) player = { x: x + 0.5, z: z + 0.5, yaw: FACING[char] };
      if (char === 'D') doors.push(z * width + x);
    })
  );

  const walkable = new Uint8Array(width * height);
  const stack = [[Math.floor(player.x), Math.floor(player.z)]];
  walkable[stack[0][1] * width + stack[0][0]] = 1;
  while (stack.length) {
    const [x, z] = stack.pop();
    NEIGHBOURS.forEach(([dx, dz]) => {
      const nx = x + dx;
      const nz = z + dz;
      // In range whenever at() finds a floor character
      if ('0NSEWD'.includes(at(nx, nz)) && !walkable[nz * width + nx]) {
        walkable[nz * width + nx] = 1;
        stack.push([nx, nz]);
      }
    });
  }

  return { floor, ceiling, width, height, player, doors, walkable };
};
