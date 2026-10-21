import { useRef } from 'react';
import { useProgress } from '@react-three/drei';

import { useI18n } from '../i18n/context';

/**
 * LoadingProgress - slim, non-blocking progress bar for 3D assets.
 * The page content is plain DOM and usable immediately; models fade in as they arrive.
 * Owns its useProgress subscription so progress events only re-render this bar.
 */
const LoadingProgress = () => {
  const { active, progress } = useProgress();
  const { t } = useI18n();
  // The total grows as lazy scene chunks register their loads, so the raw value can drop;
  // only ever show the highest value seen.
  const max = useRef(0);
  max.current = Math.max(max.current, progress);
  if (!active || progress >= 100) return null;

  return (
    <div
      role='progressbar'
      aria-label={t('loading')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(max.current)}
      className='fixed top-0 inset-x-0 z-[60] h-1 bg-foreground/10'
    >
      <div
        className='h-full bg-primary transition-[width] duration-200 ease-out'
        style={{ width: `${max.current}%` }}
      />
    </div>
  );
};

export default LoadingProgress;
