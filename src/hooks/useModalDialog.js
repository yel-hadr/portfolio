import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * Shared behavior of the portal dialogs (ArchitectureModal, GameMenu). While mounted, the rest of
 * the page is inert and does not scroll; Tab cycles inside the panel; Escape, `close()` and a
 * backdrop click close it. Closing releases the page before calling onClose, so the opener can
 * take focus again. The dialog renders into document.body, because an ancestor transform or
 * backdrop-filter would otherwise trap `fixed`.
 *
 * Returns refs for the overlay and the panel, `close`, `release` (lets the page go without
 * closing, when the dialog hands over to another one), the panel's `onKeyDown` and the overlay's
 * `backdrop` handlers. `canClose`, if given, is asked first: while it says no, `close()` (and so
 * Escape and the backdrop) does nothing, and the page stays inert.
 */
export const useModalDialog = (onClose, canClose) => {
  const overlayRef = useRef(null);
  const panelRef = useRef(null);
  const pressedOnBackdrop = useRef(false);
  // Undoes the scroll lock and inert
  const releaseRef = useRef(() => {});

  useEffect(() => {
    const root = document.documentElement;
    const { body } = document;
    const prevOverflow = root.style.overflow;
    const prevPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - root.clientWidth;
    root.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    const madeInert = [...body.children].filter(
      (el) => el !== overlayRef.current && !el.inert && el.tagName !== 'SCRIPT'
    );
    madeInert.forEach((el) => (el.inert = true));

    let done = false;
    releaseRef.current = () => {
      if (done) return;
      done = true;
      root.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
      madeInert.forEach((el) => (el.inert = false));
    };
    return () => releaseRef.current();
  }, []);

  // Stable across renders through the React Compiler (no useCallback)
  const release = () => releaseRef.current();

  const close = () => {
    if (canClose && !canClose()) return;
    releaseRef.current();
    onClose();
  };

  const onKeyDown = (e) => {
    // Keys typed in the dialog never reach page-level shortcuts (Ctrl+` for the terminal)
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      // A held Escape repeats: only the press closes (holding it in the game opened Pause and
      // closed it again)
      if (!e.repeat) close();
      return;
    }
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = [...panel.querySelectorAll(FOCUSABLE)].filter(
      (el) => el.getClientRects().length > 0
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const current = document.activeElement;
    // Focus anywhere but on a control (the panel itself on open or after a click on a
    // non-interactive part, or a focusable body such as a dossier's scroller) counts as outside the
    // cycle: Tab enters at the start, Shift+Tab at the end
    const outside = !items.includes(current);
    if (e.shiftKey && (current === first || outside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (current === last || outside)) {
      e.preventDefault();
      first.focus();
    }
  };

  // Close only when the press both starts and ends on the backdrop (not a text-selection drag)
  const backdrop = {
    onMouseDown: (e) => {
      pressedOnBackdrop.current = e.target === e.currentTarget;
    },
    onClick: (e) => {
      if (pressedOnBackdrop.current && e.target === e.currentTarget) close();
    },
  };

  return { overlayRef, panelRef, close, release, onKeyDown, backdrop };
};
