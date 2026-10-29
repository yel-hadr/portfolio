// Game Mode's "DevOps Command Center": map.cub's grid, unchanged, read as four rooms. Pure data.
// Cells are (x, z) as in map.js; a panel sits 0.02 off a wall face, turned to face the room
// (yaw 0 faces +z, PI faces -z, PI/2 faces +x, -PI/2 faces -x).

// Rooms as cell rectangles [x0, z0, x1, z1] (inclusive); the first match wins
export const ROOMS = [
  // The south-east block around N, with map.cub's own door
  { id: 'about', rects: [[18, 6, 28, 13]] },
  // The north-west room with its pillars, and its pocket to the south
  {
    id: 'projects',
    rects: [
      [9, 0, 18, 4],
      [12, 5, 16, 6],
    ],
  },
  // The north-east hall, with the passage west of it
  { id: 'skills', rects: [[19, 0, 32, 5]] },
  // The west hall and the corridor up to the north-west room
  { id: 'contact', rects: [[0, 5, 17, 13]] },
];

export const roomAt = (x, z) =>
  ROOMS.find(({ rects }) =>
    rects.some(([x0, z0, x1, z1]) => x >= x0 && x < x1 + 1 && z >= z0 && z < z1 + 1)
  )?.id ?? null;

// Game Mode's doors between the rooms, on top of map.cub's own: [x, z] cells that are floor in
// the map (the grid is unchanged), closed at the start. Opening one shows the room behind it
export const GAME_DOORS = [
  [26, 5], // About and Skills, up the spawn corridor
  [20, 5], // About and Skills, from the west block
  [18, 2], // Skills and Projects
  [18, 3],
  [9, 4], // Projects and Contact
];

// kind: 'info' opens the wall's text, 'terminal' a live demo, 'contact' the contact form
export const GAME_PANELS = [
  { id: 'welcome', kind: 'info', position: [25.02, 0.55, 7.5], yaw: Math.PI / 2 },
  { id: 'about', kind: 'info', position: [27.98, 0.55, 8.5], yaw: -Math.PI / 2 },
  { id: 'skills', kind: 'info', position: [26.5, 0.55, 1.02], yaw: 0 },
  { id: 'cub3d', kind: 'terminal', position: [13.5, 0.55, 1.02], yaw: 0 },
  { id: 'fdf', kind: 'terminal', position: [16, 0.55, 1.02], yaw: 0 },
  { id: 'projects', kind: 'info', position: [16.98, 0.55, 4.5], yaw: -Math.PI / 2 },
  { id: 'contact', kind: 'contact', position: [1.02, 0.55, 9.5], yaw: Math.PI / 2 },
];

// Threats, two or three to a room: one sprite each, drifting toward the player once in sight
export const ENEMIES = [
  { id: 'e1', type: 'ddos', cell: [26, 7] },
  { id: 'e2', type: 'sql', cell: [22, 8] },
  { id: 'e3', type: 'ddos', cell: [29, 2] },
  { id: 'e4', type: 'sql', cell: [24, 4] },
  { id: 'e5', type: 'sql', cell: [14, 3] },
  { id: 'e6', type: 'ddos', cell: [11, 1] },
  { id: 'e7', type: 'ddos', cell: [4, 6] },
  { id: 'e8', type: 'sql', cell: [9, 9] },
  { id: 'e9', type: 'ddos', cell: [5, 10] },
];

// The friendly crew, in the safe corners: they stand still and talk (strings in the locales)
export const NPCS = [
  { id: 'sysadmin', cell: [25, 8], color: 'info' },
  { id: 'architect', cell: [31, 1], color: 'success' },
  { id: 'network', cell: [6, 9], color: 'tertiary' },
];

// The Skills hall's floating tech icons: one per technology, six to a row (rows 2 and 3)
export const ICON_Y = 0.62;
export const iconSpot = (i) => [24.5 + (i % 6) * 1.2, ICON_Y, i < 6 ? 2.5 : 3.5];

// The weapons (their pixel art is in GameHud.jsx, their names in the locales), each with its own
// shot: `cooldown` (s) between shots, `auto` fires while held, `cone` (radians) hits every
// threat in it instead of the one in the crosshair; `energy` is what a shot costs (of 100, refilled
// shortly after the last shot); `shake` and `kick` scale the screen shake and
// the weapon's recoil; `fx` is the particle effect (Enemies.jsx), `sound` the sfx.js voice
export const WEAPON_FX = [
  // Kubernetes Kar98k: one heavy shot, a blue trail to the target
  { cooldown: 0.9, energy: 30, shake: 1, kick: 1, fx: 'trail', sound: 'sniper' },
  // Terraform Tactical: rapid fire, green infrastructure blocks where it lands
  {
    cooldown: 0.15,
    auto: true,
    energy: 7,
    shake: 0.2,
    kick: 0.35,
    fx: 'blocks',
    sound: 'provision',
  },
  // The DevOps Defender: a wide blast, an orange radial burst
  {
    cooldown: 0.6,
    cone: 0.22,
    range: 6,
    energy: 40,
    shake: 0.55,
    kick: 0.7,
    fx: 'radial',
    sound: 'thud',
  },
];
export const WEAPON_COUNT = WEAPON_FX.length;

// Game Mode's facility set dressing (Facility.jsx), on map.cub's grid and kept off the ways
// through the rooms. Positions are world (x, z); racks and crates block the way (PROP_BOXES)

// Each room's light and neon color, as theme tokens
export const ROOM_ACCENT = {
  about: 'primary',
  skills: 'info',
  projects: 'danger',
  contact: 'success',
};

// Server racks against the Skills hall's north and south walls: [x, z, yaw] (yaw 0 faces south)
export const RACKS = [
  ...[20.55, 21.5, 22.45, 23.4, 28.4, 29.35].map((x) => [x, 1.16, 0]),
  ...[21.55, 22.5, 23.45, 24.4, 27.6, 28.55, 29.5, 30.45].map((x) => [x, 4.84, Math.PI]),
];
export const RACK_SIZE = [0.9, 0.92, 0.3];

// Supply crates in the corners of the comms hall and the Skills hall: [x, z, size]
export const CRATES = [
  [1.45, 10.55, 0.45],
  [2.5, 8.3, 0.4],
  [7.55, 10.6, 0.4],
  [15.5, 9.55, 0.45],
  [31.55, 4.5, 0.38],
];

// The boxes that block movement: [x0, z0, x1, z1]
export const PROP_BOXES = [
  ...RACKS.map(([x, z]) => [
    x - RACK_SIZE[0] / 2,
    z - RACK_SIZE[2] / 2,
    x + RACK_SIZE[0] / 2,
    z + RACK_SIZE[2] / 2,
  ]),
  ...CRATES.map(([x, z, s]) => [x - s / 2, z - s / 2, x + s / 2, z + s / 2]),
];

// The vault's laser grid, across the mouth of the Projects room's south pocket (z = 5)
export const LASER_GRID = { z: 5, x0: 12, x1: 17, heights: [0.16, 0.36, 0.56, 0.76], posts: 5 };

// The command hub's holographic projection, in the About block
export const HOLOGRAM = [20.5, 9];

// Ceiling lamps: [x, z, flickers]
export const LAMPS = [
  [26.5, 9.5, false],
  [26.5, 6.5, true],
  [22.5, 8.5, false],
  [23.5, 2.5, false],
  [29, 3, true],
  [14, 2.5, false],
  [9.5, 2.5, true],
  [4, 9, false],
  [11, 9.5, true],
];

// One dim colored fill light per room (the flashlight is the only shadow caster): [x, z, room]
export const ROOM_LIGHTS = [
  [24.5, 9, 'about'],
  [25.5, 2.8, 'skills'],
  [14, 2.6, 'projects'],
  [6, 9.5, 'contact'],
];

// Cables sagging from the ceiling: [x0, z0, x1, z1, lowest y]
export const CABLES = [
  [20.5, 2, 30.5, 2.2, 0.8],
  [21, 3.7, 29.5, 3.5, 0.84],
  [26.5, 6, 26.5, 11, 0.86],
  [1.5, 8.8, 14.5, 9.2, 0.82],
  [10, 1.5, 17, 1.8, 0.84],
];
