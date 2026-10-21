let cached;

/**
 * Checks once whether WebGL2 is available and caches the answer. three.js >= r163 renders
 * with WebGL2 only, so a WebGL1-only browser must get the fallback page.
 * The probe context is released immediately so it never counts toward the
 * browser's limit of active WebGL contexts (~16 in Chrome).
 * @returns {boolean} True if WebGL is supported, false otherwise.
 */
export const isWebGLAvailable = () => {
  if (cached !== undefined) return cached;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    cached = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
};
