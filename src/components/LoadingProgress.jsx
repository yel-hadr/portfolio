import { useProgress } from '@react-three/drei';

/**
 * LoadingProgress - slim, non-blocking progress bar for 3D assets.
 * The page content is plain DOM and usable immediately; models fade in as they arrive.
 * Owns its useProgress subscription so progress events only re-render this bar.
 */
const LoadingProgress = () => {
  const { active, progress } = useProgress();
  if (!active || progress >= 100) return null;

  return (
    <div
      role='progressbar'
      aria-label='Loading 3D scenes'
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      className='fixed top-0 inset-x-0 z-[60] h-1 bg-white/10'
    >
      <div
        className='h-full bg-primary transition-[width] duration-200 ease-out'
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

export default LoadingProgress;
