import { useEffect, useRef } from 'react';

import { useStillMotion } from '../hooks/useMotionPaused';

/*
 * Interactive waves background, ported from the ReactBits "Interactive Waves Background"
 * (via the Superdesign library). Vertical lines are displaced by 2D Perlin noise and pushed
 * by the pointer with spring physics. It draws on a 2D canvas, not WebGL, so the page still
 * uses a single WebGL context (the shared 3D Canvas).
 *
 * Changes from the original: brand gradient stroke, DPR capped at 1.5, ~30 fps, a single
 * static frame under prefers-reduced-motion, a passive touch listener (it no longer blocks
 * scrolling) and no cursor dot.
 */

// Perlin noise (Stefan Gustavson's implementation, as in the original component)
const GRAD3 = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0, 1],
  [0, -1],
];
const P = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142,
  8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203,
  117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165,
  71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92,
  41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208,
  89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217,
  226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58,
  17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155,
  167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218,
  246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14,
  239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150,
  254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
];

const createNoise = (seed) => {
  const perm = new Array(512);
  const gradP = new Array(512);
  let s = Math.floor(seed * 65536);
  if (s < 256) s |= s << 8;
  for (let i = 0; i < 256; i++) {
    const v = i & 1 ? P[i] ^ (s & 255) : P[i] ^ ((s >> 8) & 255);
    perm[i] = perm[i + 256] = v;
    gradP[i] = gradP[i + 256] = GRAD3[v % 12];
  }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => (1 - t) * a + t * b;
  const dot = (g, x, y) => g[0] * x + g[1] * y;

  return (x, y) => {
    let X = Math.floor(x);
    let Y = Math.floor(y);
    x -= X;
    y -= Y;
    X &= 255;
    Y &= 255;
    const n00 = dot(gradP[X + perm[Y]], x, y);
    const n01 = dot(gradP[X + perm[Y + 1]], x, y - 1);
    const n10 = dot(gradP[X + 1 + perm[Y]], x - 1, y);
    const n11 = dot(gradP[X + 1 + perm[Y + 1]], x - 1, y - 1);
    const u = fade(x);
    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), fade(y));
  };
};

// Wave settings (the library's example values, a little calmer for a full-page background)
const CONFIG = {
  waveSpeedX: 0.0125,
  waveSpeedY: 0.005,
  waveAmpX: 36,
  waveAmpY: 18,
  friction: 0.9,
  tension: 0.01,
  maxCursorMove: 120,
  yGap: 36,
};
const MAX_DPR = 1.5;
const FRAME_MS = 1000 / 30;
// Phones: the lines at the screen's CSS pixels (DPR 1) and spaced wider, so a frame costs a
// fraction of the desktop one on a slow CPU; the faint 1 px lines look the same
const PHONE = 640;
const PHONE_X_GAP = 24;

// Brand gradient across the viewport: orange bottom-left, violet, blue top-right. Colors come from
// the --c-wave-* tokens in src/index.css ("R G B" channels): the brand colors on dark, pastel peach,
// lavender and sky on light, scaled by --wave-alpha. Low alpha so text on top keeps its contrast
// (see the overlays below).
const STOPS = [
  [0, '--c-wave-1', 0.55],
  [0.45, '--c-wave-2', 0.34],
  [1, '--c-wave-3', 0.3],
];

const WavesBackground = ({ paused = false }) => {
  const canvasRef = useRef(null);
  const reduced = useStillMotion();
  // One still frame under reduced motion, and while a live demo covers the page (no animation
  // or pointer work behind its dialog)
  const still = reduced || paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return undefined;

    const noise = createNoise(Math.random());
    const mouse = { x: -10, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, vs: 0, a: 0, set: false };
    let width = 0;
    let height = 0;
    let lines = [];
    let frameId = null;
    let last = 0;
    // Language switch ripple: amplitude boost that decays back to 0 (see onLangChange)
    let ripple = 0;

    const setSize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = width < PHONE ? 1 : Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      applyStroke();
    };

    // Read the theme tokens; runs on resize and whenever the theme changes
    const applyStroke = () => {
      const tokens = getComputedStyle(document.documentElement);
      const scale = parseFloat(tokens.getPropertyValue('--wave-alpha')) || 1;
      const gradient = ctx.createLinearGradient(0, height, width, 0);
      STOPS.forEach(([offset, token, alpha]) => {
        const rgb = tokens.getPropertyValue(token).trim() || '255 101 0';
        gradient.addColorStop(offset, `rgb(${rgb} / ${alpha * scale})`);
      });
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1;
    };

    const setLines = () => {
      // Wider spacing on phones: fewer points to animate and a calmer pattern
      const xGap = width < PHONE ? PHONE_X_GAP : 12;
      const { yGap } = CONFIG;
      const totalLines = Math.ceil((width + 200) / xGap);
      const totalPoints = Math.ceil((height + 30) / yGap);
      const xStart = (width - xGap * totalLines) / 2;
      const yStart = (height - yGap * totalPoints) / 2;

      lines = [];
      for (let i = 0; i <= totalLines; i++) {
        const points = [];
        for (let j = 0; j <= totalPoints; j++) {
          points.push({
            x: xStart + xGap * i,
            y: yStart + yGap * j,
            wave: { x: 0, y: 0 },
            cursor: { x: 0, y: 0, vx: 0, vy: 0 },
          });
        }
        lines.push(points);
      }
    };

    const movePoints = (time) => {
      const { waveSpeedX, waveSpeedY, waveAmpX, waveAmpY, friction, tension, maxCursorMove } =
        CONFIG;
      lines.forEach((points) => {
        points.forEach((p) => {
          const move =
            noise((p.x + time * waveSpeedX) * 0.002, (p.y + time * waveSpeedY) * 0.0015) * 12;
          const boost = 1 + ripple * 0.9;
          p.wave.x = Math.cos(move) * waveAmpX * boost;
          p.wave.y = Math.sin(move) * waveAmpY * boost;

          const dx = p.x - mouse.sx;
          const dy = p.y - mouse.sy;
          const dist = Math.hypot(dx, dy);
          const l = Math.max(175, mouse.vs);
          if (dist < l) {
            const s = 1 - dist / l;
            const f = Math.cos(dist * 0.001) * s;
            p.cursor.vx += Math.cos(mouse.a) * f * l * mouse.vs * 0.00065;
            p.cursor.vy += Math.sin(mouse.a) * f * l * mouse.vs * 0.00065;
          }

          p.cursor.vx += -p.cursor.x * tension;
          p.cursor.vy += -p.cursor.y * tension;
          p.cursor.vx *= friction;
          p.cursor.vy *= friction;
          p.cursor.x += p.cursor.vx * 2;
          p.cursor.y += p.cursor.vy * 2;
          p.cursor.x = Math.min(maxCursorMove, Math.max(-maxCursorMove, p.cursor.x));
          p.cursor.y = Math.min(maxCursorMove, Math.max(-maxCursorMove, p.cursor.y));
        });
      });
    };

    const drawLines = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      lines.forEach((points) => {
        // The first point stays anchored (no cursor offset), as in the original
        ctx.moveTo(points[0].x + points[0].wave.x, points[0].y + points[0].wave.y);
        for (let i = 1; i < points.length; i++) {
          const p = points[i];
          ctx.lineTo(p.x + p.wave.x + p.cursor.x, p.y + p.wave.y + p.cursor.y);
        }
      });
      ctx.stroke();
    };

    const updateMouse = (x, y) => {
      mouse.x = x;
      mouse.y = y;
      if (!mouse.set) {
        mouse.sx = mouse.lx = x;
        mouse.sy = mouse.ly = y;
        mouse.set = true;
      }
    };

    const tick = (time) => {
      frameId = requestAnimationFrame(tick);
      // 1 ms of slack: at 60 Hz two vsyncs are 33.3 ms apart, a hair under FRAME_MS, and without
      // it every other drawn frame would wait a third vsync (20 fps), out of step with FrameDriver
      if (time - last < FRAME_MS - 1) return;
      last = time;

      mouse.sx += (mouse.x - mouse.sx) * 0.1;
      mouse.sy += (mouse.y - mouse.sy) * 0.1;
      const dx = mouse.x - mouse.lx;
      const dy = mouse.y - mouse.ly;
      mouse.vs += (Math.hypot(dx, dy) - mouse.vs) * 0.1;
      mouse.vs = Math.min(100, mouse.vs);
      mouse.lx = mouse.x;
      mouse.ly = mouse.y;
      mouse.a = Math.atan2(dy, dx);

      movePoints(time);
      drawLines();
      ripple *= 0.93; // ~1 s back to calm at 30 fps
      if (ripple < 0.01) ripple = 0;
    };

    // One still frame: the same wave pattern, no animation and no pointer response
    const drawStill = () => {
      movePoints(0);
      drawLines();
    };

    const onResize = () => {
      setSize();
      setLines();
      if (still) drawStill();
    };
    const onMouseMove = (e) => updateMouse(e.clientX, e.clientY);
    // The page cross-fades to the other language; the lines swell and settle with it
    const onLangChange = () => {
      ripple = 1;
    };
    const onTouchMove = (e) => updateMouse(e.touches[0].clientX, e.touches[0].clientY);

    setSize();
    setLines();
    window.addEventListener('resize', onResize);
    // Theme switch (data-theme on <html>): recolor the lines; the still frame redraws at once
    const themeObserver = new MutationObserver(() => {
      applyStroke();
      if (still) drawStill();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    if (still) {
      drawStill();
    } else {
      frameId = requestAnimationFrame(tick);
      window.addEventListener('mousemove', onMouseMove, { passive: true });
      window.addEventListener('touchmove', onTouchMove, { passive: true });
      window.addEventListener('site:langchange', onLangChange);
    }

    return () => {
      themeObserver.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('site:langchange', onLangChange);
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [still]);

  return (
    <div aria-hidden='true' className='pointer-events-none fixed inset-0 overflow-hidden'>
      <canvas ref={canvasRef} className='block h-full w-full' />
      {/* Readability: a dark wash that is heaviest where the hero text sits (top left) and at
          the bottom edge, so lines never compete with copy at full strength. */}
      <div className='absolute inset-0 bg-[radial-gradient(ellipse_at_20%_30%,theme(colors.background/70%),transparent_55%)]' />
      <div className='absolute inset-0 bg-linear-to-b/srgb from-background/40 via-transparent to-background/70' />
      {/* Film grain over the lines and washes, still below every card and text */}
      <div className='grain absolute inset-0' />
    </div>
  );
};

export default WavesBackground;
