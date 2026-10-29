import { memo, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

import { useModalDialog } from '../../hooks/useModalDialog';
import { styles } from '../../styles';

// Game Mode's heads-up display over the cub3D view: crosshair, weapon, status bar, the sound and
// exit buttons, and the dialog a wall opens into. Everything is DOM over the canvas, so none of
// it costs a WebGL draw.

// A gloved fist holding a flashlight, seen from behind: 18 columns of pixels, one letter per
// color ('.' is empty). Rows of fingers wrap the light; the cuff runs off the bottom edge.
const WEAPON = [
  '......oooooo......',
  '.....oLLLLLLo.....',
  '.....oLhLLLLo.....',
  '.....oRRRRRRo.....',
  '......oBhBBo......',
  '......oBhBBo......',
  '......oBhBBo......',
  '...ooooGGGGoooo...',
  '..oGGoGGGGGGGGGo..',
  '..oGGokkkkkkkkko..',
  '..oGGGGGGGGGGGGo..',
  '..ooGkkkkkkkkkko..',
  '...oGGGGGGGGGGGGo.',
  '...oGGGGGGGGGGGGGo',
  '....oGGGGGGGGGGGGG',
  '....oCCCCCCCCCCCCC',
  '....oCCCCCCCCCCCCC',
];
const FILLS = {
  o: 'fill-background',
  L: 'fill-info',
  h: 'fill-foreground',
  R: 'fill-primary',
  B: 'fill-foreground-muted',
  G: 'fill-secondary',
  k: 'fill-tertiary',
  C: 'fill-primary',
};
// One rect per run of same-colored pixels in a row
const PIXELS = WEAPON.flatMap((row, y) =>
  [...row.matchAll(/([^.])\1*/g)].map((run) => ({ x: run.index, y, w: run[0].length, c: run[1] }))
);

// The crosshair: a cross, or corner brackets while a wall panel is in the sights
const CROSS = 'M16 5v7M16 20v7M5 16h7M20 16h7';
const BRACKETS = 'M6 12V6h6M20 6h6v6M26 20v6h-6M12 26H6v-6';

const HUD_BUTTON = `inline-flex h-11 items-center gap-2 rounded-xl border border-line-strong bg-background/85 px-3 text-sm font-semibold text-foreground hover:border-foreground-muted ${styles.hudFocus}`;

// Memoized: its 59 rects never change, so HUD updates (the aimed wall) skip them
const Weapon = memo(function Weapon({ weaponRef, beamRef }) {
  return (
    <div
      aria-hidden='true'
      // Decorative, and in the way of the touch pad on phones
      className='pointer-events-none absolute bottom-9 left-1/2 z-30 hidden -translate-x-1/2 translate-y-4 sm:block'
    >
      {/* Bobs while walking (data-moving, set by the movement loop), unless motion is reduced */}
      <svg
        ref={weaponRef}
        data-moving='false'
        viewBox='0 -8 18 25'
        shapeRendering='crispEdges'
        className='w-32 data-[moving=true]:motion-safe:animate-weapon-bob md:w-40'
      >
        <polygon ref={beamRef} points='5,0 13,0 18,-8 0,-8' className='fill-info' opacity='0' />
        {PIXELS.map(({ x, y, w, c }) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={w} height='1' className={FILLS[c]} />
        ))}
      </svg>
    </div>
  );
});

/** Crosshair, weapon, status bar, and the sound and exit buttons */
export const GameHud = ({ t, target, read, total, sound, onSound, onExit, weaponRef, beamRef }) => (
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
        className={`h-8 w-8 ${target ? 'text-primary' : 'text-foreground'}`}
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
            d={target ? BRACKETS : CROSS}
          />
        ))}
      </svg>
    </div>
    {target && (
      <p className='pointer-events-none absolute left-1/2 top-[calc(50%+1.75rem)] z-30 -translate-x-1/2 whitespace-nowrap rounded-lg bg-background/85 px-3 py-1 text-sm font-semibold text-foreground'>
        {t('demos.game.aim', { name: target })}
      </p>
    )}

    <Weapon weaponRef={weaponRef} beamRef={beamRef} />

    <p className='absolute inset-x-0 bottom-0 z-30 flex min-h-9 flex-wrap items-center gap-x-3 border-t border-line-strong bg-background/90 px-3 font-mono text-xs uppercase tracking-wider text-foreground'>
      <span aria-hidden='true' className='h-2 w-2 shrink-0 rounded-full bg-success' />
      <span>{t('demos.game.status.system')}</span>
      <span aria-hidden='true'>|</span>
      <span className='hidden sm:inline'>
        {t(read === total ? 'demos.game.status.complete' : 'demos.game.status.objective')}
      </span>
      <span aria-hidden='true' className='hidden sm:inline'>
        |
      </span>
      <span>{t('demos.game.status.walls', { count: read, total })}</span>
    </p>

    <div className='absolute right-3 top-3 z-50 flex flex-col items-end gap-2 sm:flex-row'>
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
export const GameInfo = ({ t, title, detail, onClose }) => {
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
        <button type='button' onClick={close} className={`${styles.buttonPrimary} mt-6`}>
          {t('demos.game.backToGame')}
        </button>
      </div>
    </div>,
    document.body
  );
};
