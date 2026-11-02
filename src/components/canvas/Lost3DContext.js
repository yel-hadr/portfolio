import { createContext } from 'react';

// Whether the page's WebGL context is lost right now (the GPU dropped it, as phones do under
// memory pressure). App provides it from Scene3D's context events; while it is true, SceneView
// shows its static fallback (the balls' logos, the flat globe) instead of an empty box, and the
// scenes come back when the context is restored.
export const Lost3DContext = createContext(false);
