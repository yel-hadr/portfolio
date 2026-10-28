import { createContext } from 'react';

// Pauses the page's shared 3D layer. A live demo (cub3D, FdF) needs its own Canvas inside its
// dialog; DemoShell calls pause(true) while it is open, so App unmounts the page Canvas (inert
// and hidden behind the dialog anyway) and the page never holds two WebGL contexts at once.
export const PageCanvasContext = createContext(() => {});
