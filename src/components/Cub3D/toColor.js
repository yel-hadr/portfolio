import { Color } from 'three';

// three's Color parses 'rgb(r,g,b)', not the 'R G B' channels the theme tokens hold
// (readTheme in src/utils/themeColors.js). `k` scales it, past 1 for what should bloom. Kept out
// of themeColors.js, which DOM components import: three must stay in the lazy 3D chunks
export const toColor = (channels, k = 1) =>
  new Color(`rgb(${channels.split(' ').join(',')})`).multiplyScalar(k);
