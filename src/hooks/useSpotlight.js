import { useEffect } from 'react';

// The cards that light up under the pointer: any [data-spotlight] element, and the timeline's
// cards, which the library renders without a way to add an attribute
const CARDS = '[data-spotlight], .vertical-timeline-element-content';

/**
 * The cards' cursor spotlight (the .spotlight layer in index.css). One pointermove listener for the
 * whole page writes the pointer's position inside the card under it as --mx/--my, at most once a
 * frame, and marks that card data-lit. No React state, so moving the pointer re-renders nothing.
 * Only for a mouse or pen that can hover: a touch has no pointer to follow.
 */
export function useSpotlight() {
  useEffect(() => {
    const hover = window.matchMedia('(hover: hover) and (pointer: fine)');
    let lit = null;
    let last = null;
    let frame = 0;

    const light = (card) => {
      if (card === lit) return;
      lit?.removeAttribute('data-lit');
      card?.setAttribute('data-lit', '');
      lit = card;
    };
    const draw = () => {
      frame = 0;
      const card = last.target instanceof Element ? last.target.closest(CARDS) : null;
      light(card);
      if (!card) return;
      const box = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${last.clientX - box.left}px`);
      card.style.setProperty('--my', `${last.clientY - box.top}px`);
    };
    const onMove = (e) => {
      if (e.pointerType === 'touch') return;
      last = e;
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const onLeave = () => light(null);

    let on = false;
    const sync = () => {
      if (hover.matches === on) return;
      on = hover.matches;
      if (on) {
        document.addEventListener('pointermove', onMove, { passive: true });
        document.documentElement.addEventListener('pointerleave', onLeave);
      } else {
        document.removeEventListener('pointermove', onMove);
        document.documentElement.removeEventListener('pointerleave', onLeave);
        onLeave();
      }
    };
    sync();
    hover.addEventListener('change', sync);
    return () => {
      hover.removeEventListener('change', sync);
      document.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      if (frame) cancelAnimationFrame(frame);
      onLeave();
    };
  }, []);
}
