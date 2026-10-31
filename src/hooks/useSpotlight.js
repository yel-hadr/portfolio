import { useEffect } from 'react';

// The cards that light up under the pointer: any [data-spotlight] element, and the timeline's
// cards, which the library renders without a way to add an attribute
const CARDS = '[data-spotlight], .vertical-timeline-element-content';

/**
 * The cards' cursor spotlight (the .spotlight layer in index.css). One pointermove listener for the
 * whole page writes the pointer's position inside the card under it as --mx/--my, at most once a
 * frame, and marks that card data-lit; a scroll does the same, since the cards move under a still
 * pointer. No React state, so moving the pointer re-renders nothing.
 * Only for a mouse or pen that can hover: a touch has no pointer to follow.
 */
export function useSpotlight() {
  useEffect(() => {
    const hover = window.matchMedia('(hover: hover) and (pointer: fine)');
    let lit = null;
    // The pointer's last position, in the viewport
    let px = -1;
    let py = -1;
    let frame = 0;
    // The card under the pointer, from the pointer event's own hit test; null after a scroll,
    // which moves the cards under a still pointer, so the next frame hit-tests again
    let target = null;

    const light = (card) => {
      if (card === lit) return;
      lit?.removeAttribute('data-lit');
      card?.setAttribute('data-lit', '');
      lit = card;
    };
    const draw = () => {
      frame = 0;
      // What is under the pointer now (the 3D layer and the grain let the pointer through)
      const card = target ?? document.elementFromPoint(px, py)?.closest(CARDS) ?? null;
      target = null;
      light(card);
      if (!card) return;
      const box = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${px - box.left}px`);
      card.style.setProperty('--my', `${py - box.top}px`);
    };
    const schedule = () => {
      if (px >= 0 && !frame) frame = requestAnimationFrame(draw);
    };
    const onMove = (e) => {
      if (e.pointerType === 'touch') return;
      px = e.clientX;
      py = e.clientY;
      const card = e.target.closest?.(CARDS) ?? null;
      // Off every card (a dialog, Game Mode, the gaps between cards): no frame at all
      if (!card) {
        light(null);
        return;
      }
      target = card;
      schedule();
    };
    const onScroll = () => {
      target = null;
      schedule();
    };
    const onLeave = () => {
      px = -1;
      light(null);
    };

    let on = false;
    const sync = () => {
      if (hover.matches === on) return;
      on = hover.matches;
      if (on) {
        document.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('scroll', onScroll, { passive: true });
        document.documentElement.addEventListener('pointerleave', onLeave);
      } else {
        document.removeEventListener('pointermove', onMove);
        window.removeEventListener('scroll', onScroll);
        document.documentElement.removeEventListener('pointerleave', onLeave);
        onLeave();
      }
    };
    sync();
    hover.addEventListener('change', sync);
    return () => {
      hover.removeEventListener('change', sync);
      document.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      if (frame) cancelAnimationFrame(frame);
      onLeave();
    };
  }, []);
}
