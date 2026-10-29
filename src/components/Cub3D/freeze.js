// A kill's freeze frame: Cub3DWorld sets `hitStop.current` to when it ends, and the world's
// frame loops (movement, threats, particles, the weapon's motion) run with no time passing until
// then. Kept out of the components' files, which React Fast Refresh wants to export components only
export const HIT_STOP_MS = 200;

/** True during a kill's freeze frame: the world stands still */
export const frozen = (hitStop) => !!hitStop && performance.now() < hitStop.current;
