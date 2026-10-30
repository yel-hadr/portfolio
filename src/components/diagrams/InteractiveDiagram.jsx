import { useId, useRef, useState } from 'react';

import { useI18n } from '../../i18n/context';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

// Edge styles per flow. Color plus a distinct dash pattern, so flows differ without color too.
// Every stroke meets 3:1 against the diagram background in both themes.
const FLOWS = {
  request: { stroke: 'stroke-primary', fill: 'fill-primary', dash: undefined },
  control: { stroke: 'stroke-secondary', fill: 'fill-secondary', dash: '8 5' },
  network: { stroke: 'stroke-info', fill: 'fill-info', dash: '2 5' },
};

// Node text lines: [font size, line height] in viewBox units. 13 is the smallest text size: at
// the smallest rendered scale (0.86, the 52rem minimum width or beside the xl panel) it stays
// above 11px.
const NAME = [15, 20];
const ROLE = [13, 18];
const META = [13, 17];
const LABEL = 13;
const POD_ROW = 18;

// Side-by-side diagram and details panel from Tailwind's xl breakpoint (keep in sync with xl:)
const SIDE_BY_SIDE = '(min-width: 1280px)';

const centerOf = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

// Where the line from the box centre toward (tx, ty) crosses the box border
const borderPoint = (b, tx, ty) => {
  const c = centerOf(b);
  const dx = tx - c.x;
  const dy = ty - c.y;
  if (!dx && !dy) return c;
  const s = Math.min(
    dx ? b.w / 2 / Math.abs(dx) : Infinity,
    dy ? b.h / 2 / Math.abs(dy) : Infinity
  );
  return { x: c.x + dx * s, y: c.y + dy * s };
};

const toPath = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');

// Edge geometry: explicit `points`, else a straight line between the two box borders
const edgePoints = (edge, boxes) => {
  if (edge.points) return edge.points;
  const a = boxes[edge.from];
  const b = boxes[edge.to];
  const ca = centerOf(a);
  const cb = centerOf(b);
  const p = borderPoint(a, cb.x, cb.y);
  const q = borderPoint(b, ca.x, ca.y);
  return [
    [p.x, p.y],
    [q.x, q.y],
  ];
};

// Drawn rather than typed: the self-hosted Geist subset has no arrow glyphs
const ARROWS = {
  to: 'M3 8h10M9 4l4 4-4 4',
  from: 'M13 8H3M7 4L3 8l4 4',
  with: 'M2 8h12M5 5L2 8l3 3M11 5l3 3-3 3',
};

const DirectionArrow = ({ dir }) => (
  <svg
    aria-hidden='true'
    viewBox='0 0 16 16'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.75'
    strokeLinecap='round'
    strokeLinejoin='round'
    className='mr-1.5 inline-block h-4 w-4 -translate-y-px align-middle text-primary-400'
  >
    <path d={ARROWS[dir]} />
  </svg>
);

/** What a component is, its facts and its connections: used by the live panel and the list. */
const NodeDetails = ({ ns, id, edges, nameOf, headingLevel: H }) => {
  const { t } = useI18n();
  const facts = t(`${ns}.nodes.${id}.facts`);
  const links = edges.filter((e) => e.from === id || e.to === id);

  return (
    <>
      <H className='text-lg font-bold text-foreground'>{t(`${ns}.nodes.${id}.name`)}</H>
      <p className='text-sm font-semibold text-primary-400'>{t(`${ns}.nodes.${id}.role`)}</p>
      <p className='mt-2 text-sm leading-relaxed text-foreground-muted'>
        {t(`${ns}.nodes.${id}.description`)}
      </p>
      {Array.isArray(facts) && facts.length > 0 && (
        <ul className='mt-3 space-y-1.5 text-sm leading-snug text-foreground'>
          {facts.map((fact) => (
            <li key={fact} className='flex gap-2'>
              <span
                aria-hidden='true'
                className='mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary'
              />
              <span className='min-w-0 break-words'>{fact}</span>
            </li>
          ))}
        </ul>
      )}
      {links.length > 0 && (
        <>
          <p className='mt-4 text-xs font-semibold uppercase tracking-wider text-foreground-muted'>
            {t('diagrams.modal.connections')}
          </p>
          <ul className='mt-1.5 space-y-1 text-sm text-foreground'>
            {links.map((e) => {
              const outgoing = e.from === id;
              const dir = e.both ? 'with' : outgoing ? 'to' : 'from';
              return (
                <li key={e.id} className='break-words'>
                  <DirectionArrow dir={dir} />
                  <span className='sr-only'>{t(`diagrams.modal.${dir}`)} </span>
                  <span className='font-semibold'>{nameOf(outgoing ? e.to : e.from)}</span>
                  <span className='text-foreground-muted'> · {t(`${ns}.edges.${e.id}`)}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
};

const LegendSwatch = ({ flow }) => (
  <svg aria-hidden='true' viewBox='0 0 32 8' className='h-2 w-8 shrink-0'>
    <path
      d='M1 4h30'
      className={FLOWS[flow].stroke}
      strokeWidth='2.5'
      strokeDasharray={FLOWS[flow].dash}
      strokeLinecap='round'
      fill='none'
    />
  </svg>
);

/**
 * Hand-built SVG architecture diagram. Each node is a focusable button: hover, focus or click
 * highlights it and its edges, and fills the live details panel. The same details are also
 * rendered as a plain list for screen readers and phones.
 *
 * spec: { width, height, groups, nodes, edges, packets, legend }
 *   groups: [{ id, x, y, w, h, kind: 'boundary' | 'network', label: [x, y] }]
 *   nodes:  [{ id, x, y, w, h, pods? }]
 *   edges:  [{ id, from, to, flow, points?, label: [x, y, anchor?], both? }]
 *   packets: [[edgeId, ...]] request routes animated with moving dots
 *   legend: [{ flow, key }]
 * ns: the translation prefix holding nodes.<id>, edges.<id> and groups.<id>.
 * headingLevel: the tag for component names, one below the heading that contains the diagram.
 */
const InteractiveDiagram = ({ spec, ns, title, headingLevel = 'h3' }) => {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const uid = useId().replace(/:/g, '');
  const [hovered, setHovered] = useState(null);
  const [focused, setFocused] = useState(null);
  const [selected, setSelected] = useState(null);
  // The request-path packets loop; visitors can stop them (WCAG 2.2.2 Pause, Stop, Hide)
  const [paused, setPaused] = useState(false);
  const active = hovered ?? focused ?? selected;
  const detailsRef = useRef(null);

  const boxes = Object.fromEntries([...spec.groups, ...spec.nodes].map((b) => [b.id, b]));
  const nodeIds = new Set(spec.nodes.map((n) => n.id));
  const nameOf = (id) =>
    nodeIds.has(id) ? t(`${ns}.nodes.${id}.name`) : t(`${ns}.groups.${id}.name`);

  const linked = (e) => active && (e.from === active || e.to === active);
  const neighbours = new Set(
    spec.edges.filter(linked).flatMap((e) => [e.from, e.to].filter((id) => id !== active))
  );

  // A packet route is a list of edge ids; the dot follows their drawn lines end to end
  const packetPaths =
    spec.packets?.map((route) =>
      toPath(
        route.flatMap((id) =>
          edgePoints(
            spec.edges.find((e) => e.id === id),
            boxes
          )
        )
      )
    ) ?? [];

  // A tap on a phone fills a panel stacked below the diagram, often off screen: bring it into
  // view. Only on click: focus and hover must not scroll the page.
  const onNodeClick = (id) => {
    const selecting = selected !== id;
    setSelected(selecting ? id : null);
    if (!selecting || window.matchMedia(SIDE_BY_SIDE).matches) return;
    requestAnimationFrame(() =>
      detailsRef.current?.scrollIntoView({
        block: 'nearest',
        behavior: reduced ? 'auto' : 'smooth',
      })
    );
  };

  const onNodeKeyDown = (e, id) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelected((s) => (s === id ? null : id));
    }
  };

  return (
    <div>
      <div className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]'>
        <div className='min-w-0'>
          <ul
            aria-label={t('diagrams.modal.legend')}
            className='mb-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-foreground-muted'
          >
            {spec.legend.map(({ flow, key }) => (
              <li key={flow} className='flex items-center gap-2'>
                <LegendSwatch flow={flow} />
                {t(key)}
              </li>
            ))}
          </ul>
          {!reduced && packetPaths.length > 0 && (
            <button
              type='button'
              aria-pressed={paused}
              onClick={() => setPaused((p) => !p)}
              className='mb-3 inline-flex items-center gap-2 rounded-lg border border-line-strong px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-raised'
            >
              <svg aria-hidden='true' viewBox='0 0 16 16' className='h-4 w-4' fill='currentColor'>
                {paused ? <path d='M4 2.5v11l9-5.5z' /> : <path d='M4 2.5h3v11H4zM9 2.5h3v11H9z' />}
              </svg>
              {t('diagrams.modal.pauseAnimation')}
            </button>
          )}
          <p className='mb-2 text-sm text-foreground-muted xl:hidden'>
            {t('diagrams.modal.scrollHint')}
          </p>
          <div className='overflow-x-auto overscroll-x-contain rounded-2xl border border-line bg-background'>
            <svg
              viewBox={`0 0 ${spec.width} ${spec.height}`}
              role='group'
              aria-label={t('diagrams.modal.diagramLabel', { name: title })}
              className='block h-auto w-full min-w-[52rem] select-none xl:min-w-0'
            >
              <defs>
                {Object.entries(FLOWS).map(([flow, style]) => (
                  <marker
                    key={flow}
                    id={`${uid}-${flow}`}
                    viewBox='0 0 10 10'
                    refX='9'
                    refY='5'
                    markerWidth='9'
                    markerHeight='9'
                    markerUnits='userSpaceOnUse'
                    orient='auto-start-reverse'
                  >
                    <path d='M0 0L10 5L0 10z' className={style.fill} />
                  </marker>
                ))}
              </defs>

              {/* Boundaries (cloud, VM, cluster) and networks: context, not interactive */}
              <g aria-hidden='true'>
                {spec.groups.map((g) => (
                  <g key={g.id}>
                    <rect
                      x={g.x}
                      y={g.y}
                      width={g.w}
                      height={g.h}
                      rx={g.kind === 'network' ? 14 : 20}
                      className={
                        g.kind === 'network'
                          ? 'fill-info/5 stroke-info'
                          : 'fill-foreground/[0.02] stroke-line-strong'
                      }
                      strokeWidth='1.25'
                      strokeDasharray={g.kind === 'network' ? '3 5' : '7 6'}
                    />
                    <text
                      x={g.label[0]}
                      y={g.label[1]}
                      fontSize={LABEL}
                      fontWeight='600'
                      className={g.kind === 'network' ? 'fill-info' : 'fill-foreground-muted'}
                    >
                      {t(`${ns}.groups.${g.id}.label`)}
                    </text>
                  </g>
                ))}
              </g>

              {/* Edges, then their labels on a halo so they stay legible over lines */}
              <g aria-hidden='true'>
                {spec.edges.map((e) => {
                  const on = linked(e);
                  const style = FLOWS[e.flow];
                  return (
                    <path
                      key={e.id}
                      d={toPath(edgePoints(e, boxes))}
                      fill='none'
                      className={`${style.stroke} transition-[opacity,stroke-width] duration-200 ${active && !on ? 'opacity-30' : ''}`}
                      strokeWidth={on ? 3 : 1.75}
                      strokeDasharray={style.dash}
                      strokeLinejoin='round'
                      markerEnd={`url(#${uid}-${e.flow})`}
                      markerStart={e.both ? `url(#${uid}-${e.flow})` : undefined}
                    />
                  );
                })}
              </g>

              {!reduced && !paused && packetPaths.length > 0 && (
                <g aria-hidden='true' className='pointer-events-none'>
                  {packetPaths.map((d, i) =>
                    [0, 1].map((k) => (
                      <circle key={`${i}-${k}`} r='4.5' className='fill-primary'>
                        <animateMotion
                          dur='4.8s'
                          repeatCount='indefinite'
                          path={d}
                          begin={`${(i * 1.6 + k * 2.4).toFixed(1)}s`}
                        />
                      </circle>
                    ))
                  )}
                </g>
              )}

              <g aria-hidden='true'>
                {spec.edges.map((e) => {
                  const [x, y, anchor = 'start'] = e.label;
                  return (
                    <text
                      key={e.id}
                      x={x}
                      y={y}
                      textAnchor={anchor}
                      fontSize={LABEL}
                      fontWeight={linked(e) ? 600 : 500}
                      stroke='currentColor'
                      strokeWidth='5'
                      strokeLinejoin='round'
                      paintOrder='stroke'
                      className={`text-background ${linked(e) ? 'fill-primary-400' : 'fill-foreground-muted'}`}
                    >
                      {t(`${ns}.edges.${e.id}`)}
                    </text>
                  );
                })}
              </g>

              {/* Components */}
              {spec.nodes.map((n) => {
                const isActive = n.id === active;
                const isNeighbour = neighbours.has(n.id);
                const meta = t(`${ns}.nodes.${n.id}.meta`);
                const lines = [
                  {
                    text: t(`${ns}.nodes.${n.id}.name`),
                    size: NAME,
                    cls: 'fill-foreground',
                    weight: 700,
                  },
                  {
                    text: t(`${ns}.nodes.${n.id}.role`),
                    size: ROLE,
                    cls: 'fill-primary-400',
                    weight: 600,
                  },
                  ...(Array.isArray(meta) ? meta : []).map((m) => ({
                    text: m,
                    size: META,
                    cls: 'fill-foreground-muted',
                    weight: 500,
                  })),
                ];
                const podsH = n.pods ? POD_ROW : 0;
                const blockH = lines.reduce((sum, l) => sum + l.size[1], 0) + podsH;
                let y = n.y + (n.h - blockH) / 2;
                const cx = n.x + n.w / 2;

                return (
                  <g
                    key={n.id}
                    role='button'
                    tabIndex={0}
                    aria-label={t(`${ns}.nodes.${n.id}.name`)}
                    aria-pressed={selected === n.id}
                    className='group cursor-pointer outline-hidden'
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setFocused(n.id)}
                    onBlur={() => setFocused(null)}
                    onClick={() => onNodeClick(n.id)}
                    onKeyDown={(e) => onNodeKeyDown(e, n.id)}
                  >
                    {/* Keyboard focus ring (SVG elements get no reliable outline) */}
                    <rect
                      x={n.x - 5}
                      y={n.y - 5}
                      width={n.w + 10}
                      height={n.h + 10}
                      rx='16'
                      fill='none'
                      strokeWidth='2.5'
                      className='stroke-focus opacity-0 group-focus-visible:opacity-100'
                    />
                    <rect
                      x={n.x}
                      y={n.y}
                      width={n.w}
                      height={n.h}
                      rx='12'
                      strokeWidth={isActive ? 2.5 : isNeighbour || selected === n.id ? 2 : 1.25}
                      className={`transition-colors duration-200 ${
                        isActive
                          ? 'fill-surface-raised stroke-primary'
                          : isNeighbour
                            ? 'fill-surface stroke-primary-400'
                            : selected === n.id
                              ? 'fill-surface stroke-primary'
                              : 'fill-surface stroke-line-strong group-hover:stroke-foreground-muted'
                      }`}
                    />
                    {lines.map((l, i) => {
                      y += l.size[1];
                      return (
                        <text
                          key={i}
                          x={cx}
                          y={y - (l.size[1] - l.size[0]) / 2 - 2}
                          textAnchor='middle'
                          fontSize={l.size[0]}
                          fontWeight={l.weight}
                          className={l.cls}
                        >
                          {l.text}
                        </text>
                      );
                    })}
                    {n.pods &&
                      Array.from({ length: n.pods }, (_, i) => (
                        <circle
                          key={i}
                          aria-hidden='true'
                          cx={cx + (i - (n.pods - 1) / 2) * 18}
                          cy={y + POD_ROW / 2}
                          r='5.5'
                          className='fill-primary/25 stroke-primary'
                          strokeWidth='1.5'
                        />
                      ))}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div
          ref={detailsRef}
          aria-live='polite'
          aria-label={t('diagrams.modal.detailsLabel')}
          role='region'
          className='self-start rounded-2xl border border-line bg-surface p-5 xl:sticky xl:top-0'
        >
          {active ? (
            <NodeDetails
              ns={ns}
              id={active}
              edges={spec.edges}
              nameOf={nameOf}
              headingLevel={headingLevel}
            />
          ) : (
            <p className='text-sm leading-relaxed text-foreground-muted'>
              {t('diagrams.modal.intro')}
            </p>
          )}
        </div>
      </div>

      <details className='group/list mt-6 rounded-2xl border border-line bg-surface'>
        <summary className='flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl px-5 py-3 font-semibold text-foreground'>
          <svg
            aria-hidden='true'
            viewBox='0 0 20 20'
            className='h-4 w-4 shrink-0 transition-transform group-open/list:rotate-90'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          >
            <path d='M7 4l6 6-6 6' />
          </svg>
          {t('diagrams.modal.list', { count: spec.nodes.length })}
        </summary>
        <ul className='grid grid-cols-1 gap-4 border-t border-line p-5 md:grid-cols-2'>
          {spec.nodes.map((n) => (
            <li key={n.id} className='rounded-xl border border-line bg-background/40 p-4'>
              <NodeDetails
                ns={ns}
                id={n.id}
                edges={spec.edges}
                nameOf={nameOf}
                headingLevel={headingLevel}
              />
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
};

export default InteractiveDiagram;
