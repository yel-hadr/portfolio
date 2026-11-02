import { useId, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

import { useModalDialog } from '../hooks/useModalDialog';
import { useI18n } from '../i18n/context';
import { CloseIcon } from './icons';

/**
 * The terminal's window while its chunk is still on the way (the Suspense fallback in App): the
 * same frame, with a Close button and one line saying it is starting. It is a real dialog at once,
 * so Escape, Close, a backdrop click or Ctrl+` cancel it. Once closed, the terminal does not open
 * when its code arrives (App no longer renders it). In the main chunk, so it holds only core
 * strings: the terminal's own namespace ships with its code. `onShown` tells App it was on
 * screen, so the terminal that replaces it does not play its entrance a second time.
 */
const TerminalLoading = ({ onClose, onShown }) => {
  const { t } = useI18n();
  const statusId = useId();
  const { overlayRef, panelRef, close, onKeyDown, backdrop } = useModalDialog(onClose);

  // Focus before paint: an Escape pressed right after Ctrl+` must land in the dialog
  useLayoutEffect(() => {
    panelRef.current?.focus();
    onShown?.();
  }, [panelRef, onShown]);

  // The dialog hook stops every key at the panel, so App's document listener never sees Ctrl+`:
  // the toggle is handled here too, and stopped here as well (React has already committed the
  // close when the key reaches the document, which would read it as a press to open)
  const onPanelKeyDown = (e) => {
    if (e.code === 'Backquote' && e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    onKeyDown(e);
  };

  return createPortal(
    <div
      ref={overlayRef}
      className='fixed inset-0 z-[60] flex bg-background/80 backdrop-blur-sm motion-safe:animate-backdrop-in md:items-center md:justify-center md:p-6'
      {...backdrop}
    >
      {/* Named and described like the terminal: the line below is read as the dialog takes
          focus (a live region filled as it mounts is not announced) */}
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-label={t('nav.terminal')}
        aria-describedby={statusId}
        tabIndex={-1}
        onKeyDown={onPanelKeyDown}
        className="scheme-dark flex h-full w-full flex-col overflow-hidden bg-glass-strong font-mono text-sm text-foreground outline-hidden backdrop-blur-md md:h-[min(44rem,85vh)] md:max-w-4xl md:rounded-2xl md:border md:border-line-strong md:shadow-modal [:root[data-theme='light']_&]:bg-background/95"
      >
        <div className='flex items-center gap-3 border-b border-line bg-surface-raised/60 py-1.5 pl-4 pr-1.5'>
          <span aria-hidden='true' className='flex flex-1 gap-1.5'>
            <span className='h-3 w-3 rounded-full bg-danger' />
            <span className='h-3 w-3 rounded-full bg-primary' />
            <span className='h-3 w-3 rounded-full bg-success' />
          </span>
          <button
            type='button'
            onClick={close}
            aria-label={t('nav.closeTerminal')}
            title={t('nav.closeTerminal')}
            className='inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground'
          >
            <CloseIcon />
          </button>
        </div>
        <p id={statusId} className='p-4 text-foreground-muted'>
          {t('nav.terminalLoading')}
        </p>
      </div>
    </div>,
    document.body
  );
};

export default TerminalLoading;
