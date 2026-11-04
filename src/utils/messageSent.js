// A contact message went through: ContactForm says so, and the Contact globe answers with a pulse
// along its arcs. Plain module state, so the form needs no three.js; with no globe mounted (Game
// Mode's form, a screen without 3D) nobody is listening
const listeners = new Set();

export const notifyMessageSent = () => {
  for (const listener of listeners) listener();
};

export const onMessageSent = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
