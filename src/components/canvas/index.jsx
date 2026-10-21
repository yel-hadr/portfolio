import { lazy } from 'react';

import SceneView from './SceneView';

// Scenes render inside the single shared Canvas (Scene3D): place a <SceneView> in the page
// layout and pass the scene as its child. Scenes and the Canvas are lazy chunks, so the
// first paint does not wait for three.js / R3F / drei.
const Ball = lazy(() => import('./Ball'));
const Computers = lazy(() => import('./Computers'));
const Earth = lazy(() => import('./Earth'));
const Stars = lazy(() => import('./Stars'));
const Scene3D = lazy(() => import('./Scene3D'));

export { Ball, Computers, Earth, SceneView, Scene3D, Stars };
