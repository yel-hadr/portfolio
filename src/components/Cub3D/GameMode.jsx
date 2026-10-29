import { Suspense, lazy, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { projects, technologies } from '../../constans';
import { CONTEXT_RELEASE_MS, useDemoCanvas } from '../../hooks/useDemoCanvas';
import { useModalDialog } from '../../hooks/useModalDialog';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { useI18n } from '../../i18n/context';
import { registerNamespace } from '../../i18n/dictionaries';
import en from '../../locales/en/demos.json';
import fr from '../../locales/fr/demos.json';
import { styles } from '../../styles';
import CanvasErrorBoundary from '../CanvasErrorBoundary';
import GameText from './GameText';

registerNamespace('demos', { en, fr });

// The 3D world (three.js and R3F) is its own chunk, shared with the cub3D demo; the terminals'
// live demos load when one is opened
const Cub3DWorld = lazy(() => import('./Cub3DWorld'));
const DEMOS = {
  cub3d: lazy(() => import('./Cub3DModal')),
  fdf: lazy(() => import('../Fdf/FdfModal')),
};

const TECH_NAMES = technologies.map((tech) => tech.name);
const TECH_ICONS = technologies.map((tech) => tech.icon);
const LEAVE_MS = 250; // the fade out, as long as animate-game-out

/** A message in place of the game, with a way back */
const Message = ({ id, role, children, actions }) => (
  <div className='m-auto w-full max-w-md p-6 text-center'>
    <p id={id} role={role} className='text-lg leading-relaxed text-foreground'>
      {children}
    </p>
    {actions && <div className='mt-6 flex flex-wrap justify-center gap-3'>{actions}</div>}
  </div>
);

/**
 * Game Mode: the cub3D world full screen as an FPS, with the HUD. It covers and inerts the page
 * (useModalDialog), and pauses the page's Canvas so there is still one WebGL context. Escape,
 * or the Exit button, fades back to the page; the caller restores focus. On phones it first
 * says it is made for desktop, and lets the visitor play anyway.
 *
 * `view` is the game, the text-only mode, or a terminal's live demo. Leaving the game unmounts
 * the world (its Canvas and WebGL context go with it, before a demo makes its own) after a
 * snapshot, and the world comes back from it.
 */
const GameMode = ({ onClose }) => {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  // Decided once, on open: resizing the window mid-game must not tear the game down
  const [small] = useState(
    () => window.matchMedia('(pointer: coarse), (max-width: 767px)').matches
  );
  const [playAnyway, setPlayAnyway] = useState(false);
  const playing = !small || playAnyway;
  const { webgl, ready } = useDemoCanvas(playing);
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef(0);
  const titleId = useId();
  const descId = useId();
  const gateId = useId();
  const [view, setView] = useState('game');
  const saved = useRef(null);
  // Where a demo returns to: the game or the text-only mode
  const from = useRef('game');
  // The last demo opened, so its button in the text-only mode takes focus back
  const lastDemo = useRef(null);
  // Back from a demo: the world waits for the demo's WebGL context to be released
  const [returning, setReturning] = useState(false);
  useEffect(() => {
    if (!returning) return undefined;
    const timer = window.setTimeout(() => setReturning(false), CONTEXT_RELEASE_MS);
    return () => window.clearTimeout(timer);
  }, [returning]);

  const leave = useCallback(() => {
    if (leaveTimer.current) return;
    setLeaving(true);
    leaveTimer.current = window.setTimeout(onClose, reduced ? 0 : LEAVE_MS);
  }, [onClose, reduced]);
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  const { overlayRef, panelRef, close, onKeyDown } = useModalDialog(leave);

  // On open, and after "Play anyway" (the button that had focus is gone)
  useEffect(() => {
    panelRef.current?.focus();
  }, [panelRef, playing]);

  // What each wall opens into
  const details = useMemo(
    () => ({
      welcome: { lines: [t('demos.cub3d.panels.welcomeBody'), t('demos.game.briefing')] },
      about: { lines: [t('person.title'), t('person.summary')] },
      skills: { tags: TECH_NAMES },
      projects: {
        items: projects.map((p) => ({
          name: t(`works.items.${p.id}.name`),
          description: t(`works.items.${p.id}.description`),
          link: p.source_code_link,
        })),
      },
    }),
    [t]
  );
  // The Projects wall lists the projects that are not demos, as the cub3D demo does
  const projectNames = useMemo(
    () => projects.filter((p) => !p.demo).map((p) => t(`works.items.${p.id}.name`)),
    [t]
  );

  const back = (
    <button type='button' onClick={close} className={styles.buttonPrimary}>
      {t('demos.game.back')}
    </button>
  );
  const loading = <Message role='status'>{t('demos.loading')}</Message>;

  const openDemo = (id, snapshot) => {
    // A terminal's timer can end after Escape started the fade out
    if (leaveTimer.current) return;
    if (snapshot) saved.current = snapshot;
    from.current = view;
    lastDemo.current = id;
    setView(id);
  };
  const toText = (snapshot) => {
    if (leaveTimer.current) return;
    saved.current = snapshot;
    lastDemo.current = null;
    setView('text');
  };
  const Demo = DEMOS[view];

  // A demo comes first (it handles its own canvas, or the lack of WebGL), then the text-only mode
  // (no canvas: fine on a phone or without WebGL), then the gates, then the game
  let content;
  if (Demo) {
    // The demo is its own dialog over this one; closing it returns to the game or the text.
    // A chunk that fails to load drops back the same way
    const returnFromDemo = () => {
      setReturning(true);
      setView(from.current);
      // Until the world takes focus, the dialog keeps it, so Escape still works (the text-only
      // mode focuses its demo button itself)
      if (from.current === 'game') requestAnimationFrame(() => panelRef.current?.focus());
    };
    content = (
      <CanvasErrorBoundary
        key={view}
        sectionType={`game mode demo ${view}`}
        onError={() => {
          returnFromDemo();
          requestAnimationFrame(() => panelRef.current?.focus());
        }}
      >
        <Suspense fallback={loading}>
          {loading}
          <Demo onClose={returnFromDemo} />
        </Suspense>
      </CanvasErrorBoundary>
    );
  } else if (view === 'text') {
    content = (
      <GameText
        t={t}
        details={details}
        canPlay={playing && webgl}
        returnTo={lastDemo.current}
        onRunDemo={openDemo}
        onBack={() => setView('game')}
        onExit={close}
      />
    );
  } else if (!playing) {
    content = (
      <Message
        id={gateId}
        actions={
          <>
            {back}
            {/* The same content with no canvas suits a phone well */}
            <button type='button' onClick={() => setView('text')} className={styles.buttonGhost}>
              {t('demos.game.textMode')}
            </button>
            <button
              type='button'
              onClick={() => setPlayAnyway(true)}
              className={styles.buttonGhost}
            >
              {t('demos.game.playAnyway')}
            </button>
          </>
        }
      >
        {t('demos.game.desktopOnly')}
      </Message>
    );
  } else if (!webgl) {
    content = (
      <Message
        role='alert'
        actions={
          <>
            <button type='button' onClick={() => setView('text')} className={styles.buttonPrimary}>
              {t('demos.game.textMode')}
            </button>
            {back}
          </>
        }
      >
        {t('demos.noWebgl')}
      </Message>
    );
  } else if (!ready || returning) {
    content = loading;
  } else {
    content = (
      <CanvasErrorBoundary
        sectionType='game mode'
        // The failed view may have had focus: keep it in the dialog, where Escape works
        onError={() => requestAnimationFrame(() => panelRef.current?.focus())}
        fallback={
          <Message role='alert' actions={back}>
            {t('demos.failed')}
          </Message>
        }
      >
        <Suspense fallback={loading}>
          <Cub3DWorld
            t={t}
            technologies={TECH_NAMES}
            projects={projectNames}
            game
            details={details}
            techIcons={TECH_ICONS}
            initialState={saved.current}
            onOpenDemo={openDemo}
            onTextMode={toText}
            onExit={close}
          />
        </Suspense>
      </CanvasErrorBoundary>
    );
  }

  return createPortal(
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-[60] bg-background ${
        leaving ? 'motion-safe:animate-game-out' : 'motion-safe:animate-game-in'
      }`}
    >
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        // On phones the desktop-only message is what the dialog is about
        aria-describedby={playing || view !== 'game' ? descId : gateId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className='flex h-full w-full outline-none'
      >
        <h2 id={titleId} className='sr-only'>
          {t('demos.game.title')}
        </h2>
        <p id={descId} className='sr-only'>
          {t('demos.game.description')}
        </p>
        {content}
      </div>
    </div>,
    document.body
  );
};

export default GameMode;
