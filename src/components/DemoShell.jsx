import { Suspense, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

import CanvasErrorBoundary from './CanvasErrorBoundary';
import { useDemoCanvas } from '../hooks/useDemoCanvas';
import { useModalDialog } from '../hooks/useModalDialog';
import { useI18n } from '../i18n/context';
import { registerNamespace } from '../i18n/dictionaries';
import en from '../locales/en/demos.json';
import fr from '../locales/fr/demos.json';
import { CloseIcon, GithubIcon } from './icons';

// The demo strings ship with the lazy demo chunks (Cub3DModal and FdfModal import this shell)
registerNamespace('demos', { en, fr });

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
 * contexts at once. Without WebGL, or if the demo fails, the dialog says so and keeps the
 * source link.
 */
const DemoShell = ({ id, repo, onClose, children }) => {
  const { t } = useI18n();
  const { webgl, ready } = useDemoCanvas();
  const titleId = useId();
  const descId = useId();
  const noticeId = useId();
  const { overlayRef, panelRef, close, onKeyDown, backdrop } = useModalDialog(onClose);
  const name = t(`demos.${id}.name`);

  useEffect(() => {
    panelRef.current?.focus();
  }, [panelRef]);

  return createPortal(
    <div
      ref={overlayRef}
      className='fixed inset-0 z-[60] flex justify-center bg-background/75 backdrop-blur-sm md:items-center md:p-6'
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
        className='flex h-full w-full flex-col overflow-y-auto bg-glass-strong md:overflow-hidden shadow-2xl backdrop-blur-xl md:h-[min(52rem,92vh)] md:max-w-6xl md:rounded-3xl md:border md:border-line'
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
        <p
          id={descId}
          className='border-b border-line px-4 py-2 text-sm leading-relaxed text-foreground-muted md:px-6'
        >
          {t(`demos.${id}.description`)}
        </p>
        <div className='relative min-h-[22rem] flex-1 md:min-h-0'>
          {(!webgl || !ready) && (
            <Notice id={noticeId} role='status'>
              {webgl ? t('demos.loading') : `${t('demos.noWebgl')} ${t('demos.sourceHint')}`}
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
