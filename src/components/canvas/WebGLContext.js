import { createContext } from 'react';

// Whether this browser can render the 3D layer (WebGL2). App provides it; SceneView reads it
// to render its static fallback instead of a 3D view when it is false.
export const WebGLContext = createContext(true);
