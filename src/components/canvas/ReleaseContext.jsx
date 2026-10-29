import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

/**
 * Drops the Canvas's WebGL context as soon as its tree unmounts. R3F 8 only does it 500 ms after
 * unmount, so a demo closing while the page Canvas comes back would briefly hold two contexts.
 * Used inside every Canvas: the page's, the live demos' and Game Mode's.
 */
const ReleaseContext = () => {
  const gl = useThree((state) => state.gl);
  useEffect(() => () => gl.forceContextLoss(), [gl]);
  return null;
};

export default ReleaseContext;
