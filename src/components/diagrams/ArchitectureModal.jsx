import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

import { useModalDialog } from '../../hooks/useModalDialog';
import { useI18n } from '../../i18n/context';
import { registerNamespace } from '../../i18n/dictionaries';
import en from '../../locales/en/diagrams.json';
import fr from '../../locales/fr/diagrams.json';
import { CloseIcon } from '../icons';
import Cloud1Diagram from './Cloud1Diagram';
import IotDiagram from './IotDiagram';

// The diagram strings ship with this lazy chunk, not with the page
registerNamespace('diagrams', { en, fr });

const DIAGRAMS = {
  cloud1: { ns: 'diagrams.cloud1', Diagram: Cloud1Diagram },
  iot: { ns: 'diagrams.iot', Diagram: IotDiagram },
};

/**
 * Architecture diagram dialog, opened from a project card in Works. useModalDialog makes the
 * rest of the page inert, locks page scroll, traps Tab and closes on Escape, the close button or
 * a backdrop click. The caller restores focus in onClose.
 */
const ArchitectureModal = ({ diagram, onClose }) => {
  const { t } = useI18n();
  const titleId = useId();
  const descId = useId();
  const { overlayRef, panelRef, close, onKeyDown, backdrop } = useModalDialog(onClose);

  const { ns, Diagram } = DIAGRAMS[diagram] ?? DIAGRAMS.cloud1;

  useEffect(() => {
    panelRef.current?.focus();
  }, [panelRef]);

  return createPortal(
    <div
      ref={overlayRef}
      className='fixed inset-0 z-[60] flex justify-center bg-background/75 backdrop-blur-sm sm:[@media(min-height:30rem)]:items-center sm:[@media(min-height:30rem)]:p-6'
      {...backdrop}
    >
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className='flex h-full w-full max-w-7xl flex-col overflow-hidden bg-glass-strong shadow-2xl backdrop-blur-xl sm:[@media(min-height:30rem)]:h-auto sm:[@media(min-height:30rem)]:max-h-full sm:[@media(min-height:30rem)]:rounded-3xl sm:[@media(min-height:30rem)]:border sm:[@media(min-height:30rem)]:border-line'
      >
        {/* Only the title row stays fixed, so short viewports keep most of the height to scroll */}
        <div className='flex items-center gap-4 border-b border-line px-4 py-2 sm:px-8 [@media(min-height:30rem)]:py-4 sm:[@media(min-height:30rem)]:py-5'>
          <h2
            id={titleId}
            className='min-w-0 flex-1 text-base font-black text-foreground [@media(min-height:30rem)]:text-xl sm:[@media(min-height:30rem)]:text-2xl'
          >
            {t(`${ns}.title`)}
          </h2>
          <button
            type='button'
            onClick={close}
            aria-label={t('diagrams.modal.close')}
            className='inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-surface text-foreground transition-colors hover:border-foreground-muted'
          >
            <CloseIcon className='h-5 w-5' />
          </button>
        </div>
        <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-8 sm:[@media(min-height:30rem)]:py-6'>
          <p
            id={descId}
            className='mb-5 max-w-4xl text-sm leading-relaxed text-foreground-muted sm:text-base'
          >
            {t(`${ns}.description`)}
          </p>
          <Diagram title={t(`${ns}.title`)} />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ArchitectureModal;
