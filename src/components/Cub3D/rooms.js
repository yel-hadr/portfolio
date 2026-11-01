// Game Mode's "DevOps Command Center": its own map (gameMap.js), six rooms in the order of the
// portfolio's story, each holding one section of the profile on a wall terminal. Pure data. Cells
// are (x, z) as in map.js; a panel sits 0.02 off a wall face, turned to face the room (yaw 0 faces
// +z, PI faces -z, PI/2 faces +x, -PI/2 faces -x).

// The story's sections, in order: one room and one wall terminal each
export const SECTIONS = ['about', 'skills', 'projects', 'experience', 'education', 'contact'];

// Rooms as cell rectangles [x0, z0, x1, z1] (inclusive), each with the corridor beyond its door
export const ROOMS = [
  // Each shortcut corridor splits as Projects' does: the door's row and the one below belong to the
  // room south of it, the row above to the room north, so the door joins two rooms
  {
    id: 'about',
    rects: [
      [1, 10, 13, 15],
      [2, 8, 3, 9],
    ],
  },
  { id: 'skills', rects: [[14, 10, 29, 15]] },
  {
    id: 'projects',
    rects: [
      [30, 10, 43, 15],
      [36, 8, 37, 9],
    ],
  },
  {
    id: 'experience',
    rects: [[27, 1, 43, 7]],
  },
  { id: 'education', rects: [[12, 1, 26, 6]] },
  {
    id: 'contact',
    rects: [
      [1, 1, 11, 6],
      [2, 7, 3, 7],
    ],
  },
];

export const roomAt = (x, z) =>
  ROOMS.find(({ rects }) =>
    rects.some(([x0, z0, x1, z1]) => x >= x0 && x < x1 + 1 && z >= z0 && z < z1 + 1)
  )?.id ?? null;

// kind: 'section' opens that section of the profile (the mission counts them), 'terminal' a
// live demo. Each section's terminal faces the way into its room
export const GAME_PANELS = [
  { id: 'about', kind: 'section', position: [6.5, 0.55, 10.02], yaw: 0 },
  { id: 'skills', kind: 'section', position: [21.5, 0.55, 10.02], yaw: 0 },
  { id: 'projects', kind: 'section', position: [43.98, 0.55, 12.5], yaw: -Math.PI / 2 },
  { id: 'cub3d', kind: 'terminal', position: [39.5, 0.55, 15.98], yaw: Math.PI },
  { id: 'fdf', kind: 'terminal', position: [41.5, 0.55, 15.98], yaw: Math.PI },
  { id: 'experience', kind: 'section', position: [37, 0.55, 1.02], yaw: 0 },
  { id: 'education', kind: 'section', position: [19.5, 0.55, 1.02], yaw: 0 },
  { id: 'contact', kind: 'section', position: [1.02, 0.55, 3.5], yaw: Math.PI / 2 },
];

// The threat types: `color` is the theme token they glow in, `speed` (cells per second) how fast
// they drift toward the player once in sight. `harm`: this close they wear integrity down. A
// Memory Leak does no harm and stays where it is, but `slows` the player near it (a hazard to walk
// round); a Zero-Day is `stealth`: unseen (and out of the crosshair) unless the flashlight's beam
// is on it
export const THREAT_TYPES = {
  ddos: { color: 'danger', speed: 0.6, harm: true },
  sql: { color: 'success', speed: 0.6, harm: true },
  memleak: { color: 'secondary', speed: 0, harm: false, slows: true },
  zeroday: { color: 'foreground', speed: 0.6, harm: true, stealth: true },
};
// cells: threats hover this far from the player, and wear integrity down this close. A threat in
// reach is also in reach of a shot, even against a rack or a crate (point-blank)
export const THREAT_STOP = 1.2;
export const THREAT_REACH = THREAT_STOP + 0.35;
// cells: a Memory Leak slows the player this close (Enemies.jsx), and the lit path keeps this far
// from a live one (Cub3DWorld.jsx)
export const SLOW_RANGE = 2.5;

// Threats just past the chain's doors: each has one on its far side, in the next room's entry (e4
// in Projects', e8 in Education's, away from the crew there). None in the spawn room (About).
// The Memory Leak (e5) sits by Projects' south wall, 3 cells or more from every terminal; no
// cell in that room is clear of every route through it, so the lit path steers round its pull
// (SLOW_RANGE) while it is alive. Each carries its own fact (`fact`: demos.game.facts.<fact> in
// the locales), shown when it is neutralized
export const ENEMIES = [
  { id: 'e1', type: 'ddos', cell: [14, 13], fact: 'helm' },
  { id: 'e2', type: 'sql', cell: [19, 13], fact: 'tenants' },
  { id: 'e3', type: 'ddos', cell: [24, 11], fact: 'argocd' },
  { id: 'e4', type: 'sql', cell: [30, 12], fact: 'ansible' },
  { id: 'e5', type: 'memleak', cell: [36, 15], fact: 'observability' },
  { id: 'e6', type: 'sql', cell: [34, 4], fact: 'terraform' },
  { id: 'e7', type: 'zeroday', cell: [41, 3], fact: 'falco' },
  { id: 'e8', type: 'sql', cell: [26, 4], fact: 'pgbouncer' },
  { id: 'e9', type: 'ddos', cell: [10, 3], fact: 'traefik' },
];

// The friendly crew, in the safe rooms: they stand still, share a fact and point the way on
// (strings in the locales)
export const NPCS = [
  { id: 'sysadmin', cell: [9, 11], color: 'info' },
  { id: 'architect', cell: [33, 14], color: 'success' },
  { id: 'network', cell: [19, 5], color: 'tertiary' },
];

// The Skills hall's floating tech icons: one per technology, six to a row, either side of the way
// through the hall
export const ICON_Y = 0.62;
export const iconSpot = (i) => [17 + (i % 6) * 1.8, ICON_Y, i < 6 ? 11.4 : 13.6];

// The weapons (their pixel art is in GameHud.jsx, their names in the locales), each with its own
// shot: `cooldown` (s) between shots, `auto` fires while held, `range` (cells) how far a shot
// reaches, `cone` (radians) hits every threat in it instead of the one in the crosshair; `energy`
// is what a shot costs (of 100, refilled shortly after the last shot); `shake` and `kick` scale the
// screen shake and the weapon's recoil; `fx` is the particle effect (Enemies.jsx), `sound` the
// sfx.js voice; `shell`: each shot throws a spent shell from the ejection port (Viewmodel.jsx). Every hit neutralizes: the weapons differ in reach and spread
export const WEAPON_FX = [
  // Kubernetes Kar98k, the rifle: one heavy shot that reaches past a threat's sight, a blue trail
  {
    cooldown: 0.9,
    range: 14,
    energy: 30,
    shake: 1,
    kick: 1,
    fx: 'trail',
    sound: 'sniper',
    shell: true,
  },
  // Terraform Tactical, the pistol: rapid fire at short range, green blocks where it lands
  {
    cooldown: 0.15,
    auto: true,
    range: 6,
    energy: 7,
    shake: 0.2,
    kick: 0.35,
    fx: 'blocks',
    sound: 'provision',
    shell: true,
  },
  // The DevOps Defender, the blaster: a wide blast hitting every threat in its cone, an orange
  // radial burst; three to a full charge
  {
    cooldown: 0.6,
    cone: 0.3,
    range: 6,
    energy: 33,
    shake: 0.55,
    kick: 0.7,
    fx: 'radial',
    sound: 'thud',
  },
];
export const WEAPON_COUNT = WEAPON_FX.length;

// The kit grows as the profile is read: the rifle from the start, the section that unlocks each
// other weapon (by index), and the section that hardens integrity (its maximum, from 100)
export const WEAPON_UNLOCKS = [null, 'skills', 'projects'];
export const weaponOpen = (read, w) => !WEAPON_UNLOCKS[w] || read.includes(WEAPON_UNLOCKS[w]);
export const HARDENED_BY = 'experience';
export const HARDENED_MAX = 150;
export const maxIntegrity = (read) => (read.includes(HARDENED_BY) ? HARDENED_MAX : 100);

// The mission's grade: S for every threat neutralized with 60% accuracy in under 6 minutes of play,
// A for two thirds of them with 40% in under 10, B otherwise. `rank` orders them for the best kept
export const GRADES = [
  { grade: 'S', rank: 3, kills: 1, accuracy: 0.6, minutes: 6 },
  { grade: 'A', rank: 2, kills: 2 / 3, accuracy: 0.4, minutes: 10 },
];
export const gradeOf = ({ time, kills, threats, shots }) => {
  const accuracy = shots.fired ? shots.hit / shots.fired : 0;
  const met = GRADES.find(
    (g) => kills / threats >= g.kills - 1e-9 && accuracy >= g.accuracy && time <= g.minutes * 60000
  );
  return met ?? { grade: 'B', rank: 1 };
};
export const GRADE_BY_RANK = { 3: 'S', 2: 'A', 1: 'B' };

// Game Mode's facility set dressing (Facility.jsx), kept off the ways through the rooms. Positions
// are world (x, z); racks and crates block the way (PROP_BOXES)

// Each room's light and neon color, as theme tokens
export const ROOM_ACCENT = {
  about: 'primary',
  skills: 'info',
  projects: 'danger',
  experience: 'secondary',
  education: 'tertiary',
  contact: 'success',
};

// Server racks along the Skills hall's walls, clear of its terminal: [x, z, yaw] (yaw 0 faces
// south)
export const RACKS = [
  ...[16.5, 17.45, 18.4, 24.6, 25.55, 26.5].map((x) => [x, 10.16, 0]),
  ...[16.5, 17.45, 18.4, 19.35, 20.3, 22.7, 23.65, 24.6, 25.55, 26.5].map((x) => [
    x,
    15.84,
    Math.PI,
  ]),
];
export const RACK_SIZE = [0.9, 0.92, 0.3];

// Supply crates in room corners, off the ways through: [x, z, size]
export const CRATES = [
  [1.5, 15.5, 0.45],
  [2.45, 15.55, 0.38],
  [31.55, 10.55, 0.42],
  [42.5, 10.55, 0.45],
  [42.45, 5.5, 0.4],
  [13.5, 5.5, 0.42],
  [8.5, 1.5, 0.4],
  [1.5, 5.5, 0.45],
];

// The boxes that block movement: [x0, z0, x1, z1]
// The command hub's holographic projection, in the About room
export const HOLOGRAM = [3.5, 12];
// Its base, as wide as its ring: solid like a rack, so it cannot be walked through
const HUB_HALF = 0.35;

export const PROP_BOXES = [
  ...RACKS.map(([x, z]) => [
    x - RACK_SIZE[0] / 2,
    z - RACK_SIZE[2] / 2,
    x + RACK_SIZE[0] / 2,
    z + RACK_SIZE[2] / 2,
  ]),
  ...CRATES.map(([x, z, s]) => [x - s / 2, z - s / 2, x + s / 2, z + s / 2]),
  [HOLOGRAM[0] - HUB_HALF, HOLOGRAM[1] - HUB_HALF, HOLOGRAM[0] + HUB_HALF, HOLOGRAM[1] + HUB_HALF],
];

// The vault's laser grid, in front of the Projects room's two live-demo terminals (it can be
// walked through)
export const LASER_GRID = {
  z: 14.2,
  x0: 38.6,
  x1: 44,
  heights: [0.16, 0.36, 0.56, 0.76],
  posts: 5,
};

// The hub answers like a wall terminal (Press E, then its own dossier: the briefing, the mission's
// progress, the controls), but it stands in the room: the crosshair finds it by its distance from
// the view's center line, as the crew (`radius` in cells, a little wider than the globe), or
// within a cone of about 30° (`cone`: the distance off the line per cell along it), so it answers
// whenever it is roughly in front of the player, not only dead center
export const HUB = {
  id: 'hub',
  kind: 'hub',
  x: HOLOGRAM[0],
  z: HOLOGRAM[1],
  radius: 0.45,
  cone: 0.6,
};

// Walking speed, cells per second (the original cub3D: SPEED 4 of a 64-unit cell per frame). The
// weapon's bob follows the speed the player actually moves at (Enemies.jsx)
export const MOVE_SPEED = 3;

// Ceiling lamps: [x, z, flickers]
export const LAMPS = [
  [6.5, 12.5, false],
  [12.5, 13, true],
  [18.5, 12.5, false],
  [24.5, 12.5, false],
  [29, 12.5, true],
  [37, 12.5, false],
  [36.5, 8, true],
  [36.5, 3.5, false],
  [27, 3.5, true],
  [19.5, 3.5, false],
  [11, 3.5, true],
  [5, 3.5, false],
];

// One dim colored fill light per room (the flashlight is the only shadow caster): [x, z, room]
export const ROOM_LIGHTS = [
  [6, 12.5, 'about'],
  [21, 12.5, 'skills'],
  [37, 12.5, 'projects'],
  [36, 3.5, 'experience'],
  [19, 3.5, 'education'],
  [5, 3.5, 'contact'],
];

// Cables sagging from the ceiling: [x0, z0, x1, z1, lowest y]
export const CABLES = [
  [15.5, 11, 27.5, 11.2, 0.82],
  [16, 14.4, 27, 14.2, 0.84],
  [31.5, 10.8, 43, 11, 0.84],
  [29.5, 2, 43, 2.2, 0.82],
  [13.5, 5, 25, 5.2, 0.84],
  [2, 12, 11, 11.8, 0.86],
];
