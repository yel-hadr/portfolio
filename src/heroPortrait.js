// The hero portrait's `sizes`, one value for the <img> (Hero.jsx) and the build's preload of it
// (build/preloadPortrait.js): the two must ask for the same file. Pure data, so Node imports it.
// 304px from lg, 176px from md, 192px from sm, 144px on a phone
export const PORTRAIT_SIZES =
  '(min-width: 1024px) 304px, (min-width: 768px) 176px, (min-width: 640px) 192px, 144px';
