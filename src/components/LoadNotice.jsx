import { useEffect, useState } from 'react';

import { useI18n } from '../i18n/context';
import { onLoadFailure, onLoadNoticeClear } from '../utils/loadNotice';

// At least this long on screen; after it, the visitor's next action takes it down (no time limit
// on reading it)
const SHOWN_MS = 6000;
// A focused control this close to the bottom would sit under the chip: it goes to the top then
const BOTTOM_ROOM = 120;

/**
 * Says that a dialog could not load (the terminal, a demo...): a status message, announced, and
 * a chip on screen. The live region is always mounted; each failure gets its own `n`, so even the
 * same message twice in a row is a new node and is read again. The chip never covers the control
 * that gets focus back (bottom, or top when that control is low on the screen), sits under the
 * dialogs (z-55: above the navbar's 50, below their 60), and goes as soon as one opens
 */
const LoadNotice = () => {
  const { t } = useI18n();
  // { key, n, top }
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    const offFailure = onLoadFailure((key) => {
      const box = document.activeElement?.getBoundingClientRect?.();
      const top = Boolean(box) && box.bottom > window.innerHeight - BOTTOM_ROOM;
      setNotice((prev) => ({ key, n: (prev?.n ?? 0) + 1, top }));
    });
    const offClear = onLoadNoticeClear(() => setNotice(null));
    return () => {
      offFailure();
      offClear();
    };
  }, []);

  // Shown for SHOWN_MS at least, then until the next pointer press or key
  useEffect(() => {
    if (!notice) return undefined;
    const hide = () => setNotice(null);
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', hide, { once: true });
      document.addEventListener('keydown', hide, { once: true });
    }, SHOWN_MS);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', hide);
      document.removeEventListener('keydown', hide);
    };
  }, [notice]);

  return (
    <div
      role='status'
      className={`pointer-events-none fixed inset-x-0 z-[55] flex justify-center px-4 ${notice?.top ? 'top-20' : 'bottom-6'}`}
    >
      {notice && (
        <p
          key={notice.n}
          className='max-w-md rounded-2xl border border-line bg-glass-strong px-4 py-3 text-center text-sm font-medium text-foreground shadow-raised backdrop-blur-xl'
        >
          {t(`errors.loadFailed.${notice.key}`)}
        </p>
      )}
    </div>
  );
};

export default LoadNotice;
