import { memo, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

import { useModalDialog } from '../../hooks/useModalDialog';
import { styles } from '../../styles';

// Game Mode's heads-up display over the cub3D view: crosshair, weapon, status bar, the sound and
// exit buttons, and the dialog a wall opens into. Everything is DOM over the canvas, so none of
// it costs a WebGL draw.

// The three weapons, seen from behind as in a 90s shooter: 18 columns of pixels, one letter per
// color ('.' is empty). Gloved hands grip each one; the bottom rows run off the screen edge.
const WEAPONS = [
  // Kubernetes Kar98k: a long barrel with a scope over a wooden stock
  [
    '........oo........',
    '.......oBBo.......',
    '.......oBho.......',
    '.......oBBo.......',
    '......oSSSSo......',
    '......oSLLSo......',
    '......oSSSSo......',
    '.......oBBo.......',
    '......oWWWWo......',
    '.....oWWWWWWo.....',
    '....oWWWWWWWWo....',
    '...oGGWWWWWWGGo...',
    '..oGGGGWWWWGGGGo..',
    '..oGgGGoWWoGGgGo..',
    '.oGGGGGoWWoGGGGGo.',
    '.oGGGGGo..oGGGGGo.',
  ],
  // Terraform Tactical: a compact pistol
  [
    '..................',
    '..................',
    '..................',
    '.......oooo.......',
    '......oBBBBo......',
    '......oBhBBo......',
    '......oBBBBo......',
    '......oBBBBo......',
    '.....oRRRRRRo.....',
    '....oGGGGGGGGo....',
    '...oGGgGGgGGgGo...',
    '...oGGGGGGGGGGo...',
    '..oGGGGGGGGGGGGo..',
    '..oGGGGGGGGGGGGo..',
    '...oCCCCCCCCCCo...',
    '...oCCCCCCCCCCo...',
  ],
  // The DevOps Defender: a blaster with a glowing core
  [
    '..................',
    '......oooooo......',
    '.....oLLLLLLo.....',
    '....oRBBBBBBRo....',
    '....oBBLLLLBBo....',
    '....oBBLhhLBBo....',
    '....oBBLLLLBBo....',
    '.....oBBBBBBo.....',
    '.....oRRRRRRo.....',
    '...ooGGGGGGGGoo...',
    '..oGGgGGgGGgGGGo..',
    '..oGGGGGGGGGGGGo..',
    '..oGGGGGGGGGGGGo..',
    '...oGGGGGGGGGGo...',
    '...oCCCCCCCCCCo...',
    '...oCCCCCCCCCCo...',
  ],
];
const FILLS = {
  o: 'fill-background',
  L: 'fill-info',
  h: 'fill-foreground',
  R: 'fill-primary',
  B: 'fill-foreground-muted',
  S: 'fill-surface-raised',
  W: 'fill-primary-hover',
  G: 'fill-secondary',
  g: 'fill-tertiary',
  C: 'fill-primary',
};
// One rect per run of same-colored pixels in a row
const toPixels = (rows) =>
  rows.flatMap((row, y) =>
    [...row.matchAll(/([^.])\1*/g)].map((run) => ({ x: run.index, y, w: run[0].length, c: run[1] }))
  );
const PIXELS = WEAPONS.map(toPixels);

// The crosshair: a cross, or corner brackets while something is in the sights
const CROSS = 'M16 5v7M16 20v7M5 16h7M20 16h7';
const BRACKETS = 'M6 12V6h6M20 6h6v6M26 20v6h-6M12 26H6v-6';

const HUD_BUTTON = `inline-flex h-11 items-center gap-2 rounded-xl border border-line-strong bg-background/85 px-3 text-sm font-semibold text-foreground hover:border-foreground-muted ${styles.hudFocus}`;

// Memoized: the rects only change with the weapon. The game loop moves `weaponRef` (bob, sway,
// recoil) with one transform per frame, and flashes `flashRef` on a shot
const Weapon = memo(function Weapon({ weapon, weaponRef, flashRef }) {
  return (
    <div
      aria-hidden='true'
      // Decorative, and in the way of the touch pad on phones
      className='pointer-events-none absolute bottom-9 left-1/2 z-30 hidden -translate-x-1/2 translate-y-4 sm:block'
    >
      <div ref={weaponRef} data-moving='false'>
        <svg viewBox='0 -8 18 24' shapeRendering='crispEdges' className='w-32 md:w-40'>
          <polygon ref={flashRef} points='6,0 12,0 16,-8 2,-8' className='fill-info' opacity='0' />
          {PIXELS[weapon].map(({ x, y, w, c }) => (
            <rect key={`${x}-${y}`} x={x} y={y} width={w} height='1' className={FILLS[c]} />
          ))}
        </svg>
      </div>
    </div>
  );
});

/**
 * Crosshair, weapon and its name, status bar (room, threats, walls), the fact toast, the Access
 * granted overlay, and the text-only, sound and exit buttons
 */
export const GameHud = ({
  t,
  aim,
  read,
  total,
  kills,
  threats,
  room,
  weapon,
  toast,
  access,
  sound,
  onSound,
  onTextMode,
  onExit,
  weaponRef,
  flashRef,
}) => (
  <>
    {/* CRT scanlines: one static layer, composited once */}
    <div
      aria-hidden='true'
      className='pointer-events-none absolute inset-0 z-20 bg-[repeating-linear-gradient(to_bottom,transparent_0_2px,rgb(var(--c-background)/0.14)_2px_3px)]'
    />

    <div className='pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2'>
      <svg
        aria-hidden='true'
        viewBox='0 0 32 32'
        fill='none'
        className={`h-8 w-8 ${aim ? 'text-primary' : 'text-foreground'}`}
      >
        {/* A dark outline under the line, so it shows on any wall */}
        {[
          ['stroke-background', 5],
          ['', 2],
        ].map(([outline, width]) => (
          <path
            key={width}
            className={outline}
            stroke='currentColor'
            strokeWidth={width}
            d={aim ? BRACKETS : CROSS}
          />
        ))}
      </svg>
    </div>
    {aim && (
      <p className='pointer-events-none absolute left-1/2 top-[calc(50%+1.75rem)] z-30 -translate-x-1/2 whitespace-nowrap rounded-lg bg-background/85 px-3 py-1 text-sm font-semibold text-foreground'>
        {aim}
      </p>
    )}

    <Weapon weapon={weapon} weaponRef={weaponRef} flashRef={flashRef} />
    <p className='pointer-events-none absolute bottom-12 right-3 z-30 hidden rounded-lg bg-background px-3 py-1 font-mono text-sm font-bold uppercase tracking-wider text-primary-400 sm:block [@media(pointer:coarse)]:hidden'>
      {t('demos.game.weapons')[weapon]}
    </p>

    {/* Facts from a neutralized threat: a live region that is always there, filled for 8 s */}
    <div
      role='status'
      // Below the stacked HUD buttons on phones
      className='pointer-events-none absolute left-1/2 top-44 z-30 w-[min(36rem,calc(100%-1.5rem))] -translate-x-1/2 sm:top-20'
    >
      {toast && (
        <p
          key={toast.key}
          className='rounded-xl border-2 border-success bg-background px-4 py-3 text-foreground motion-safe:animate-game-in'
        >
          <strong className='block font-mono uppercase tracking-wider text-success'>
            {toast.title}
          </strong>
          <span className='mt-1 block text-sm leading-relaxed'>{toast.body}</span>
        </p>
      )}
    </div>

    {access && (
      // Announced through the view's status region; this is the picture of it
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 z-[45] flex items-center justify-center bg-background/75'
      >
        <p className='rounded-xl border-2 border-success bg-background px-8 py-4 font-mono text-3xl font-black uppercase tracking-widest text-success motion-safe:animate-crt-in'>
          {t('demos.game.accessGranted')}
        </p>
      </div>
    )}

    <p className='absolute inset-x-0 bottom-0 z-30 flex min-h-9 flex-wrap items-center gap-x-3 border-t border-line-strong bg-background/90 px-3 font-mono text-xs uppercase tracking-wider text-foreground'>
      <span aria-hidden='true' className='h-2 w-2 shrink-0 rounded-full bg-success' />
      <span>{t('demos.game.status.system')}</span>
      <span aria-hidden='true'>|</span>
      {room && <span>{t('demos.game.status.room', { name: t(`demos.game.rooms.${room}`) })}</span>}
      <span aria-hidden='true'>|</span>
      <span>{t('demos.game.status.threats', { count: kills, total: threats })}</span>
      <span aria-hidden='true' className='hidden sm:inline'>
        |
      </span>
      <span className='hidden sm:inline'>
        {t('demos.game.status.walls', { count: read, total })}
      </span>
    </p>

    <div className='absolute right-3 top-3 z-50 flex flex-col items-end gap-2 sm:flex-row'>
      <button type='button' onClick={onTextMode} className={HUD_BUTTON}>
        {t('demos.game.textMode')}
      </button>
      <button type='button' aria-pressed={sound} onClick={onSound} className={HUD_BUTTON}>
        <svg
          aria-hidden='true'
          viewBox='0 0 24 24'
          className='h-5 w-5'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.75'
          strokeLinecap='round'
          strokeLinejoin='round'
        >
          <path d='M4 9h4l5-4v14l-5-4H4z' />
          <path d={sound ? 'M16 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11' : 'M17 9l5 6M22 9l-5 6'} />
        </svg>
        {t('demos.game.sound')}
        <span aria-hidden='true'>{t(sound ? 'demos.game.on' : 'demos.game.off')}</span>
      </button>
      <button type='button' onClick={onExit} className={HUD_BUTTON}>
        {t('demos.game.exit')}
        <kbd
          aria-hidden='true'
          className='rounded border border-line-strong px-1.5 font-mono text-xs'
        >
          {t('demos.game.escKey')}
        </kbd>
      </button>
    </div>
  </>
);

/**
 * A wall's content, opened from the crosshair: a dialog over the game with a CRT switch-on.
 * useModalDialog makes the game inert behind it and closes it on Escape before the game sees it.
 */
export const GameInfo = ({ t, title, detail = {}, onClose, closeLabel, children }) => {
  const titleId = useId();
  const { overlayRef, panelRef, close, onKeyDown, backdrop } = useModalDialog(onClose);

  useEffect(() => {
    panelRef.current?.focus();
  }, [panelRef]);

  return createPortal(
    <div ref={overlayRef} className='fixed inset-0 z-[70] flex bg-background/60 p-4' {...backdrop}>
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className='m-auto max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl border-2 border-primary bg-background p-6 text-foreground shadow-2xl outline-none motion-safe:animate-crt-in'
      >
        <h2 id={titleId} className='font-mono text-2xl font-black uppercase text-primary-400'>
          {title}
        </h2>
        {detail.lines?.map((line) => (
          <p key={line} className='mt-3 leading-relaxed'>
            {line}
          </p>
        ))}
        {detail.tags && (
          <ul className='mt-4 flex flex-wrap gap-2'>
            {detail.tags.map((tag) => (
              <li
                key={tag}
                className='rounded-lg border border-line-strong bg-surface-raised px-3 py-1 text-sm'
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
        {detail.items && (
          <ul className='mt-4 space-y-4'>
            {detail.items.map(({ name, description, link }) => (
              <li key={name}>
                <h3 className='font-bold text-foreground'>{name}</h3>
                <p className='mt-1 text-sm leading-relaxed text-foreground-muted'>{description}</p>
                {link && (
                  <a
                    href={link}
                    target='_blank'
                    rel='noopener noreferrer'
                    aria-label={t('demos.sourceAria', { name })}
                    className='mt-1 inline-block text-sm font-semibold text-primary-400 underline underline-offset-4'
                  >
                    {t('demos.source')}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
        {children}
        <button type='button' onClick={close} className={`${styles.buttonPrimary} mt-6`}>
          {closeLabel ?? t('demos.game.backToGame')}
        </button>
      </div>
    </div>,
    document.body
  );
};
