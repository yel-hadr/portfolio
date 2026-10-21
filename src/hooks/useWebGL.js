import { useState } from 'react';
import { isWebGLAvailable } from '../utils/webgl';

/**
 * Reports whether WebGL is supported. The check is synchronous and cached,
 * so there is no loading state and no extra WebGL context per caller.
 * @returns {{ supported: boolean }}
 */
export const useWebGL = () => {
  const [supported] = useState(isWebGLAvailable);
  return { supported };
};

export default useWebGL;
