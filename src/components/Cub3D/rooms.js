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
// threat in it instead of the one in the crosshair; `shake` and `kick` scale the screen shake and
// the weapon's recoil; `fx` is the particle effect (Enemies.jsx), `sound` the sfx.js voice
export const WEAPON_FX = [
  // Kubernetes Kar98k: one heavy shot, a blue trail to the target
  { cooldown: 0.9, shake: 1, kick: 1, fx: 'trail', sound: 'sniper' },
  // Terraform Tactical: rapid fire, green infrastructure blocks where it lands
  { cooldown: 0.15, auto: true, shake: 0.2, kick: 0.35, fx: 'blocks', sound: 'provision' },
  // The DevOps Defender: a wide blast, an orange radial burst
  { cooldown: 0.6, cone: 0.22, range: 6, shake: 0.55, kick: 0.7, fx: 'radial', sound: 'thud' },
];
export const WEAPON_COUNT = WEAPON_FX.length;
