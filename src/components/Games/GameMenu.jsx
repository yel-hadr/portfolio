import { Suspense, lazy, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import './i18n';
import { gameStorage } from '../../constans';
import { useModalDialog } from '../../hooks/useModalDialog';
import { useI18n } from '../../i18n/context';
import { CloseIcon, TerminalIcon } from '../icons';
import { readBest } from './storage';

// Packet Snake is its own chunk, fetched when the visitor picks it
const PacketSnake = lazy(() => import('./PacketSnake'));

const PacketIcon = (props) => (
  <svg aria-hidden='true' viewBox='0 0 24 24' className='h-5 w-5' {...props}>
    <rect x='3' y='9' width='6' height='6' rx='1.5' className='fill-primary opacity-60' />
    <rect x='9' y='9' width='6' height='6' rx='1.5' className='fill-primary opacity-80' />
    <rect x='15' y='9' width='6' height='6' rx='1.5' className='fill-primary' />
  </svg>
);

const GAMES = [
  { id: 'snake', Icon: PacketIcon, storage: gameStorage.snake },
  { id: 'typing', Icon: TerminalIcon, storage: gameStorage.typing },
];
const readBests = () => Object.fromEntries(GAMES.map(({ id, storage }) => [id, readBest(storage)]));

/**
 * The games dialog, opened from the footer. It lists the games and plays Packet Snake in place;
 * "Terminal challenge" asks App to open the terminal on the challenge (`onPlayTerminal`).
 * useModalDialog makes the page inert, locks its scroll, traps Tab and closes on Escape, the
 * close button or a backdrop click. App restores focus in onClose.
 */
const GameMenu = ({ onClose, onPlayTerminal }) => {
  const { t } = useI18n();
  const [view, setView] = useState('menu');
  const titleId = useId();
  const descId = useId();
  const snakeButtonRef = useRef(null);
  const [bests, setBests] = useState(readBests);
  const { overlayRef, panelRef, close, release, onKeyDown, backdrop } = useModalDialog(onClose);

  // The first game takes focus on open, and again when the visitor comes back from it. The best
  // scores are read again then: a game left mid-way saves its score as it unmounts, after this
  // list has rendered
  useEffect(() => {
    if (view !== 'menu') return;
    setBests(readBests());
    snakeButtonRef.current?.focus();
  }, [view]);

  const pick = (id) => {
    if (id === 'snake') {
      // The picked button unmounts: keep focus in the dialog (and Escape working) while the game
      // loads
      panelRef.current?.focus();
      setView('snake');
      return;
    }
    release();
    onPlayTerminal();
  };

  const playing = view === 'snake';

  return createPortal(
    <div
      ref={overlayRef}
      className='fixed inset-0 z-[60] flex justify-center bg-background/75 backdrop-blur-sm sm:items-center sm:p-6'
      {...backdrop}
    >
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        aria-describedby={playing ? undefined : descId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`flex h-full w-full flex-col overflow-hidden bg-glass-strong shadow-2xl backdrop-blur-xl sm:h-auto sm:max-h-full sm:rounded-3xl sm:border sm:border-line ${
          playing ? 'sm:max-w-4xl' : 'sm:max-w-lg'
        }`}
      >
        <div className='flex items-center gap-3 border-b border-line px-4 py-3 sm:px-6 sm:py-4'>
          {playing && (
            <button
              type='button'
              onClick={() => setView('menu')}
              className='inline-flex h-11 shrink-0 items-center rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:border-foreground-muted'
            >
              {t('games.snake.back')}
            </button>
          )}
          <h2
            id={titleId}
            className='min-w-0 flex-1 text-xl font-black text-foreground sm:text-2xl'
          >
            {playing ? t('games.snake.title') : t('games.menu.title')}
          </h2>
          <button
            type='button'
            onClick={close}
            aria-label={t('games.menu.close')}
            className='inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-surface text-foreground transition-colors hover:border-foreground-muted'
          >
            <CloseIcon className='h-5 w-5' />
          </button>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6'>
          {playing ? (
            <Suspense
              fallback={
                <p role='status' className='text-sm text-foreground-muted'>
                  {t('games.menu.loading')}
                </p>
              }
            >
              <PacketSnake />
            </Suspense>
          ) : (
            <>
              <p id={descId} className='mb-4 text-sm leading-relaxed text-foreground-muted'>
                {t('games.menu.description')}
              </p>
              <ul className='space-y-2'>
                {GAMES.map(({ id, Icon }) => {
                  const best = bests[id];
                  return (
                    <li key={id}>
                      <button
                        ref={id === 'snake' ? snakeButtonRef : undefined}
                        type='button'
                        onClick={() => pick(id)}
                        className='flex w-full items-center gap-4 rounded-2xl border border-line p-4 text-left transition-colors hover:bg-surface-raised'
                      >
                        <span className='inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-foreground'>
                          <Icon />
                        </span>
                        <span className='min-w-0 flex-1'>
                          <span className='block font-semibold text-foreground'>
                            {t(`games.menu.${id}.name`)}
                          </span>
                          <span className='mt-0.5 block text-sm leading-snug text-foreground-muted'>
                            {t(`games.menu.${id}.description`)}
                          </span>
                          <span className='mt-1.5 block text-sm font-semibold tabular-nums text-foreground-muted'>
                            {best > 0
                              ? t('games.menu.best', { score: best })
                              : t('games.menu.noBest')}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GameMenu;
