import { useState } from 'react';
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
  const [max, setMax] = useState(0);
  // drei restarts its count at 0 for each new batch (the globe after the balls): forget the last
  // batch's high mark, or the bar would sit full at 100 for the whole next download
  if (!active) {
    if (max !== 0) setMax(0);
    return null;
  }
  if (progress > max) setMax(progress);
  if (progress >= 100) return null;

  return (
    <div
      role='progressbar'
      aria-label={t('loading')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.max(max, progress))}
      className='fixed top-0 inset-x-0 z-[60] h-1 bg-foreground/10'
    >
      <div
        className='h-full bg-primary transition-[width] duration-200 ease-out'
        style={{ width: `${Math.max(max, progress)}%` }}
      />
    </div>
  );
};

export default LoadingProgress;
