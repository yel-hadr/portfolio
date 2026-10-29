import { useI18n } from '../i18n/context';
import { formatMs, statsOf } from './format';

const W = 160;
const H = 40;
const PAD = 3;

/**
 * 24-hour response-time trend of one monitor. The line joins successful checks; a failed check
 * breaks it and shows as a tick on the baseline. The SVG's label states the same numbers.
 */
const Sparkline = ({ points, from, to }) => {
  const { t, lang } = useI18n();
  const stats = statsOf(points);
  const values = points.filter((p) => p.ok && p.ms !== null).map((p) => p.ms);

  if (points.length < 2) {
    return <p className='text-xs text-foreground-muted'>{t('statuspage.monitors.sparkEmpty')}</p>;
  }

  const max = Math.max(...values, 1);
  const x = (time) => PAD + ((time - from) / Math.max(1, to - from)) * (W - 2 * PAD);
  const y = (ms) => H - PAD - (ms / max) * (H - 2 * PAD - 4);

  // One path segment per run of successful checks
  let d = '';
  let open = false;
  points.forEach((p) => {
    if (p.ok && p.ms !== null) {
      d += `${open ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.ms).toFixed(1)}`;
      open = true;
    } else {
      open = false;
    }
  });

  const label = t('statuspage.monitors.sparkLabel', {
    count: stats.count,
    median: formatMs(stats.median, lang),
    max: formatMs(stats.max, lang),
    failed: stats.failed,
  });

  return (
    <svg
      role='img'
      aria-label={label}
      viewBox={`0 0 ${W} ${H}`}
      className='h-10 w-40 overflow-visible'
    >
      <line
        x1={PAD}
        x2={W - PAD}
        y1={H - PAD}
        y2={H - PAD}
        className='stroke-line-strong'
        strokeWidth='1'
      />
      <path
        d={d}
        fill='none'
        className='stroke-secondary'
        strokeWidth='2'
        strokeLinejoin='round'
        strokeLinecap='round'
      />
      {/* Lone successful points between failures would be invisible as a path */}
      {points.map((p, i) => {
        if (!p.ok) {
          return (
            <line
              key={p.t}
              x1={x(p.t)}
              x2={x(p.t)}
              y1={H - PAD}
              y2={H - PAD - 8}
              className='stroke-danger'
              strokeWidth='2'
            />
          );
        }
        const isolated = !points[i - 1]?.ok && !points[i + 1]?.ok && p.ms !== null;
        return isolated ? (
          <circle key={p.t} cx={x(p.t)} cy={y(p.ms)} r='1.75' className='fill-secondary' />
        ) : null;
      })}
    </svg>
  );
};

export default Sparkline;
