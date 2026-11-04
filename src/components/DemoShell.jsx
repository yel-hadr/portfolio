import {
  Suspense,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import CanvasErrorBoundary from './CanvasErrorBoundary';
import { useDemoCanvas } from '../hooks/useDemoCanvas';
import { useModalDialog } from '../hooks/useModalDialog';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useI18n } from '../i18n/context';
import { registerNamespace } from '../i18n/dictionaries';
import en from '../locales/en/demos.json';
import fr from '../locales/fr/demos.json';
import { CloseIcon, GithubIcon } from './icons';
import { SPRING_TIMING } from '../utils/motion';

// The demo strings ship with the lazy demo chunks (Cub3DModal and FdfModal import this shell)
registerNamespace('demos', { en, fr });

// Closing: quick and accelerating, as the opening is a settling spring
const SHRINK_MS = 260;

// Without WebGL a demo shows what it looks like instead: the blog posts' own screenshots
// (public/blog-media/), sized from the files so nothing shifts as they load
const MEDIA = `${import.meta.env.BASE_URL}blog-media/`;
const SCREENSHOTS = {
  cub3d: [{ key: 'map', src: 'cub3d-raycasting-from-c-to-webgl/cub3d-demo.webp', w: 1142, h: 686 }],
  fdf: [
    {
      key: 'julia',
      src: 'fdf-isometric-projection-and-memory/julia-altitude.webp',
      w: 862,
      h: 694,
    },
    {
      key: 'mars',
      src: 'fdf-isometric-projection-and-memory/mars-iso-vs-perspective.webp',
      w: 1200,
      h: 480,
    },
  ],
};

/** No WebGL: the notice, then the demo's screenshots with their captions, scrolling in the panel */
const Screenshots = ({ id, noticeId }) => {
  const { t } = useI18n();
  return (
    // A named, focusable region: the dialog's Tab cycle reaches it, so the keyboard scrolls it
    // (inset ring: the panel's rounded edge clips an outline)
    <div
      tabIndex={0}
      role='region'
      aria-label={t('demos.screenshots.label')}
      className='absolute inset-0 overflow-y-auto overscroll-contain p-4 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus md:p-6'
    >
      <p
        id={noticeId}
        role='status'
        className='mx-auto max-w-2xl text-center leading-relaxed text-foreground'
      >
        {`${t('demos.noWebgl')} ${t('demos.screenshots.intro')}`}
      </p>
      <div className='mx-auto mt-6 grid max-w-4xl gap-6'>
        {(SCREENSHOTS[id] ?? []).map(({ key, src, w, h }) => (
          <figure key={key}>
            <img
              src={`${MEDIA}${src}`}
              width={w}
              height={h}
              loading='lazy'
              decoding='async'
              alt={t(`demos.screenshots.${key}.alt`)}
              className='h-auto w-full rounded-xl border border-line'
            />
            <figcaption className='mt-2 text-sm leading-relaxed text-foreground-muted'>
              {t(`demos.screenshots.${key}.caption`)}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
};

/** A message in place of the demo: loading, no WebGL, or a failure */
const Notice = ({ id, role, children }) => (
  <div className='flex h-full items-center justify-center p-6'>
    <p id={id} role={role} className='max-w-md text-center leading-relaxed text-foreground'>
      {children}
    </p>
  </div>
);

/**
 * The dialog around a live 3D demo (cub3D, FdF). useModalDialog makes the page inert, traps Tab
 * and closes on Escape, the close button or a backdrop click; the caller restores focus.
 *
 * The demo brings its own Canvas, so the page's shared Canvas is paused while the dialog is open
 * and the demo mounts once R3F has released the page's WebGL context (useDemoCanvas): never two
 * contexts at once. Without WebGL the dialog says so and shows the demo's screenshots; if the
 * demo fails, it says so. Either way it keeps the source link.
 *
 * Opened from a project card, the panel grows out of that card (`origin`, the card's box): it
 * starts at the card's position and size and springs to its own, then its content fades in. The
 * demo's canvas mounts after that. Closing plays it backwards: the panel shrinks into the card as
 * the backdrop fades, then the dialog unmounts. Neither under reduced motion (instant).
 */
const DemoShell = ({ id, repo, onClose, origin, children }) => {
  const { t } = useI18n();
  const { webgl, ready } = useDemoCanvas();
  const titleId = useId();
  const descId = useId();
  // On a phone or a short screen the description folds behind "About this project", so the demo
  // keeps the height (read once: a later resize keeps the visitor's choice)
  const [compact] = useState(
    () => window.matchMedia('(max-width: 767px), (max-height: 500px)').matches
  );
  const noticeId = useId();
  const reduced = usePrefersReducedMotion();
  // Closing shrinks the panel back into its card first (below); a second close meanwhile is ignored
  const closing = useRef(false);
  // The dialog's panel and overlay, from useModalDialog below (set in a layout effect: the close
  // handler is declared before the hook that owns them)
  const shell = useRef({ panel: null, overlay: null });
  const shrinkThenClose = () => {
    if (closing.current) return;
    closing.current = true;
    const { panel, overlay } = shell.current;
    const to = panel?.getBoundingClientRect();
    if (!panel || !origin || reduced || !to?.width) {
      onClose();
      return;
    }
    panel.style.setProperty('transform-origin', 'top left');
    const shrink = panel.animate(
      [
        { transform: 'none', opacity: 1 },
        {
          transform: `translate(${origin.left - to.left}px, ${origin.top - to.top}px) scale(${origin.width / to.width}, ${origin.height / to.height})`,
          opacity: 0.4,
        },
      ],
      { duration: SHRINK_MS, easing: 'cubic-bezier(0.4, 0, 0.7, 1)', fill: 'forwards' }
    );
    overlay?.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: SHRINK_MS,
      easing: 'ease-in',
      fill: 'forwards',
    });
    shrink.finished.then(onClose, onClose);
  };
  const { overlayRef, panelRef, close, onKeyDown, backdrop } = useModalDialog(shrinkThenClose);
  useLayoutEffect(() => {
    shell.current = { panel: panelRef.current, overlay: overlayRef.current };
  });
  const name = t(`demos.${id}.name`);

  // Before the first paint: place the panel over the card, then let it spring open. Once, on
  // open (the card's box is where it was clicked), so the values are read through an effect event
  const growFromCard = useEffectEvent(() => {
    const panel = panelRef.current;
    if (!panel || !origin || reduced) return undefined;
    const to = panel.getBoundingClientRect();
    if (!to.width || !to.height) return undefined;
    const x = origin.left - to.left;
    const y = origin.top - to.top;
    const scaleX = origin.width / to.width;
    const scaleY = origin.height / to.height;
    panel.style.setProperty('transform-origin', 'top left');
    const grow = panel.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})` },
        { transform: 'none' },
      ],
      SPRING_TIMING
    );
    // The content fades in once the panel has nearly settled (backwards: hidden until then)
    const content = [...panel.children].map((child) =>
      child.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 250,
        delay: 220,
        fill: 'backwards',
      })
    );
    // Stopped early (an unmount, or StrictMode's second run): the panel as laid out
    return () => {
      grow.cancel();
      for (const fade of content) fade.cancel();
    };
  });
  useLayoutEffect(() => growFromCard(), []);

  useEffect(() => {
    panelRef.current?.focus();
  }, [panelRef]);

  return createPortal(
    <div
      ref={overlayRef}
      className='fixed inset-0 z-[60] flex justify-center bg-background/75 backdrop-blur-sm motion-safe:animate-backdrop-in md:items-center md:p-6'
      {...backdrop}
    >
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        // The notice (loading, no WebGL, failure) is part of the description, so it is read
        // when the dialog takes focus
        aria-describedby={`${descId} ${noticeId}`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        // Phones and zoomed pages scroll the whole panel; larger screens fit it
        className='flex h-full w-full flex-col overflow-y-auto bg-glass-strong md:overflow-hidden shadow-modal backdrop-blur-xl md:h-[min(52rem,92vh)] md:max-w-6xl md:rounded-3xl md:border md:border-line'
      >
        <div className='flex items-center gap-3 border-b border-line px-4 py-3 md:px-6'>
          <h2
            id={titleId}
            className='min-w-0 flex-1 text-lg font-black text-foreground md:text-2xl'
          >
            {t(`demos.${id}.title`)}
          </h2>
          <a
            href={repo}
            target='_blank'
            rel='noopener noreferrer'
            aria-label={t('demos.sourceAria', { name })}
            className='inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold text-foreground transition-colors hover:border-foreground-muted md:px-4'
          >
            <GithubIcon className='h-5 w-5' />
            <span className='hidden sm:inline'>{t('demos.source')}</span>
          </a>
          <button
            type='button'
            onClick={close}
            aria-label={t('demos.close')}
            className='inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-surface text-foreground transition-colors hover:border-foreground-muted'
          >
            <CloseIcon className='h-5 w-5' />
          </button>
        </div>
        {/* Still the dialog's description when folded: aria-describedby reads hidden text */}
        {compact ? (
          <details className='group/about border-b border-line px-4 py-1.5 text-sm md:px-6'>
            <summary className='-mx-1 flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-sm px-1 font-semibold [&::-webkit-details-marker]:hidden text-foreground-muted focus:outline-hidden focus-visible:ring-2 focus-visible:ring-focus'>
              {/* A flex summary drops the browser's marker: the chevron says it opens */}
              <svg
                aria-hidden='true'
                viewBox='0 0 20 20'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
                className='h-4 w-4 shrink-0 transition-transform group-open/about:rotate-90'
              >
                <path d='M7 4l6 6-6 6' />
              </svg>
              {t('demos.about')}
            </summary>
            <p id={descId} className='pb-1.5 leading-relaxed text-foreground-muted'>
              {t(`demos.${id}.description`)}
            </p>
          </details>
        ) : (
          <p
            id={descId}
            className='border-b border-line px-4 py-2 text-sm leading-relaxed text-foreground-muted md:px-6'
          >
            {t(`demos.${id}.description`)}
          </p>
        )}
        <div className='relative min-h-[22rem] flex-1 md:min-h-0'>
          {!webgl && <Screenshots id={id} noticeId={noticeId} />}
          {webgl && !ready && (
            <Notice id={noticeId} role='status'>
              {t('demos.loading')}
            </Notice>
          )}
          {webgl && ready && (
            <CanvasErrorBoundary
              sectionType={`demo ${id}`}
              fallback={
                <Notice id={noticeId} role='alert'>
                  {`${t('demos.failed')} ${t('demos.sourceHint')}`}
                </Notice>
              }
            >
              <Suspense fallback={<Notice role='status'>{t('demos.loading')}</Notice>}>
                {children}
              </Suspense>
            </CanvasErrorBoundary>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DemoShell;
