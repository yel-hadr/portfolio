import { useEffect, useRef, useState } from 'react';

import { useI18n } from '../i18n/context';
import {
  DAY,
  dateTime,
  dayStart,
  formatMs,
  formatPct,
  seriesOf,
  shortDay,
  statsOf,
} from './format';

const HEIGHT = 220;
const M = { top: 12, right: 12, bottom: 28, left: 56 };

// Axis step of 1, 2 or 5 x 10^n giving at most 4 intervals
const niceStep = (max) => {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 5, 10].map((k) => k * pow).find((s) => s >= raw) ?? 10 * pow;
};

const useWidth = (ref) => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
};

/**
 * One service's response time over 7 days, with a hover crosshair. A failed check breaks the line
 * and shows as a tick under it. Screen readers get the summary in the SVG label and the same data
 * per day in the table below.
 */
const ResponseChart = ({ monitor, name, samples, now }) => {
  const { t, lang } = useI18n();
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [hover, setHover] = useState(null);

  const from = now - 7 * DAY;
  const points = seriesOf(samples, monitor.id, from);
  const stats = statsOf(points);
  const okValues = points.filter((p) => p.ok && p.ms !== null).map((p) => p.ms);

  const step = niceStep(Math.max(...okValues, 100));
  const top = Math.ceil(Math.max(...okValues, 100) / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = HEIGHT - M.top - M.bottom;
  const x = (time) => M.left + ((time - from) / (now - from)) * plotW;
  const y = (ms) => M.top + plotH - (ms / top) * plotH;

  let d = '';
  let open = false;
  points.forEach((p) => {
    if (p.ok && p.ms !== null) {
      d += `${open ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.ms).toFixed(1)}`;
      open = true;
    } else open = false;
  });

  // Local midnights in range; every other label on narrow screens
  const days = Array.from({ length: 8 }, (_, i) => dayStart(now, i)).filter((d0) => d0 > from);
  const labelEvery = plotW < 420 ? 2 : 1;

  const onMove = (e) => {
    if (!points.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const time = from + ((e.clientX - rect.left - M.left) / plotW) * (now - from);
    let best = points[0];
    points.forEach((p) => {
      if (Math.abs(p.t - time) < Math.abs(best.t - time)) best = p;
    });
    setHover(best);
  };

  const label = t('statuspage.metrics.chartLabel', {
    name,
    count: stats.count,
    median: formatMs(stats.median, lang),
    p95: formatMs(stats.p95, lang),
    failed: stats.failed,
  });

  const perDay = Array.from({ length: 7 }, (_, i) => dayStart(now, 6 - i)).map((start) => ({
    start,
    ...statsOf(points.filter((p) => p.t >= start && p.t < start + DAY)),
  }));

  return (
    <div>
      <div ref={wrapRef} className='relative'>
        {okValues.length === 0 ? (
          <p className='py-8 text-sm text-foreground-muted'>{t('statuspage.metrics.chartEmpty')}</p>
        ) : (
          width > 0 && (
            <svg
              role='img'
              aria-label={label}
              width={width}
              height={HEIGHT}
              className='block touch-pan-y'
              onPointerMove={onMove}
              onPointerDown={onMove}
              onPointerLeave={() => setHover(null)}
            >
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={M.left}
                    x2={M.left + plotW}
                    y1={y(tick)}
                    y2={y(tick)}
                    className={tick === 0 ? 'stroke-line-strong' : 'stroke-line'}
                    strokeWidth='1'
                  />
                  <text
                    x={M.left - 8}
                    y={y(tick)}
                    dy='0.32em'
                    textAnchor='end'
                    className='fill-foreground-muted text-xs tabular-nums'
                  >
                    {formatMs(tick, lang)}
                  </text>
                </g>
              ))}
              {days.map((day, i) => (
                <g key={day}>
                  <line
                    x1={x(day)}
                    x2={x(day)}
                    y1={M.top + plotH}
                    y2={M.top + plotH + 4}
                    className='stroke-line-strong'
                  />
                  {i % labelEvery === 0 && x(day) + 30 < M.left + plotW + M.right && (
                    <text x={x(day) + 4} y={HEIGHT - 8} className='fill-foreground-muted text-xs'>
                      {shortDay(day, lang)}
                    </text>
                  )}
                </g>
              ))}
              <path
                d={d}
                fill='none'
                className='stroke-secondary'
                strokeWidth='2'
                strokeLinejoin='round'
                strokeLinecap='round'
              />
              {points
                .filter((p) => !p.ok)
                .map((p) => (
                  <line
                    key={p.t}
                    x1={x(p.t)}
                    x2={x(p.t)}
                    y1={M.top + plotH}
                    y2={M.top + plotH - 10}
                    className='stroke-danger'
                    strokeWidth='2'
                  />
                ))}
              {hover && (
                <g aria-hidden='true'>
                  <line
                    x1={x(hover.t)}
                    x2={x(hover.t)}
                    y1={M.top}
                    y2={M.top + plotH}
                    className='stroke-foreground-muted'
                    strokeDasharray='3 3'
                  />
                  {hover.ok && hover.ms !== null && (
                    <circle
                      cx={x(hover.t)}
                      cy={y(hover.ms)}
                      r='4'
                      className='fill-secondary stroke-background'
                      strokeWidth='2'
                    />
                  )}
                </g>
              )}
            </svg>
          )
        )}
        {hover && width > 0 && (
          <div
            aria-hidden='true'
            className='pointer-events-none absolute top-0 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs shadow-lg light:shadow-raised'
            style={{
              left: Math.min(Math.max(x(hover.t) - 70, 0), width - 140),
              width: 140,
            }}
          >
            <span className='block text-foreground-muted'>{dateTime(hover.t, lang)}</span>
            <span className={`block font-semibold ${hover.ok ? 'text-foreground' : 'text-danger'}`}>
              {hover.ok
                ? formatMs(hover.ms, lang)
                : `${t('statuspage.monitors.down')}${hover.code ? ` (HTTP ${hover.code})` : ''}`}
            </span>
          </div>
        )}
      </div>

      {stats.failed > 0 && (
        <p className='mt-2 flex items-center gap-2 text-xs text-foreground-muted'>
          <svg aria-hidden='true' width='12' height='12' className='shrink-0'>
            <line x1='6' x2='6' y1='1' y2='11' className='stroke-danger' strokeWidth='2' />
          </svg>
          {t('statuspage.metrics.failedLegend')}
        </p>
      )}

      <details className='mt-4 text-sm'>
        <summary className='w-fit cursor-pointer rounded-sm font-medium text-foreground'>
          {t('statuspage.metrics.tableToggle')}
        </summary>
        {/* Focusable so keyboard users can scroll it on narrow screens */}
        <div
          role='region'
          aria-label={t('statuspage.metrics.tableCaption', { name })}
          tabIndex={0}
          className='mt-3 overflow-x-auto rounded-sm'
        >
          <table className='w-full min-w-[28rem] text-left tabular-nums'>
            <caption className='mb-2 text-left text-foreground-muted'>
              {t('statuspage.metrics.tableCaption', { name })}
            </caption>
            <thead className='text-xs text-foreground-muted'>
              <tr>
                {['day', 'checks', 'uptime', 'median', 'p95', 'max'].map((key) => (
                  <th key={key} scope='col' className='py-1.5 pr-3 font-medium'>
                    {t(`statuspage.metrics.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className='text-foreground'>
              {perDay.map((row) => (
                <tr key={row.start} className='border-t border-line'>
                  <th scope='row' className='py-1.5 pr-3 font-medium'>
                    {shortDay(row.start, lang)}
                  </th>
                  <td className='py-1.5 pr-3'>{row.count}</td>
                  <td className='py-1.5 pr-3'>{formatPct(row.uptime, lang)}</td>
                  <td className='py-1.5 pr-3'>{formatMs(row.median, lang)}</td>
                  <td className='py-1.5 pr-3'>{formatMs(row.p95, lang)}</td>
                  <td className='py-1.5 pr-3'>{formatMs(row.max, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
};

export default ResponseChart;
