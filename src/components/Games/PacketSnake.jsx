import { useCallback, useEffect, useId, useRef, useState } from 'react';

import './i18n';
import { gameStorage } from '../../constans';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { useI18n } from '../../i18n/context';
import { ChevronUpIcon, PauseIcon, PlayIcon } from '../icons';
import { readBest, saveBest } from './storage';

// Packet Snake: a snake game on a 2D canvas (not WebGL). The packet moves one cell per step,
// grows on each payload and gets faster; from score 6 firewalls go up, from 10 DDoS attacks
// appear and keep moving. Game state lives in a ref and is drawn on the canvas, so a step never
// re-renders React; only the HUD, the overlays and the announcements are React state.

const SIZE = 20; // cells per side
const START_TICK = 140; // ms per step at score 0
const MIN_TICK = 65;
const TICK_STEP = 4; // ms faster per payload
const FIREWALLS_AFTER = 5; // a firewall goes up at scores 6, 8, 10...
const DDOS_FROM = 10; // a DDoS attack appears at 10, 14 and 18
const MAX_FIREWALLS = 8;
const MAX_DDOS = 3;
const DDOS_MOVE_EVERY = 45; // steps between DDoS moves
const SWIPE_PX = 24;
const ANNOUNCE_EVERY = 5; // the score is announced every 5 points, not on every payload

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
// e.code is the physical key, so WASD is also ZQSD on an AZERTY keyboard
const KEYS = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

const STEADY_TICK = 180; // the slower, constant pace of the "steady" option
const tickFor = (score, steady) =>
  steady ? STEADY_TICK : Math.max(MIN_TICK, START_TICK - score * TICK_STEP);
const idOf = (x, y) => y * SIZE + x;
const same = (a, b) => a.x === b.x && a.y === b.y;
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const randomCell = () => ({
  x: Math.floor(Math.random() * SIZE),
  y: Math.floor(Math.random() * SIZE),
});

const isTaken = (game, cell) =>
  game.snake.some((c) => same(c, cell)) ||
  game.firewalls.has(idOf(cell.x, cell.y)) ||
  game.ddos.some((c) => same(c, cell)) ||
  (game.payload !== null && same(game.payload, cell));

/** A random free cell at least `gap` steps from the packet's head, or null */
const freeCell = (game, gap) => {
  for (let i = 0; i < 300; i += 1) {
    const cell = randomCell();
    if (!isTaken(game, cell) && distance(cell, game.snake[0]) >= gap) return cell;
  }
  return null;
};

const newGame = () => {
  const y = SIZE / 2;
  const game = {
    snake: [
      { x: 6, y },
      { x: 5, y },
      { x: 4, y },
    ],
    dir: 'right',
    queue: [],
    payload: null,
    firewalls: new Set(),
    ddos: [],
    score: 0,
    steps: 0,
    crash: null,
  };
  game.payload = freeCell(game, 3);
  return game;
};

// A wall of three cells, away from the head and off the line it is moving along
const addFirewall = (game) => {
  const head = game.snake[0];
  const [dx, dy] = DIRS[game.dir];
  const ahead = (c) =>
    [1, 2, 3, 4, 5, 6].some((n) => c.x === head.x + n * dx && c.y === head.y + n * dy);
  for (let i = 0; i < 80; i += 1) {
    const start = randomCell();
    const [sx, sy] = Math.random() < 0.5 ? [1, 0] : [0, 1];
    const cells = [0, 1, 2].map((n) => ({ x: start.x + n * sx, y: start.y + n * sy }));
    const ok = cells.every(
      (c) => c.x < SIZE && c.y < SIZE && !isTaken(game, c) && distance(c, head) >= 4 && !ahead(c)
    );
    if (ok) {
      cells.forEach((c) => game.firewalls.add(idOf(c.x, c.y)));
      return true;
    }
  }
  return false;
};

/** One step. Returns { over: reason } on a crash, { ate, event } otherwise */
const step = (game) => {
  if (game.queue.length) game.dir = game.queue.shift();
  const [dx, dy] = DIRS[game.dir];
  const head = game.snake[0];
  const next = { x: head.x + dx, y: head.y + dy };
  const ate = game.payload !== null && same(next, game.payload);
  // The tail moves out of the way this step unless the packet grows
  const body = ate ? game.snake : game.snake.slice(0, -1);

  let over = null;
  if (next.x < 0 || next.y < 0 || next.x >= SIZE || next.y >= SIZE) over = 'wall';
  else if (body.some((c) => same(c, next))) over = 'self';
  else if (game.firewalls.has(idOf(next.x, next.y))) over = 'firewall';
  else if (game.ddos.some((c) => same(c, next))) over = 'ddos';
  if (over) {
    game.crash = next;
    return { over };
  }

  game.snake = [next, ...body];
  game.steps += 1;
  if (game.ddos.length && game.steps % DDOS_MOVE_EVERY === 0) {
    // One at a time, each clear of the ones already moved and the ones still to move
    const moved = [];
    game.ddos.forEach((cell, i) => {
      const others = { ...game, ddos: [...moved, ...game.ddos.slice(i + 1)] };
      moved.push(freeCell(others, 5) ?? cell);
    });
    game.ddos = moved;
  }
  if (!ate) return { ate: false };

  game.score += 1;
  game.payload = null;
  let event = null;
  const { score } = game;
  if (score > FIREWALLS_AFTER && (score - FIREWALLS_AFTER) % 2 === 1) {
    if (game.firewalls.size < MAX_FIREWALLS * 3 && addFirewall(game)) event = 'firewall';
  }
  if (score >= DDOS_FROM && (score - DDOS_FROM) % 4 === 0 && game.ddos.length < MAX_DDOS) {
    const cell = freeCell(game, 5);
    if (cell) {
      game.ddos.push(cell);
      event = 'ddos';
    }
  }
  game.payload = freeCell(game, 2);
  return { ate: true, event };
};

// Theme colors as "R G B" channels from the CSS variables, so the board follows the theme
const readColors = () => {
  const css = getComputedStyle(document.documentElement);
  const get = (name) => css.getPropertyValue(`--c-${name}`).trim();
  return {
    primary: get('primary'),
    onPrimary: get('on-primary'),
    info: get('info'),
    danger: get('danger'),
    secondary: get('secondary'),
    background: get('background'),
    foreground: get('foreground'),
    line: get('line-strong'),
  };
};
const rgb = (channels, alpha = 1) => `rgb(${channels} / ${alpha})`;

const box = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fill();
};

// Adds an X to the current path (a DDoS's cross, the crash mark)
const cross = (ctx, cx, cy, arm) => {
  ctx.moveTo(cx - arm, cy - arm);
  ctx.lineTo(cx + arm, cy + arm);
  ctx.moveTo(cx + arm, cy - arm);
  ctx.lineTo(cx - arm, cy + arm);
};

const draw = (ctx, view, colors, game, pulse) => {
  const { px, dpr } = view;
  const cell = px / SIZE;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, px, px);
  ctx.fillStyle = rgb(colors.background, 0.55);
  ctx.fillRect(0, 0, px, px);

  // The switch fabric: one node per cell
  ctx.fillStyle = rgb(colors.line, 0.5);
  const dot = Math.max(1.5, cell / 12);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      ctx.fillRect((x + 0.5) * cell - dot / 2, (y + 0.5) * cell - dot / 2, dot, dot);
    }
  }
  if (!game) return;

  // Firewalls: filled cells with a brick pattern, so they read without color
  ctx.fillStyle = rgb(colors.danger, 0.9);
  ctx.strokeStyle = rgb(colors.background, 0.9);
  ctx.lineWidth = Math.max(1, cell / 10);
  game.firewalls.forEach((id) => {
    const x = (id % SIZE) * cell;
    const y = Math.floor(id / SIZE) * cell;
    box(ctx, x + 1, y + 1, cell - 2, cell - 2, cell * 0.12);
    ctx.beginPath();
    ctx.moveTo(x + 1, y + cell / 2);
    ctx.lineTo(x + cell - 1, y + cell / 2);
    ctx.moveTo(x + cell / 2, y + 1);
    ctx.lineTo(x + cell / 2, y + cell / 2);
    ctx.moveTo(x + cell / 4, y + cell / 2);
    ctx.lineTo(x + cell / 4, y + cell - 1);
    ctx.moveTo(x + (cell * 3) / 4, y + cell / 2);
    ctx.lineTo(x + (cell * 3) / 4, y + cell - 1);
    ctx.stroke();
  });

  // Payload: a block with a core
  if (game.payload) {
    const x = game.payload.x * cell;
    const y = game.payload.y * cell;
    ctx.fillStyle = rgb(colors.info);
    box(ctx, x + cell * 0.18, y + cell * 0.18, cell * 0.64, cell * 0.64, cell * 0.16);
    ctx.fillStyle = rgb(colors.background);
    ctx.beginPath();
    ctx.arc(x + cell / 2, y + cell / 2, cell * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }

  // DDoS: a ring with a cross (the ring breathes unless motion is reduced)
  ctx.strokeStyle = rgb(colors.secondary);
  ctx.lineWidth = Math.max(1.5, cell * 0.12);
  ctx.lineCap = 'round';
  game.ddos.forEach((c) => {
    const cx = (c.x + 0.5) * cell;
    const cy = (c.y + 0.5) * cell;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * (0.36 + 0.06 * pulse), 0, Math.PI * 2);
    cross(ctx, cx, cy, cell * 0.15);
    ctx.stroke();
  });

  // The packet, tail first so the head is on top. The trail tapers toward the tail rather than
  // fading, so every cell keeps its 3:1 contrast (WCAG 1.4.11): it is what the player must avoid
  const last = game.snake.length - 1;
  ctx.fillStyle = rgb(colors.primary);
  for (let i = last; i >= 0; i -= 1) {
    const c = game.snake[i];
    const inset = i === 0 ? cell * 0.04 : cell * (0.1 + (0.12 * i) / Math.max(last, 1));
    box(
      ctx,
      c.x * cell + inset,
      c.y * cell + inset,
      cell - inset * 2,
      cell - inset * 2,
      cell * 0.22
    );
  }
  // A chevron on the head shows the direction
  const head = game.snake[0];
  const [dx, dy] = DIRS[game.dir];
  ctx.save();
  ctx.translate((head.x + 0.5) * cell, (head.y + 0.5) * cell);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.strokeStyle = rgb(colors.onPrimary);
  ctx.lineWidth = Math.max(1.5, cell * 0.13);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-cell * 0.12, -cell * 0.2);
  ctx.lineTo(cell * 0.12, 0);
  ctx.lineTo(-cell * 0.12, cell * 0.2);
  ctx.stroke();
  ctx.restore();

  // Where the packet crashed: a foreground X on a background halo, visible on any piece
  if (game.crash) {
    const width = Math.max(2, cell * 0.16);
    ctx.lineCap = 'round';
    [
      [colors.background, width * 2.2],
      [colors.foreground, width],
    ].forEach(([color, lineWidth]) => {
      ctx.strokeStyle = rgb(color);
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      cross(ctx, (game.crash.x + 0.5) * cell, (game.crash.y + 0.5) * cell, cell * 0.3);
      ctx.stroke();
    });
  }
};

// Small legend swatches drawn like the board pieces (decorative; each has a text label)
const Swatch = ({ kind }) => (
  <svg aria-hidden='true' viewBox='0 0 16 16' className='h-4 w-4 shrink-0'>
    {kind === 'packet' && (
      <rect x='1' y='1' width='14' height='14' rx='4' className='fill-primary' />
    )}
    {kind === 'payload' && (
      <>
        <rect x='2.5' y='2.5' width='11' height='11' rx='3' className='fill-info' />
        <circle cx='8' cy='8' r='2' className='fill-background' />
      </>
    )}
    {kind === 'firewall' && (
      <>
        <rect x='1' y='1' width='14' height='14' rx='2' className='fill-danger' />
        <path
          d='M1 8h14M8 1v7M4.5 8v7M11.5 8v7'
          className='stroke-background'
          strokeWidth='1.5'
          fill='none'
        />
      </>
    )}
    {kind === 'ddos' && (
      <g className='stroke-secondary' strokeWidth='1.75' strokeLinecap='round' fill='none'>
        <circle cx='8' cy='8' r='6' />
        <path d='M5.5 5.5l5 5M10.5 5.5l-5 5' />
      </g>
    )}
  </svg>
);

const ROTATE = { up: 'rotate-0', right: 'rotate-90', down: 'rotate-180', left: '-rotate-90' };

const PAD_BUTTON =
  'inline-flex h-12 w-12 items-center justify-center rounded-xl border border-line-strong bg-glass text-foreground transition-colors hover:border-foreground-muted [touch-action:manipulation]';

const PacketSnake = () => {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const keysId = useId();

  // 'ready' | 'running' | 'paused' | 'over'
  const [status, setStatus] = useState('ready');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => readBest(gameStorage.snake));
  const [result, setResult] = useState(null);
  const [autoPaused, setAutoPaused] = useState(false);
  const [message, setMessage] = useState('');
  // No speed-up as the score grows (an alternative to the rising pace: WCAG 2.2.1)
  const [steady, setSteady] = useState(false);
  const steadyId = useId();
  const overlayId = useId();

  const game = useRef(null);
  const boardRef = useRef(null);
  const canvasRef = useRef(null);
  const view = useRef(null);
  const colors = useRef(null);
  const swipe = useRef(null);
  const actionRef = useRef(null);

  const redraw = useCallback(
    (now = performance.now()) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx || !view.current || !colors.current) return;
      const pulse = reduced ? 0 : (Math.sin(now / 240) + 1) / 2;
      draw(ctx, view.current, colors.current, game.current, pulse);
    },
    [reduced]
  );

  // Colors follow the theme. Read after ThemeProvider has set data-theme (child effects run
  // before the provider's), as WavesBackground does
  useEffect(() => {
    const update = () => {
      colors.current = readColors();
      redraw();
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, [redraw]);

  // A game left before it ended (Back, Close, Escape) still counts toward the best score
  useEffect(
    () => () => {
      if (game.current && !game.current.crash) saveBest(gameStorage.snake, game.current.score);
    },
    []
  );

  // A square canvas that fills the board, drawn at the device's pixel density (capped at 2)
  useEffect(() => {
    const board = boardRef.current;
    const canvas = canvasRef.current;
    if (!board || !canvas) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const px = entry.contentRect.width;
      if (px <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(px * dpr);
      canvas.height = Math.round(px * dpr);
      view.current = { px, dpr };
      redraw();
    });
    observer.observe(board);
    return () => observer.disconnect();
  }, [redraw]);

  const finish = useCallback(
    (reason) => {
      const final = game.current.score;
      const saved = saveBest(gameStorage.snake, final);
      setBest(saved.best);
      setResult({ reason, score: final, newBest: saved.newBest });
      setStatus('over');
      setMessage(
        t('games.snake.sr.over', {
          reason: t(`games.snake.sr.reason.${reason}`),
          score: final,
          best: saved.best,
        })
      );
    },
    [t]
  );

  // The game loop: a fixed time step per move, so the speed does not depend on the frame rate
  useEffect(() => {
    if (status !== 'running') {
      redraw();
      return undefined;
    }
    let frame = 0;
    let last = performance.now();
    let pending = 0;
    const loop = (now) => {
      // A long gap (a stalled tab) never replays a burst of moves
      pending += Math.min(now - last, 250);
      last = now;
      const current = game.current;
      let moved = false;
      while (pending >= tickFor(current.score, steady)) {
        pending -= tickFor(current.score, steady);
        const outcome = step(current);
        moved = true;
        if (outcome.over) {
          redraw(now);
          finish(outcome.over);
          return;
        }
        if (outcome.ate) {
          setScore(current.score);
          // Only the first firewall is news; DDoS attacks always are
          const news =
            outcome.event === 'ddos' ||
            (outcome.event === 'firewall' && current.firewalls.size === 3);
          if (news) setMessage(t(`games.snake.sr.${outcome.event}`, { score: current.score }));
          else if (current.score % ANNOUNCE_EVERY === 0) {
            setMessage(t('games.snake.sr.score', { score: current.score }));
          }
        }
      }
      if (moved || (!reduced && current.ddos.length)) redraw(now);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [status, steady, reduced, redraw, finish, t]);

  const start = (dir) => {
    game.current = newGame();
    if (dir && dir !== OPPOSITE[game.current.dir]) game.current.dir = dir;
    setScore(0);
    setResult(null);
    setAutoPaused(false);
    setStatus('running');
    setMessage(t('games.snake.sr.started'));
    // The overlay holding the Start button goes away: keep focus on the board
    boardRef.current?.focus({ preventScroll: true });
  };

  const pause = useCallback(
    (auto = false) => {
      setStatus('paused');
      setAutoPaused(auto);
      setMessage(t('games.snake.sr.paused', { score: game.current?.score ?? 0 }));
    },
    [t]
  );

  const resume = () => {
    setStatus('running');
    setAutoPaused(false);
    setMessage(t('games.snake.sr.resumed'));
    boardRef.current?.focus({ preventScroll: true });
  };

  const togglePause = () => {
    if (status === 'running') pause();
    else if (status === 'paused') resume();
  };

  const steer = (dir) => {
    // A direction starts the first game. After a game over only Play again (or Enter) does: the
    // key still held at the crash must not wipe the result before it is read
    if (status === 'ready') {
      start(dir);
      return;
    }
    if (status !== 'running') return;
    const current = game.current;
    const lastDir = current.queue[current.queue.length - 1] ?? current.dir;
    if (dir === lastDir || dir === OPPOSITE[lastDir] || current.queue.length >= 2) return;
    current.queue.push(dir);
  };

  // Never keep moving unseen: pause when the page is hidden or the window loses focus
  useEffect(() => {
    if (status !== 'running') return undefined;
    const onHide = () => pause(true);
    const onVisibility = () => document.hidden && onHide();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onHide);
    };
  }, [status, pause]);

  // Before the first start and after a game over, the overlay's button takes focus, so Enter
  // plays. Not on pause: the Space that paused would release on that button and resume at once;
  // the board keeps focus and Space resumes.
  useEffect(() => {
    if (status === 'ready' || status === 'over') actionRef.current?.focus({ preventScroll: true });
  }, [status]);

  // Keys work anywhere inside the game (they only act while it has focus: WCAG 2.1.4)
  const onKeyDown = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const dir = KEYS[e.code] ?? KEYS[e.key];
    if (dir) {
      e.preventDefault();
      steer(dir);
    } else if (e.code === 'Space' || e.code === 'KeyP') {
      // A focused button or checkbox handles Space itself
      if (e.code === 'Space' && e.target.closest('button, input')) return;
      e.preventDefault();
      togglePause();
    }
  };

  // Swipes on the board steer (the buttons are the single-pointer alternative: WCAG 2.5.1)
  const startSwipe = (e) => {
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerMove = (e) => {
    const origin = swipe.current;
    if (!origin || origin.id !== e.pointerId) return;
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 'right' : 'left');
    else steer(dy > 0 ? 'down' : 'up');
    // Keep tracking from here, so one long drag can turn twice
    startSwipe(e);
  };
  const endSwipe = () => {
    swipe.current = null;
  };

  const overlay = {
    ready: {
      title: t('games.snake.title'),
      body: [t('games.snake.intro')],
      action: t('games.snake.start'),
      onAction: () => start(),
    },
    paused: {
      title: t('games.snake.paused'),
      body: autoPaused ? [t('games.snake.autoPaused')] : [],
      action: t('games.snake.resume'),
      onAction: resume,
    },
    over: result && {
      title: t('games.snake.over'),
      body: [
        t(`games.snake.sr.reason.${result.reason}`),
        t('games.snake.overScore', { score: result.score, best }),
        result.newBest ? t('games.snake.newBest') : null,
      ].filter(Boolean),
      action: t('games.snake.again'),
      onAction: () => start(),
    },
  }[status];
  const paused = status === 'paused';

  return (
    <div onKeyDown={onKeyDown} className='flex flex-col gap-5 lg:flex-row lg:items-start'>
      <div className='mx-auto flex w-full max-w-[min(100%,52vh)] lg:max-w-[min(100%,62vh)] flex-col gap-3 lg:mx-0'>
        <div className='flex items-center gap-5'>
          <p className='text-sm text-foreground-muted'>
            {t('games.snake.score')}{' '}
            <span className='text-lg font-bold tabular-nums text-foreground'>{score}</span>
          </p>
          <p className='text-sm text-foreground-muted'>
            {t('games.snake.best')}{' '}
            <span className='text-lg font-bold tabular-nums text-foreground'>{best}</span>
          </p>
          <button
            type='button'
            onClick={togglePause}
            disabled={status !== 'running' && !paused}
            className='ml-auto inline-flex h-11 items-center gap-2 rounded-xl border border-line-strong bg-glass px-4 text-sm font-semibold text-foreground transition-colors hover:border-foreground-muted disabled:cursor-not-allowed disabled:opacity-50'
          >
            {paused ? <PlayIcon className='h-4 w-4' /> : <PauseIcon className='h-4 w-4' />}
            {paused ? t('games.snake.resume') : t('games.snake.pause')}
          </button>
        </div>

        <div
          ref={boardRef}
          role='application'
          aria-label={t('games.snake.board', { size: SIZE })}
          aria-describedby={keysId}
          tabIndex={0}
          onPointerDown={startSwipe}
          onPointerMove={onPointerMove}
          onPointerUp={endSwipe}
          onPointerCancel={endSwipe}
          className='relative aspect-square w-full touch-none select-none overflow-hidden rounded-2xl border border-line-strong'
        >
          <canvas ref={canvasRef} aria-hidden='true' className='absolute inset-0 h-full w-full' />
          {overlay && (
            <div className='absolute inset-0 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm'>
              <div className='flex w-full max-w-xs flex-col items-center gap-3 rounded-3xl border border-line bg-glass-strong p-6 text-center shadow-raised'>
                <p className='text-xl font-black text-foreground'>{overlay.title}</p>
                <div id={overlayId} className='space-y-1'>
                  {overlay.body.map((line) => (
                    <p key={line} className='text-sm leading-relaxed text-foreground-muted'>
                      {line}
                    </p>
                  ))}
                </div>
                <button
                  ref={actionRef}
                  type='button'
                  aria-describedby={overlay.body.length ? overlayId : undefined}
                  onClick={overlay.onAction}
                  className='mt-2 inline-flex w-full items-center justify-center rounded-xl border-2 border-transparent bg-primary px-6 py-2.5 font-bold text-on-primary transition-colors hover:bg-primary-hover'
                >
                  {overlay.action}
                </button>
              </div>
            </div>
          )}
        </div>
        <p id={keysId} className='text-sm leading-relaxed text-foreground-muted'>
          {t('games.snake.keys')}
        </p>
      </div>

      <div className='flex flex-row items-start justify-between gap-6 lg:w-48 lg:flex-col'>
        <div>
          <h3 className='text-sm font-semibold text-foreground'>{t('games.snake.legend.label')}</h3>
          <ul className='mt-2 space-y-2 text-sm text-foreground-muted'>
            {['packet', 'payload', 'firewall', 'ddos'].map((kind) => (
              <li key={kind} className='flex items-center gap-2'>
                <Swatch kind={kind} />
                {t(`games.snake.legend.${kind}`)}
              </li>
            ))}
          </ul>
          <div className='mt-4 flex items-start gap-2'>
            <input
              id={steadyId}
              type='checkbox'
              checked={steady}
              onChange={(e) => setSteady(e.target.checked)}
              aria-describedby={`${steadyId}-hint`}
              className='mt-0.5 h-5 w-5 shrink-0 accent-primary'
            />
            <div className='text-sm'>
              <label htmlFor={steadyId} className='text-foreground'>
                {t('games.snake.steady')}
              </label>
              <p id={`${steadyId}-hint`} className='text-foreground-muted'>
                {t('games.snake.steadyHint')}
              </p>
            </div>
          </div>
        </div>

        <div
          role='group'
          aria-label={t('games.snake.controls')}
          className='grid shrink-0 grid-cols-3 gap-1.5'
        >
          {[
            ['up', 'col-start-2'],
            ['left', 'col-start-1 row-start-2'],
            ['down', 'col-start-2 row-start-2'],
            ['right', 'col-start-3 row-start-2'],
          ].map(([dir, place]) => (
            <button
              key={dir}
              type='button'
              aria-label={t(`games.snake.${dir}`)}
              onClick={() => steer(dir)}
              className={`${PAD_BUTTON} ${place}`}
            >
              <ChevronUpIcon className={`h-5 w-5 ${ROTATE[dir]}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Start, every payload, obstacles, pause and game over, announced politely */}
      <p role='status' className='sr-only'>
        {message}
      </p>
    </div>
  );
};

export default PacketSnake;
