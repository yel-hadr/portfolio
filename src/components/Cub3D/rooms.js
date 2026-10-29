// Game Mode's "DevOps Command Center": map.cub's grid, unchanged, read as four rooms. Pure data.
// Cells are (x, z) as in map.js; a panel sits 0.02 off a wall face, turned to face the room
// (yaw 0 faces +z, PI faces -z, PI/2 faces +x, -PI/2 faces -x).

// Rooms as cell rectangles [x0, z0, x1, z1] (inclusive); the first match wins
export const ROOMS = [
  // The south-east block around N, with the door
  { id: 'about', rect: [18, 6, 28, 13] },
  // The north-east hall
  { id: 'skills', rect: [20, 0, 32, 5] },
  // The north-west room with its pillars
  { id: 'projects', rect: [9, 0, 19, 6] },
  // The west hall
  { id: 'contact', rect: [0, 5, 17, 13] },
];

export const roomAt = (x, z) =>
  ROOMS.find(
    ({ rect: [x0, z0, x1, z1] }) => x >= x0 && x <= x1 + 0.999 && z >= z0 && z <= z1 + 0.999
  )?.id ?? null;

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

// Threats in the hallways: one sprite each, drifting toward the player once in sight
export const ENEMIES = [
  { id: 'e1', type: 'ddos', cell: [26, 5] },
  { id: 'e2', type: 'sql', cell: [20, 6] },
  { id: 'e3', type: 'ddos', cell: [29, 2] },
  { id: 'e4', type: 'sql', cell: [14, 3] },
  { id: 'e5', type: 'ddos', cell: [4, 6] },
  { id: 'e6', type: 'sql', cell: [9, 9] },
];

// The Skills hall's floating tech icons: one per technology, six to a row (rows 2 and 3)
export const ICON_Y = 0.62;
export const iconSpot = (i) => [24.5 + (i % 6) * 1.2, ICON_Y, i < 6 ? 2.5 : 3.5];

// The weapons (their pixel art is in GameHud.jsx, their names in the locales)
export const WEAPON_COUNT = 3;
