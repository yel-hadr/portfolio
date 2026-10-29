import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useModalDialog } from '../../hooks/useModalDialog';
import { styles } from '../../styles';

// Game Mode's heads-up display over the 3D view, in glass panels: crosshair (it spreads while
// moving and after a shot), the weapon's name with its energy, integrity, the status bar, the fact
// toast, Access granted, and the text-only, sound, volume, contrast and exit controls; the dialog a
// wall opens into. Everything is DOM over the canvas, so none of it costs a WebGL draw. The game
// loop writes the crosshair's spread and the bars straight to their elements (no render per frame).

// The crosshair while something is in the sights: corner brackets
const BRACKETS = 'M6 12V6h6M20 6h6v6M26 20v6h-6M12 26H6v-6';
// Its four arms, pushed out by --spread (set by the game loop)
const ARMS = [
  'left-1/2 top-0 h-2.5 w-0.5 -translate-x-1/2 -translate-y-[calc(100%+var(--spread))]',
  'left-1/2 top-0 h-2.5 w-0.5 -translate-x-1/2 translate-y-[var(--spread)]',
  'left-0 top-1/2 h-0.5 w-2.5 -translate-y-1/2 -translate-x-[calc(100%+var(--spread))]',
  'left-0 top-1/2 h-0.5 w-2.5 -translate-y-1/2 translate-x-[var(--spread)]',
];

const GLASS = 'border border-line bg-glass backdrop-blur-md';
// Panels with colored text are opaque: on translucent glass over the dark facility (or a bright
// high contrast wall) orange and green text fall under AA in one theme or the other
const SOLID = 'border border-line bg-background';
const HUD_BUTTON = `inline-flex h-11 items-center gap-2 rounded-xl ${GLASS} px-3 text-sm font-semibold text-foreground hover:border-foreground-muted ${styles.hudFocus}`;

/** A labeled bar the game loop fills (`barRef`); it turns red under 30% */
const Meter = ({ label, barRef, tone }) => (
  <div aria-hidden='true' className='w-40'>
    <p className='flex justify-between font-mono text-xs uppercase tracking-wider text-foreground'>
      {label}
    </p>
    <div className='mt-1 h-1.5 overflow-hidden rounded-full bg-background/80'>
      <div
        ref={barRef}
        className={`h-full origin-left rounded-full ${tone} transition-colors data-[low=true]:bg-danger`}
      />
    </div>
  </div>
);

/** The master volume, 0 to 1, as a percentage slider */
export const VolumeSlider = ({ t, volume, onVolume, className = '' }) => {
  const id = useId();
  const percent = Math.round(volume * 100);
  // Its presses and drags are the slider's own: the view under the HUD must not take them as a
  // shot, a turn or a request to capture the mouse
  const keep = (e) => e.stopPropagation();
  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      onPointerDown={keep}
      onPointerMove={keep}
      onPointerUp={keep}
      onClick={keep}
      onWheel={keep}
    >
      <label htmlFor={id} className='text-sm font-semibold text-foreground'>
        {t('demos.game.volume')}
      </label>
      <input
        id={id}
        type='range'
        min={0}
        max={100}
        step={5}
        value={percent}
        onChange={(e) => onVolume(Number(e.target.value) / 100)}
        aria-valuetext={`${percent}%`}
        className='w-24 accent-primary'
      />
      <span aria-hidden='true' className='w-9 text-right font-mono text-xs text-foreground'>
        {percent}%
      </span>
    </div>
  );
};

/** The high contrast switch (bright flat colors, no fog or post-processing) */
export const ContrastToggle = ({ t, contrast, onContrast, className }) => (
  <button type='button' aria-pressed={contrast} onClick={onContrast} className={className}>
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      className='h-5 w-5'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.75'
    >
      <circle cx='12' cy='12' r='8' />
      <path d='M12 4a8 8 0 010 16z' fill='currentColor' />
    </svg>
    {t('demos.game.contrast')}
    <span aria-hidden='true'>{t(contrast ? 'demos.game.on' : 'demos.game.off')}</span>
  </button>
);

/**
 * Crosshair, the weapon's name and energy, integrity, status bar (room, threats, walls), the
 * fact toast, the Access granted overlay, and the text-only, sound, volume, contrast and exit
 * controls
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
  crosshairRef,
  energyBar,
  integrityBar,
  hitRef,
  contrast,
  onContrast,
  volume,
  onVolume,
}) => (
  <>
    {/* A red edge, flashed by the game loop when a threat wears integrity down */}
    <div
      ref={hitRef}
      aria-hidden='true'
      className='pointer-events-none absolute inset-0 z-20 opacity-0 shadow-[inset_0_0_120px_24px_rgb(var(--c-danger)/0.75)]'
    />

    <div
      ref={crosshairRef}
      aria-hidden='true'
      data-moving='false'
      style={{ '--spread': '4px' }}
      className={`pointer-events-none absolute left-1/2 top-1/2 z-30 h-0 w-0 ${aim ? 'text-primary' : 'text-foreground'}`}
    >
      {aim ? (
        <svg viewBox='0 0 32 32' fill='none' className='absolute -left-4 -top-4 h-8 w-8'>
          {[
            ['stroke-background', 5],
            ['', 2],
          ].map(([outline, width]) => (
            <path
              key={width}
              className={outline}
              stroke='currentColor'
              strokeWidth={width}
              d={BRACKETS}
            />
          ))}
        </svg>
      ) : (
        <>
          {ARMS.map((arm) => (
            <span
              key={arm}
              className={`absolute ${arm} rounded-sm bg-current shadow-[0_0_0_1px_rgb(var(--c-background)/0.8)] transition-transform duration-75`}
            />
          ))}
          <span className='absolute -left-px -top-px h-0.5 w-0.5 rounded-full bg-current' />
        </>
      )}
    </div>
    {aim && (
      <p
        className={`pointer-events-none absolute left-1/2 top-[calc(50%+1.75rem)] z-30 -translate-x-1/2 whitespace-nowrap rounded-lg ${GLASS} px-3 py-1 text-sm font-semibold text-foreground`}
      >
        {aim}
      </p>
    )}

    {/* The weapon in hand, its energy, and integrity: bottom right, above the status bar */}
    <div
      className={`pointer-events-none absolute bottom-12 right-3 z-30 hidden flex-col items-end gap-2 rounded-xl ${SOLID} px-3 py-2 sm:flex [@media(pointer:coarse)]:hidden`}
    >
      <p className='font-mono text-sm font-bold uppercase tracking-wider text-primary-400'>
        {t('demos.game.weapons')[weapon]}
      </p>
      <Meter label={t('demos.game.energy')} barRef={energyBar} tone='bg-info' />
      <Meter label={t('demos.game.integrity')} barRef={integrityBar} tone='bg-success' />
    </div>

    {/* Facts from a neutralized threat: a live region that is always there, filled for 8 s */}
    <div
      role='status'
      // Below the stacked HUD buttons on phones
      className='pointer-events-none absolute left-1/2 top-44 z-30 w-[min(36rem,calc(100%-1.5rem))] -translate-x-1/2 sm:top-20'
    >
      {toast && (
        <p
          key={toast.key}
          className={`rounded-xl ${SOLID} border-2 border-success px-4 py-3 text-foreground motion-safe:animate-game-in`}
        >
          <strong className='block font-mono uppercase tracking-wider text-success'>
            {toast.title}
          </strong>{' '}
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

    <p
      className={`absolute inset-x-0 bottom-0 z-30 flex min-h-9 flex-wrap items-center gap-x-3 border-x-0 border-b-0 ${GLASS} px-3 font-mono text-xs uppercase tracking-wider text-foreground`}
    >
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

    <div className='absolute right-3 top-3 z-50 flex flex-col items-end gap-2 lg:flex-row lg:items-center'>
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
      <VolumeSlider
        t={t}
        volume={volume}
        onVolume={onVolume}
        className={`h-11 rounded-xl ${GLASS} px-3`}
      />
      <ContrastToggle t={t} contrast={contrast} onContrast={onContrast} className={HUD_BUTTON} />
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

const MENU_BUTTON = 'w-full justify-center font-mono uppercase tracking-widest';

/**
 * Game Mode's main menu, over the paused view: Play (the story, then start), Info / Controls and
 * Exit, with the text-only portfolio offered first for anyone who would rather skip the game.
 * A new screen moves focus to its heading, so it is read from the top; Back returns it to the
 * button that opened the screen
 */
export const MainMenu = ({
  t,
  screen,
  onScreen,
  keys,
  lockable,
  onStart,
  onStartLook,
  onTextMode,
  onExit,
  contrast,
  onContrast,
  volume,
  onVolume,
}) => {
  const panel = useRef(null);
  const previous = useRef(null);
  const settingsId = useId();
  useEffect(() => {
    const from = previous.current;
    previous.current = screen;
    // Not on the first render: the Game Mode dialog itself takes focus as it opens
    if (from === null) return;
    const opener = screen === 'menu' && panel.current?.querySelector(`[data-screen=${from}]`);
    (opener || panel.current?.querySelector('h3'))?.focus();
  }, [screen]);
  const back = (
    <button
      type='button'
      onClick={() => onScreen('menu')}
      className={`${styles.buttonGhost} ${MENU_BUTTON}`}
    >
      {t('demos.game.menu.back')}
    </button>
  );

  return (
    // Scrolls on short or zoomed screens, so every button stays reachable
    <div className='absolute inset-0 z-40 flex overflow-y-auto bg-background/70 p-4 backdrop-blur-sm'>
      <div ref={panel} className='card-glass m-auto w-full max-w-md p-6 shadow-xl'>
        {screen === 'menu' && (
          <>
            <h3
              tabIndex={-1}
              className='font-mono text-3xl font-black uppercase tracking-widest text-foreground outline-none'
            >
              {t('demos.game.title')}
            </h3>
            <button
              type='button'
              onClick={onTextMode}
              className={`${styles.buttonGhost} mt-5 w-full justify-center`}
            >
              {t('demos.game.menu.skip')}
            </button>
            <ul aria-label={t('demos.game.menu.label')} className='mt-5 space-y-3'>
              <li>
                <button
                  type='button'
                  data-screen='story'
                  onClick={() => onScreen('story')}
                  className={`${styles.buttonPrimary} ${MENU_BUTTON}`}
                >
                  {t('demos.game.menu.play')}
                </button>
              </li>
              <li>
                <button
                  type='button'
                  data-screen='info'
                  onClick={() => onScreen('info')}
                  className={`${styles.buttonGhost} ${MENU_BUTTON}`}
                >
                  {t('demos.game.menu.info')}
                </button>
              </li>
              <li>
                <button
                  type='button'
                  onClick={onExit}
                  className={`${styles.buttonGhost} ${MENU_BUTTON}`}
                >
                  {t('demos.game.menu.exit')}
                </button>
              </li>
            </ul>
            {/* Settings, before the game starts: high contrast and the master volume */}
            <section aria-labelledby={settingsId} className='mt-5 border-t border-line pt-4'>
              <h4 id={settingsId} className='text-sm font-semibold text-foreground-muted'>
                {t('demos.game.settings')}
              </h4>
              <ContrastToggle
                t={t}
                contrast={contrast}
                onContrast={onContrast}
                className={`${styles.buttonGhost} mt-3 w-full justify-center gap-2`}
              />
              <VolumeSlider t={t} volume={volume} onVolume={onVolume} className='mt-3' />
            </section>
          </>
        )}
        {screen === 'story' && (
          <>
            <h3
              tabIndex={-1}
              className='font-mono text-2xl font-black uppercase tracking-widest text-primary-400 outline-none'
            >
              {t('demos.game.storyTitle')}
            </h3>
            <p className='mt-4 leading-relaxed text-foreground'>{t('demos.game.story')}</p>
            <div className='mt-6 space-y-3'>
              {lockable && (
                <button
                  type='button'
                  onClick={onStartLook}
                  className={`${styles.buttonPrimary} ${MENU_BUTTON}`}
                >
                  {t('demos.cub3d.welcome.startLook')}
                </button>
              )}
              <button
                type='button'
                onClick={onStart}
                className={`${lockable ? styles.buttonGhost : styles.buttonPrimary} ${MENU_BUTTON}`}
              >
                {t('demos.cub3d.welcome.start')}
              </button>
              {back}
            </div>
          </>
        )}
        {screen === 'info' && (
          <>
            <h3
              tabIndex={-1}
              className='font-mono text-2xl font-black uppercase tracking-widest text-foreground outline-none'
            >
              {t('demos.game.menu.info')}
            </h3>
            <ul className='mt-4 space-y-2 text-sm leading-relaxed text-foreground'>
              {keys.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className='mt-6'>{back}</div>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * A crew member's line, typed out at the bottom of the view like an RPG (all at once with reduced
 * motion). Screen readers get the whole line at once. E or Escape closes it, and the threats
 * resume
 */
export const NpcDialogue = ({ t, name, line, reduced, onClose }) => {
  const titleId = useId();
  const lineId = useId();
  const box = useRef(null);
  const button = useRef(null);
  const [shown, setShown] = useState(reduced ? line.length : 0);

  useEffect(() => {
    box.current?.focus();
  }, []);
  useEffect(() => {
    if (reduced) {
      setShown(line.length);
      return undefined;
    }
    setShown(0);
    const timer = window.setInterval(() => {
      setShown((n) => {
        if (n >= line.length) window.clearInterval(timer);
        return Math.min(n + 1, line.length);
      });
    }, 28);
    return () => window.clearInterval(timer);
  }, [line, reduced]);

  const onKeyDown = (e) => {
    // Keys stay here: Escape closes this, not Game Mode. A held E does not close the line it
    // just opened
    e.stopPropagation();
    if (e.repeat) return;
    if (e.key === 'Escape' || e.code === 'KeyE') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      // Its one control: the close button
      e.preventDefault();
      button.current?.focus();
    }
  };

  return (
    <div
      ref={box}
      role='dialog'
      aria-modal='true'
      aria-labelledby={titleId}
      aria-describedby={lineId}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className='absolute inset-x-3 bottom-12 z-[45] mx-auto max-w-2xl rounded-2xl border-2 border-primary-400 bg-background p-4 text-foreground shadow-2xl outline-none'
    >
      <p
        id={titleId}
        className='font-mono text-sm font-bold uppercase tracking-wider text-primary-400'
      >
        {name}
      </p>
      <p className='mt-2 min-h-14 leading-relaxed'>
        <span id={lineId} className='sr-only'>
          {line}
        </span>
        <span aria-hidden='true'>{line.slice(0, shown)}</span>
      </p>
      <div className='mt-2 flex flex-wrap items-center justify-between gap-3'>
        <span className='text-sm text-foreground-muted'>{t('demos.game.dialogueClose')}</span>
        <button ref={button} type='button' onClick={onClose} className={HUD_BUTTON}>
          {t('demos.game.closeDialog')}
        </button>
      </div>
    </div>
  );
};
