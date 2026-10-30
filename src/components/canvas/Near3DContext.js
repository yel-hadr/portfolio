import { createContext } from 'react';

// True once the page's 3D layer mounts (App: the Tech section is within a viewport of the
// screen). SceneView loads its 3D half only then, so three.js and R3F are not fetched with the
// first screen. Plain React, so DOM components can read it
export const Near3DContext = createContext(true);
