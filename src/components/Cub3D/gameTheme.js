import { readTheme } from '../../utils/themeColors';

// Game Mode is a dark island in either theme (.scheme-dark on its root, GameMode.jsx): its HUD
// classes, and the 3D world's colors read here, take the dark tokens even on the light page
export const GAME_ROOT = '[data-game-mode]';

/** readTheme, from Game Mode's root when it is open (else the page) */
export const readGameTheme = (names) =>
  readTheme(names, document.querySelector(GAME_ROOT) ?? document.documentElement);
