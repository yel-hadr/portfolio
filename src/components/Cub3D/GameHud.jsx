import { Fragment, useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useModalDialog } from '../../hooks/useModalDialog';
import { styles } from '../../styles';

// Game Mode's heads-up display over the 3D view, in glass panels: crosshair (it spreads while
// moving and after a shot), the weapon's name with its energy, integrity, the status bar, the fact
// toast, Access granted, and the text-only, pause and exit controls; the dialog a wall opens
// into. Everything is DOM over the canvas, so none of it costs a WebGL draw. The game
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

// The HUD's diegetic look: Midnight Obsidian glass behind ultra-thin 1 px lines, corner brackets
// like a fighter jet's display (Brackets), monospace labels
const GLASS = 'border border-line bg-glass backdrop-blur-md';
// Panels with colored text are near-opaque frosted glass (88%): over the dark facility, or a
// bright high contrast wall, every text color still holds AA (muted >= 5.3:1, amber 5.9:1)
const SOLID = 'border border-line bg-surface/[0.88] backdrop-blur-md';
// The dialogs over the paused game: the dark island's frosted glass
const DIALOG = 'rounded-lg border bg-glass-strong shadow-modal backdrop-blur-xl';

/** Corner brackets around a panel, in its accent (`className` sets the color), 1 px (2 `thick`) */
export const Brackets = ({
  className = 'text-foreground-muted',
  size = 'h-2.5 w-2.5',
  thick = false,
}) => {
  const [l, r, t, b] = thick
    ? ['border-l-2', 'border-r-2', 'border-t-2', 'border-b-2']
    : ['border-l', 'border-r', 'border-t', 'border-b'];
  return (
    <span aria-hidden='true' className={`pointer-events-none absolute -inset-px ${className}`}>
      <span className={`absolute left-0 top-0 ${size} ${l} ${t} border-current`} />
      <span className={`absolute right-0 top-0 ${size} ${r} ${t} border-current`} />
      <span className={`absolute bottom-0 left-0 ${size} ${b} ${l} border-current`} />
      <span className={`absolute bottom-0 right-0 ${size} ${b} ${r} border-current`} />
    </span>
  );
};

/**
 * Text typed out a few characters at a time (a dossier, a crew member's line): returns how many
 * characters of `text` show, and `finish` to show them all at once. A new text starts from none;
 * `enabled` false shows it whole (reduced motion). `onStep` runs every `tickEvery` steps (a quiet
 * key sound), not on every one
 */
const useTypewriter = (
  text,
  { enabled = true, chars = 1, interval = 28, onStep, tickEvery = 3 } = {}
) => {
  const [typed, setTyped] = useState({ text, count: 0 });
  // Set by finish: the running timer stops at its next tick
  const skip = useRef(false);
  const step = useEffectEvent(() => onStep?.());
  useEffect(() => {
    if (!enabled) return undefined;
    skip.current = false;
    let count = 0;
    let steps = 0;
    const timer = window.setInterval(() => {
      if (skip.current) {
        window.clearInterval(timer);
        return;
      }
      count = Math.min(count + chars, text.length);
      steps += 1;
      setTyped({ text, count });
      if (steps % tickEvery === 1) step();
      if (count >= text.length) window.clearInterval(timer);
    }, interval);
    return () => window.clearInterval(timer);
  }, [text, enabled, chars, interval, tickEvery]);
  const finish = () => {
    skip.current = true;
    setTyped({ text, count: text.length });
  };
  let shown = 0;
  if (!enabled) shown = text.length;
  else if (typed.text === text) shown = typed.count;
  return [shown, finish];
};

// Between 0 and `max`
const clampTo = (value, max) => Math.max(0, Math.min(max, value));

/**
 * A run of text being typed: the full text holds its place (invisible), the typed part is drawn
 * over it, so the dialog never reflows as it types. Screen readers get the whole text at once
 */
const Typed = ({ text, shown, caret = false }) => (
  <>
    <span className='sr-only'>{text}</span>
    <span aria-hidden='true' className='relative block'>
      <span className='invisible'>{text}</span>
      <span className='absolute inset-0'>
        {text.slice(0, shown)}
        {caret && shown < text.length && (
          <span className='ml-px inline-block h-[1em] w-[0.55em] translate-y-[0.15em] bg-primary-400' />
        )}
      </span>
    </span>
  </>
);
// Every main and pause menu button: one text style (mono capitals), centered when a label wraps
const MENU_BUTTON = 'w-full justify-center text-center font-mono uppercase tracking-widest';
const HUD_BUTTON = `inline-flex h-11 items-center gap-2 rounded-xl ${GLASS} px-3 text-sm font-semibold text-foreground hover:border-foreground-muted ${styles.hudFocus}`;

/**
 * A labeled bar the game loop fills (`barRef`); it turns red under 30%. The loop writes the
 * number too, into the `data-readout` span beside the label (writeBar in Cub3DWorld)
 */
const Meter = ({ label, barRef, tone }) => (
  <div aria-hidden='true' data-meter='' className='w-40'>
    <p className='flex justify-between font-mono text-xs uppercase tracking-wider text-foreground'>
      {label}
      <span data-readout='' className='tabular-nums'>
        100%
      </span>
    </p>
    <div className='relative mt-1 h-1.5 overflow-hidden rounded-xs bg-background/80'>
      <div
        ref={barRef}
        className={`h-full origin-left rounded-xs ${tone} transition-colors data-[low=true]:bg-danger`}
      />
      {/* Tick marks every tenth, and a slow sheen running along the bar (not with reduced
          motion) */}
      <span className='absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_calc(10%-1px),rgb(var(--c-background)/0.7)_calc(10%-1px)_10%)]' />
      <span className='absolute inset-y-0 -left-8 w-8 bg-linear-to-r/srgb from-transparent via-foreground/30 to-transparent opacity-0 motion-safe:animate-hud-tick motion-safe:opacity-100' />
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

/** Sound on or off (M during play): the synthesizer loads the first time it is turned on */
export const SoundToggle = ({ t, sound, onSound, className }) => (
  <button type='button' aria-pressed={sound} onClick={onSound} className={className}>
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
);

/** Reduce flashing: no muzzle flash, screen shake, bloom, flicker or flashing pulses */
export const FlashToggle = ({ t, noFlash, onFlash, className }) => (
  <button type='button' aria-pressed={noFlash} onClick={onFlash} className={className}>
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      className='h-5 w-5'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.75'
      strokeLinejoin='round'
    >
      <path d='M13 3L5 13.5h6L10 21l8-10.5h-6z' />
      {noFlash && <path d='M4 4l16 16' strokeLinecap='round' />}
    </svg>
    {t('demos.game.flashing')}
    <span aria-hidden='true'>{t(noFlash ? 'demos.game.on' : 'demos.game.off')}</span>
  </button>
);

const GRAPHICS = ['low', 'medium', 'high'];

/** The graphics tier: native radio buttons (arrow keys move and pick), drawn as a segmented bar */
const GraphicsChoice = ({ t, graphics, onGraphics }) => {
  const name = useId();
  return (
    <fieldset>
      <legend className='text-sm font-semibold text-foreground'>
        {t('demos.game.graphics.label')}
      </legend>
      <div className='mt-2 grid grid-cols-3 gap-1 rounded-xl border border-line-strong bg-background p-1'>
        {GRAPHICS.map((tier) => (
          <label key={tier} className='relative'>
            <input
              type='radio'
              name={name}
              value={tier}
              checked={graphics === tier}
              onChange={() => onGraphics(tier)}
              className='peer sr-only'
            />
            {/* The picked tier: orange, and underlined so it does not rest on color alone */}
            <span className='flex h-9 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-foreground hover:bg-surface-raised peer-checked:bg-primary peer-checked:text-on-primary peer-checked:underline peer-checked:underline-offset-4 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary'>
              {t(`demos.game.graphics.${tier}`)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};

/**
 * Game Mode's settings, in the main menu and the pause menu: the graphics tier, Reduce flashing,
 * high contrast, sound and the master volume (the HUD keeps only Text-only, Pause and Exit)
 */
export const GameSettings = ({
  t,
  graphics,
  onGraphics,
  noFlash,
  onFlash,
  contrast,
  onContrast,
  sound,
  onSound,
  volume,
  onVolume,
  headingLevel = 'h4',
}) => {
  const id = useId();
  // Buttons reset text-transform (preflight), so they take the capitals themselves
  const toggle = `${styles.buttonGhost} w-full justify-center gap-2 uppercase`;
  const Heading = headingLevel;
  return (
    // Mono capitals like the menu buttons above it: one text style through the whole menu
    <section
      aria-labelledby={id}
      className='mt-5 space-y-3 border-t border-line pt-4 font-mono uppercase tracking-wider'
    >
      <Heading id={id} className='text-sm font-semibold text-foreground-muted'>
        {t('demos.game.settings')}
      </Heading>
      <GraphicsChoice t={t} graphics={graphics} onGraphics={onGraphics} />
      <FlashToggle t={t} noFlash={noFlash} onFlash={onFlash} className={toggle} />
      <ContrastToggle t={t} contrast={contrast} onContrast={onContrast} className={toggle} />
      <SoundToggle t={t} sound={sound} onSound={onSound} className={toggle} />
      <VolumeSlider t={t} volume={volume} onVolume={onVolume} />
    </section>
  );
};

// The weapon card shows from sm with a fine pointer (`[@media(min-width:40rem)_and_(pointer:fine)]`,
// written out in full where it is used: Tailwind only sees whole class names). Elsewhere (a phone,
// a touch screen) the status bar carries a slim integrity meter, since SYSTEM FAILURE can still
// happen there

/**
 * Crosshair, the weapon's name and energy, integrity, status bar (room, threats), the fact toast,
 * the Access granted overlay, and the text-only, pause and exit controls. Sound, volume and
 * contrast are in the pause menu, so the controls never cover the radar or the touch pad
 */
export const GameHud = ({
  t,
  aim,
  aimFar = false,
  prompt,
  promptKeyOnly = false,
  sections,
  kills,
  threats,
  room,
  weapon,
  toast,
  access,
  onTextMode,
  onExit,
  confirmExit = false,
  onPointerDone,
  crosshairRef,
  hitMarkerRef,
  energyBar,
  integrityBar,
  integritySlimBar,
  hitRef,
  slowed,
  onPause,
  hubFlash = 0,
  noFlash = false,
}) => (
  <>
    {/* The command hub coming online: a cool edge glow that fades (not with reduced motion or
        Reduce flashing; the hub's lit hologram and its dossier say it as well) */}
    {hubFlash > 0 && !noFlash && (
      <div
        key={hubFlash}
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 z-20 opacity-0 shadow-[inset_0_0_120px_24px_rgb(var(--c-info)/0.55)] motion-safe:animate-hub-glow'
      />
    )}
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
      // A hit turns it red for a moment (data-hit, set by the game loop)
      className={`pointer-events-none absolute left-1/2 top-1/2 z-30 h-0 w-0 ${aim ? 'text-primary' : 'text-foreground'} data-[hit=true]:text-danger`}
    >
      {/* The hit marker: four ticks round the center, flashed on a kill */}
      <svg
        ref={hitMarkerRef}
        viewBox='0 0 32 32'
        fill='none'
        className='absolute -left-5 -top-5 h-10 w-10 text-danger opacity-0'
      >
        {[
          ['stroke-background', 5],
          ['', 2.5],
        ].map(([outline, width]) => (
          <path
            key={width}
            className={outline}
            stroke='currentColor'
            strokeWidth={width}
            strokeLinecap='round'
            d='M7 7l5 5M25 7l-5 5M7 25l5-5M25 25l-5-5'
          />
        ))}
      </svg>
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
              className={`absolute ${arm} rounded-xs bg-current shadow-[0_0_0_1px_rgb(var(--c-background)/0.8)] transition-transform duration-75`}
            />
          ))}
          <span className='absolute -left-px -top-px h-0.5 w-0.5 rounded-full bg-current' />
        </>
      )}
    </div>
    {prompt ? (
      // Something to use in reach: the Press E prompt, on an opaque fill (it sits over the scene).
      // Announced through the view's own status region; this is the picture of it. At a wall
      // terminal (`promptKeyOnly`) only the key cap: its screen already says Press E and its title
      <div
        key={prompt}
        aria-hidden='true'
        className={`pointer-events-none absolute left-1/2 top-[calc(50%+1.75rem)] z-30 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-md ${SOLID} border-primary-400/50 px-3 py-2 text-foreground motion-safe:animate-prompt-in`}
      >
        <Brackets className='text-primary-400' />
        <kbd className='inline-flex h-8 w-8 items-center justify-center rounded-xs border border-foreground font-mono text-base font-black'>
          E
        </kbd>
        {!promptKeyOnly && (
          <span className='flex flex-col leading-tight'>
            <span className='font-mono text-sm font-bold uppercase tracking-wider'>
              {t('demos.game.prompt')}
            </span>
            <span className='text-sm'>{prompt}</span>
          </span>
        )}
      </div>
    ) : (
      aim && (
        // Past the weapon in hand's range: dimmed, and it says so (not by color alone)
        <p
          className={`pointer-events-none absolute left-1/2 top-[calc(50%+1.75rem)] z-30 -translate-x-1/2 whitespace-nowrap rounded-md ${SOLID} px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider ${aimFar ? 'text-foreground-muted' : 'text-foreground'}`}
        >
          {aim}
          {aimFar && <span> · {t('demos.game.outOfRange')}</span>}
        </p>
      )
    )}

    <MissionTracker t={t} sections={sections} />

    {/* The weapon in hand, its energy, and integrity: bottom right, above the status bar */}
    <div
      className={`pointer-events-none absolute bottom-12 right-3 z-30 hidden flex-col items-end gap-2 rounded-md ${SOLID} px-3 py-2 [@media(min-width:40rem)_and_(pointer:fine)]:flex`}
    >
      <Brackets className='text-primary-400' />
      <p className='font-mono text-sm font-bold uppercase tracking-wider text-primary-400'>
        {t('demos.game.weapons')[weapon]}
      </p>
      <p className='font-mono text-xs text-foreground'>{t('demos.game.weaponRoles')[weapon]}</p>
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
          className={`relative rounded-md ${SOLID} border-success/50 px-4 py-3 text-foreground motion-safe:animate-game-in`}
        >
          <Brackets className='text-success' />
          <strong className='block font-mono uppercase tracking-wider text-success'>
            {toast.title}
          </strong>{' '}
          <span className='mt-1 block text-sm leading-relaxed'>{toast.body}</span>
        </p>
      )}
    </div>

    {/* A Memory Leak close by: announced once by the view; this is the picture of it */}
    {slowed && (
      <p
        aria-hidden='true'
        className={`pointer-events-none absolute bottom-12 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md ${SOLID} border-secondary px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-foreground`}
      >
        {t('demos.game.slowed')}
      </p>
    )}

    {access && (
      // Announced through the view's status region; this is the picture of it
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 z-[45] flex items-center justify-center bg-background/75'
      >
        <p className='relative rounded-md border border-success/50 bg-surface/[0.92] px-8 py-4 font-mono text-3xl font-black uppercase tracking-widest text-success backdrop-blur-md motion-safe:animate-crt-in'>
          <Brackets className='text-success' size='h-4 w-4' />
          {t('demos.game.accessGranted')}
        </p>
      </div>
    )}

    {/* Separators only between the items there are; the sections' count is the mission
        tracker's. Where the weapon card is hidden, a slim integrity meter */}
    <p
      className={`absolute inset-x-0 bottom-0 z-30 flex min-h-9 flex-wrap items-center gap-x-3 border-x-0 border-b-0 ${GLASS} px-3 font-mono text-xs uppercase tracking-wider text-foreground`}
    >
      <span aria-hidden='true' className='h-2 w-2 shrink-0 rounded-full bg-success' />
      {[
        t('demos.game.status.system'),
        room && t('demos.game.status.room', { name: t(`demos.game.rooms.${room}`) }),
        t('demos.game.status.threats', { count: kills, total: threats }),
      ]
        .filter(Boolean)
        .map((item, i) => (
          <Fragment key={item}>
            {i > 0 && <span aria-hidden='true'>|</span>}
            <span>{item}</span>
          </Fragment>
        ))}
      <span
        aria-hidden='true'
        data-meter=''
        className='ml-auto flex items-center gap-2 [@media(min-width:40rem)_and_(pointer:fine)]:hidden'
      >
        {t('demos.game.integrity')}
        <span data-readout='' className='tabular-nums'>
          100%
        </span>
        <span className='relative h-1.5 w-20 overflow-hidden rounded-xs bg-background/80'>
          <span
            ref={integritySlimBar}
            className='block h-full origin-left rounded-xs bg-success transition-colors data-[low=true]:bg-danger'
          />
        </span>
      </span>
    </p>

    {/* Text-only, Pause and Exit: a column on a phone (no radar there), a row from sm, which
        ends above the radar */}
    <div className='absolute right-3 top-3 z-50 flex flex-col items-end gap-2 sm:flex-row sm:items-center'>
      <button type='button' onClick={onTextMode} className={HUD_BUTTON}>
        {t('demos.game.textMode')}
      </button>
      <button type='button' onClick={onPause} className={HUD_BUTTON}>
        {t('demos.game.pauseButton')}
        <kbd
          aria-hidden='true'
          className='rounded-sm border border-line-strong px-1.5 font-mono text-xs'
        >
          {t('demos.game.escKey')}
        </kbd>
      </button>
      <ExitButton t={t} confirm={confirmExit} onExit={onExit} onPointerDone={onPointerDone} />
    </div>
  </>
);

const EXIT_CONFIRM_MS = 4000;
/**
 * Exit Game Mode. On a touch screen (`confirm`) the first tap asks to confirm, for a few seconds,
 * since a thumb meant for the view can land on it. A pointer click gives the keys back to the view
 * (`onPointerDone`), so Space does not press it again; a key press keeps focus here
 */
const ExitButton = ({ t, confirm, onExit, onPointerDone }) => {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return undefined;
    const timer = window.setTimeout(() => setAsking(false), EXIT_CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [asking]);
  const onClick = (e) => {
    if (confirm && !asking) {
      setAsking(true);
      if (e.detail > 0) onPointerDone?.();
      return;
    }
    onExit();
  };
  return (
    <button
      type='button'
      onClick={onClick}
      className={`${HUD_BUTTON} ${asking ? 'border-danger' : ''}`}
    >
      {t(asking ? 'demos.game.exitConfirm' : 'demos.game.exit')}
    </button>
  );
};

/**
 * The mission: the profile's six sections in the story's order, ticked off as their terminals
 * are read, with the next one marked. A visual list; each discovery is announced by the view, and
 * the whole list is in the text-only mode too
 */
const MissionTracker = ({ t, sections }) => {
  const found = sections.filter((section) => section.found).length;
  const next = sections.find((section) => !section.found)?.id;
  return (
    <section
      aria-label={t('demos.game.mission.label')}
      className={`pointer-events-none absolute left-3 top-3 z-30 rounded-md ${SOLID} px-3 py-2 text-foreground`}
    >
      <Brackets />
      <p className='font-mono text-xs font-bold uppercase tracking-wider'>
        {t('demos.game.mission.progress', { count: found, total: sections.length })}
      </p>
      {/* On a very short screen (a phone held sideways) only the count, so the touch pad below
          stays clear; the radar's ring and the lit path still show the next section */}
      <ol className='mt-1 space-y-0.5 text-sm [@media(max-height:26rem)]:hidden'>
        {sections.map(({ id, title, found: done }) => (
          <li
            key={id}
            className={`flex items-center gap-2 ${id === next ? 'font-bold' : ''} ${done ? '' : 'text-foreground'}`}
          >
            <svg
              aria-hidden='true'
              viewBox='0 0 16 16'
              className={`h-4 w-4 shrink-0 ${done ? 'text-success' : 'text-foreground'}`}
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
            >
              {done ? (
                <path d='M3 8.5l3 3 7-7' strokeLinecap='round' strokeLinejoin='round' />
              ) : (
                <circle cx='8' cy='8' r='5.5' />
              )}
            </svg>
            {title}
            {id === next && (
              <span aria-hidden='true' className='font-mono text-xs text-primary-400'>
                {t('demos.game.mission.next')}
              </span>
            )}
            <span className='sr-only'>
              {done
                ? t('demos.game.mission.discovered')
                : id === next
                  ? t('demos.game.mission.nextSr')
                  : t('demos.game.mission.notYet')}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
};

// The end dialogs open under a player who may still be clicking to fire: their buttons and
// backdrop take nothing for a moment (`ARMED_MS`), so a shot's click never lands on Exit
const ARMED_MS = 400;
const useArmed = () => {
  const armed = useRef(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      armed.current = true;
    }, ARMED_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return armed;
};

/**
 * Every section read, or every threat neutralized: the mission's end, a dialog over the paused
 * game with the time it took, the threats neutralized, the accuracy, and the ways to get in touch
 */
export const MissionComplete = ({
  t,
  body,
  time,
  kills,
  threats,
  accuracy,
  resume,
  github,
  onContact,
  onClose,
}) => {
  const titleId = useId();
  const armed = useArmed();
  const { overlayRef, panelRef, close, onKeyDown, backdrop } = useModalDialog(() => {
    if (armed.current) onClose();
  });
  const heading = useRef(null);
  // A click too soon after it opened does nothing (a link does not follow)
  const guard = (action) => (e) => {
    if (!armed.current) {
      e.preventDefault();
      return;
    }
    action?.(e);
  };

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return createPortal(
    <div
      ref={overlayRef}
      className='scheme-dark fixed inset-0 z-[70] flex bg-background/70 p-4 backdrop-blur-sm motion-safe:animate-backdrop-in'
      {...backdrop}
    >
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`relative m-auto max-h-full w-full max-w-lg overflow-y-auto ${DIALOG} border-success/40 p-6 text-center text-foreground outline-hidden motion-safe:animate-crt-in`}
      >
        <Brackets className='text-success' size='h-4 w-4' />
        <h2
          ref={heading}
          id={titleId}
          tabIndex={-1}
          className='font-mono text-3xl font-black uppercase tracking-widest text-success outline-hidden'
        >
          {t('demos.game.mission.title')}
        </h2>
        <p className='mt-4 leading-relaxed'>{body}</p>
        <dl className='mx-auto mt-4 grid max-w-xs grid-cols-2 gap-x-4 gap-y-1 text-left font-mono text-sm'>
          <dt>{t('demos.game.mission.time')}</dt>
          <dd className='text-right tabular-nums'>{time}</dd>
          <dt>{t('demos.game.mission.threats')}</dt>
          <dd className='text-right tabular-nums'>
            {kills} / {threats}
          </dd>
          <dt>{t('demos.game.mission.accuracy')}</dt>
          <dd className='text-right tabular-nums'>{accuracy}</dd>
        </dl>
        <div className='mt-6 flex flex-col gap-3'>
          <button
            type='button'
            onClick={guard(onContact)}
            className={`${styles.buttonPrimary} justify-center`}
          >
            {t('demos.game.mission.contact')}
          </button>
          <a
            href={resume}
            download
            onClick={guard()}
            className={`${styles.buttonGhost} justify-center`}
          >
            {t('demos.game.mission.resume')}
          </a>
          <a
            href={github}
            target='_blank'
            rel='noopener noreferrer'
            onClick={guard()}
            className={`${styles.buttonGhost} justify-center`}
          >
            {t('demos.game.mission.github')}
            <span className='sr-only'>{t('footer.newTab')}</span>
          </a>
          <button
            type='button'
            onClick={guard(close)}
            className={`${styles.buttonGhost} justify-center`}
          >
            {t('demos.game.mission.keepExploring')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

/**
 * Escape during play: a dialog over the frozen game. Resume (or Escape again), Restart (a fresh
 * run), Exit to the main menu, the resume to download (always in reach, not only at the hub and
 * the mission's end), and the settings
 */
export const PauseMenu = ({ t, onResume, onRestart, onMenu, resumeHref, settings }) => {
  const titleId = useId();
  const { overlayRef, panelRef, close, release, onKeyDown, backdrop } = useModalDialog(onResume);
  const resume = useRef(null);

  useEffect(() => {
    resume.current?.focus();
  }, []);
  // Restart and the main menu remount the game: the page is let go first
  const leave = (action) => () => {
    release();
    action();
  };

  return createPortal(
    <div
      ref={overlayRef}
      className='scheme-dark fixed inset-0 z-[70] flex bg-background/70 p-4 backdrop-blur-sm motion-safe:animate-backdrop-in'
      {...backdrop}
    >
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className='card-glass m-auto max-h-full w-full max-w-md overflow-y-auto p-6 shadow-modal outline-hidden'
      >
        <h2
          id={titleId}
          className='font-mono text-3xl font-black uppercase tracking-widest text-foreground'
        >
          {t('demos.game.pause.title')}
        </h2>
        <div className='mt-5 space-y-3'>
          <button
            ref={resume}
            type='button'
            onClick={close}
            className={`${styles.buttonPrimary} ${MENU_BUTTON}`}
          >
            {t('demos.game.pause.resume')}
          </button>
          <button
            type='button'
            onClick={leave(onRestart)}
            className={`${styles.buttonGhost} ${MENU_BUTTON}`}
          >
            {t('demos.game.pause.restart')}
          </button>
          <button
            type='button'
            onClick={leave(onMenu)}
            className={`${styles.buttonGhost} ${MENU_BUTTON}`}
          >
            {t('demos.game.pause.toMenu')}
          </button>
          <a href={resumeHref} download className={`${styles.buttonGhost} ${MENU_BUTTON}`}>
            {t('demos.game.mission.resume')}
          </a>
        </div>
        <GameSettings t={t} {...settings} headingLevel='h3' />
      </div>
    </div>,
    document.body
  );
};

/**
 * Integrity at zero: an alert dialog over the stopped game. Reboot (or Escape) respawns in the
 * first room with full integrity, the mission's progress kept; or back to the main menu
 */
export const SystemFailure = ({ t, onReboot, onMenu }) => {
  const titleId = useId();
  const bodyId = useId();
  const armed = useArmed();
  const { overlayRef, panelRef, close, release, onKeyDown } = useModalDialog(onReboot);
  const reboot = useRef(null);
  // Exit to the main menu ends the run: a second press confirms it
  const [confirming, setConfirming] = useState(false);
  const toMenu = () => {
    if (!armed.current) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    release();
    onMenu();
  };

  useEffect(() => {
    reboot.current?.focus();
  }, []);

  return createPortal(
    <div
      ref={overlayRef}
      className='scheme-dark fixed inset-0 z-[70] flex bg-background/80 p-4 backdrop-blur-sm motion-safe:animate-backdrop-in'
    >
      <div
        ref={panelRef}
        role='alertdialog'
        aria-modal='true'
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`relative m-auto max-h-full w-full max-w-lg overflow-y-auto ${DIALOG} border-danger/40 p-6 text-center text-foreground outline-hidden motion-safe:animate-crt-in`}
      >
        <Brackets className='text-danger' size='h-4 w-4' />
        <h2
          id={titleId}
          className='font-mono text-3xl font-black uppercase tracking-widest text-danger'
        >
          {t('demos.game.failure.title')}
        </h2>
        <p
          aria-hidden='true'
          className='mt-3 font-mono text-sm uppercase tracking-wider text-foreground'
        >
          {t('demos.game.integrity')}: 0%
        </p>
        <p id={bodyId} className='mt-4 leading-relaxed'>
          {t('demos.game.failure.body')}
        </p>
        <div className='mt-6 flex flex-col gap-3'>
          <button
            ref={reboot}
            type='button'
            onClick={() => armed.current && close()}
            className={`${styles.buttonPrimary} ${MENU_BUTTON}`}
          >
            {t('demos.game.failure.reboot')}
          </button>
          <button type='button' onClick={toMenu} className={`${styles.buttonGhost} ${MENU_BUTTON}`}>
            {t(confirming ? 'demos.game.failure.confirmMenu' : 'demos.game.pause.toMenu')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

/**
 * A wall's content, opened from the crosshair: a dialog over the game with a CRT switch-on.
 * useModalDialog makes the game inert behind it and closes it on Escape before the game sees it.
 * In Game Mode (`terminal`) it is a holographic terminal: dark glass with glowing corner
 * brackets, faint scan lines, a slow flicker (not with reduced motion or Reduce flashing), the
 * title and text typed out (whole at once with reduced motion; any key or click finishes it) with
 * a quiet tick (`onType`), and a Close terminal button. Screen readers get the whole text at once,
 * and every link and button is there from the start
 */
export const GameInfo = ({
  t,
  title,
  kicker,
  detail = {},
  onClose,
  closeLabel,
  dark = false,
  terminal = false,
  reduced = false,
  noFlash = false,
  onType,
  children,
}) => {
  const titleId = useId();
  const scroller = useRef(null);
  const { overlayRef, panelRef, close, onKeyDown, backdrop } = useModalDialog(onClose);
  const lines = detail.lines ?? [];
  // What types out: the title, then each paragraph, as one run of characters
  const [shown, finish] = useTypewriter([title, ...lines].join(''), {
    enabled: terminal && !reduced,
    chars: 4,
    interval: 16,
    onStep: onType,
  });
  const typing = shown < title.length + lines.reduce((sum, line) => sum + line.length, 0);
  // How much of each part shows: the title's characters come first, then each line's in turn
  const titleShown = Math.min(shown, title.length);
  const starts = lines.map(
    (_, i) => title.length + lines.slice(0, i).reduce((sum, line) => sum + line.length, 0)
  );
  const lineShown = lines.map((line, i) => clampTo(shown - starts[i], line.length));

  useEffect(() => {
    // The scrolling body takes focus, so the arrow keys scroll it
    (scroller.current ?? panelRef.current)?.focus();
  }, [panelRef]);
  // The E that opened it (and its auto-repeat while still held) must not skip the typing: keys and
  // clicks count only a moment after it opens
  const armed = useRef(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      armed.current = true;
    }, 150);
    return () => window.clearTimeout(timer);
  }, []);

  const keys = (e) => {
    // Any key but Tab, Shift or Escape finishes the typing at once
    if (typing && armed.current && !e.repeat && !['Tab', 'Shift', 'Escape'].includes(e.key)) {
      finish();
    }
    onKeyDown(e);
  };
  const skip = () => {
    if (armed.current) finish();
  };

  const heading = 'font-mono text-sm font-bold uppercase tracking-widest text-foreground';
  return createPortal(
    <div
      ref={overlayRef}
      // Game Mode's dialogs portal out of its dark island: they take it back (`dark`)
      className={`${dark ? 'scheme-dark ' : ''}fixed inset-0 z-[70] flex bg-background/60 p-4 backdrop-blur-sm motion-safe:animate-backdrop-in`}
      {...backdrop}
    >
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={keys}
        onPointerDown={typing ? skip : undefined}
        className={
          terminal
            ? `holo-terminal relative m-auto flex max-h-full w-full max-w-2xl flex-col rounded-lg border border-primary-400/60 bg-background/90 text-foreground outline-hidden backdrop-blur-md motion-safe:animate-crt-in ${noFlash ? '' : 'holo-flicker'}`
            : `relative m-auto flex max-h-full w-full max-w-2xl flex-col ${DIALOG} border-primary/40 text-foreground outline-hidden motion-safe:animate-crt-in`
        }
      >
        <Brackets
          className={terminal ? 'holo-glow text-primary-400' : 'text-primary-400'}
          size={terminal ? 'h-5 w-5' : 'h-4 w-4'}
          thick={terminal}
        />
        {terminal && <span aria-hidden='true' className='holo-scan' />}
        <div ref={scroller} tabIndex={-1} className='relative overflow-y-auto p-6 outline-hidden'>
          {/* Game Mode's dossier: which section of the profile this is */}
          {kicker && <p className={`mb-1 border-b border-line pb-2 ${heading}`}>{kicker}</p>}
          <h2 id={titleId} className='font-mono text-2xl font-black uppercase text-primary-400'>
            {terminal ? <Typed text={title} shown={titleShown} caret={typing} /> : title}
          </h2>
          {lines.map((line, i) => (
            <p key={line} className='mt-3 leading-relaxed'>
              {terminal ? (
                <Typed
                  text={line}
                  shown={lineShown[i]}
                  caret={typing && titleShown === title.length && lineShown[i] < line.length}
                />
              ) : (
                line
              )}
            </p>
          ))}
          {/* The command hub: the mission's progress, ticked (and said) per section */}
          {detail.checklist && (
            <section className='mt-5'>
              <h3 className={heading}>{detail.checklist.heading}</h3>
              <ol className='mt-2 grid gap-x-6 gap-y-1 font-mono text-sm sm:grid-cols-2'>
                {detail.checklist.items.map(({ id, title: name, found, next }) => (
                  <li key={id} className='flex items-center gap-2'>
                    <span
                      aria-hidden='true'
                      className={found ? 'text-success' : 'text-foreground-muted'}
                    >
                      {found ? '✓' : '○'}
                    </span>
                    <span>{name}</span>
                    {/* Read as "About, not yet found, next" */}
                    <span className='sr-only'>
                      {`, ${found ? detail.checklist.found : detail.checklist.notYet}`}
                    </span>
                    {next && (
                      <span className='text-xs font-bold uppercase tracking-wider text-primary-400'>
                        <span className='sr-only'>, </span>
                        {detail.checklist.next}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}
          {detail.controls && (
            <section className='mt-5'>
              <h3 className={heading}>{detail.controls.heading}</h3>
              <ul className='mt-2 space-y-1 font-mono text-sm leading-relaxed text-foreground'>
                {detail.controls.items.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          )}
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
                  <p className='mt-1 text-sm leading-relaxed text-foreground-muted'>
                    {description}
                  </p>
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
          {/* Experience and education: a title, where, when, and what was done */}
          {detail.entries && (
            <ol className='mt-4 space-y-4 border-l-2 border-line-strong pl-4'>
              {detail.entries.map(({ title: entry, place, date, points }) => (
                <li key={`${entry}-${place}`}>
                  <h3 className='font-bold text-foreground'>{entry}</h3>
                  <p className='text-sm font-semibold text-foreground'>
                    {place}
                    {date && <span className='font-normal text-foreground-muted'> · {date}</span>}
                  </p>
                  {points.length > 0 && (
                    <ul className='mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground'>
                      {points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
          {detail.links && (
            <>
              {detail.linksHeading && <h3 className={`mt-5 ${heading}`}>{detail.linksHeading}</h3>}
              <ul className='mt-4 flex flex-wrap gap-3'>
                {detail.links.map(({ href, label }) => (
                  <li key={href}>
                    <a
                      href={href}
                      target='_blank'
                      rel='noopener noreferrer'
                      className={`${styles.buttonGhost} inline-flex`}
                    >
                      {label}
                      <span className='sr-only'>{t('footer.newTab')}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          {children}
          <button
            type='button'
            onClick={close}
            className={`${styles.buttonPrimary} mt-6 gap-3 ${terminal ? 'font-mono uppercase tracking-widest' : ''}`}
          >
            {closeLabel ?? t('demos.game.backToGame')}
            {terminal && (
              <kbd
                aria-hidden='true'
                className='rounded-xs border border-current px-1.5 py-0.5 font-mono text-xs font-bold'
              >
                {t('demos.game.escKey')}
              </kbd>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

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
  settings,
  focusOnMount = false,
}) => {
  const panel = useRef(null);
  const previous = useRef(null);
  // Only read on the first screen
  const firstFocus = useEffectEvent(() => focusOnMount);
  // Per screen
  useEffect(() => {
    const from = previous.current;
    previous.current = screen;
    // Not on the first render (the Game Mode dialog itself takes focus as it opens), unless the
    // menu is back from a run (Exit to main menu): then its heading, so it is read from the top
    if (from === null) {
      if (firstFocus()) panel.current?.querySelector('h3')?.focus();
      return;
    }
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
    <div className='absolute inset-0 z-40 flex overflow-y-auto bg-background/70 p-4 backdrop-blur-sm motion-safe:animate-backdrop-in'>
      <div ref={panel} className='card-glass m-auto w-full max-w-md p-6 shadow-raised'>
        {screen === 'menu' && (
          <>
            <h3
              tabIndex={-1}
              className='font-mono text-3xl font-black uppercase tracking-widest text-foreground outline-hidden'
            >
              {t('demos.game.title')}
            </h3>
            <button
              type='button'
              onClick={onTextMode}
              className={`${styles.buttonGhost} ${MENU_BUTTON} mt-5`}
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
            {/* Settings, before the game starts */}
            <GameSettings t={t} {...settings} />
          </>
        )}
        {screen === 'story' && (
          <>
            <h3
              tabIndex={-1}
              className='font-mono text-2xl font-black uppercase tracking-widest text-primary-400 outline-hidden'
            >
              {t('demos.game.storyTitle')}
            </h3>
            <p className='mt-4 leading-relaxed text-foreground'>{t('demos.game.story')}</p>
            <p className='mt-3 leading-relaxed text-foreground'>{t('demos.game.objective')}</p>
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
              className='font-mono text-2xl font-black uppercase tracking-widest text-foreground outline-hidden'
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
  // Characters typed so far: a new line starts from none. Space, Enter on the line, or a click
  // shows it whole at once
  const [shown, finish] = useTypewriter(line, { enabled: !reduced });
  const typing = shown < line.length;

  useEffect(() => {
    box.current?.focus();
  }, []);

  const onKeyDown = (e) => {
    // Keys stay here: Escape closes this, not Game Mode. A held E does not close the line it
    // just opened
    e.stopPropagation();
    if (e.repeat) return;
    if (typing && (e.key === ' ' || (e.key === 'Enter' && e.target !== button.current))) {
      e.preventDefault();
      finish();
      return;
    }
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
      // The pause menu's Resume brings focus back here while the line is open
      data-dialogue=''
      role='dialog'
      aria-modal='true'
      aria-labelledby={titleId}
      aria-describedby={lineId}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onPointerDown={typing ? finish : undefined}
      className={`absolute inset-x-3 bottom-12 z-[45] mx-auto max-w-2xl ${DIALOG} border-primary-400/40 p-4 text-foreground outline-hidden`}
    >
      <Brackets className='text-primary-400' />
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
