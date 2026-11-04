// The card under the pointer and where the pointer is, in the viewport: written by useSpotlight,
// read in the frame loop by the tech balls, which lean toward it. Plain module state, so a pointer
// move re-renders nothing and asks for no frame, and the page chunks gain no three.js
export const pointerCard = { card: null, x: 0, y: 0 };

export const setPointerCard = (card) => {
  pointerCard.card = card;
};

export const setPointerAt = (x, y) => {
  pointerCard.x = x;
  pointerCard.y = y;
};
