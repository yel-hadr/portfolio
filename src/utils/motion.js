// Motion language: reveals settle on a soft spring (a slight, natural overshoot), cascading
// through a section with a 0.1 s stagger; springs for hover and press. Content rises a short
// distance; nothing slides in from off-screen. Under prefers-reduced-motion, the root
// <MotionConfig reducedMotion="user"> drops the transforms and keeps only opacity.
export const EASE_OUT = [0.22, 1, 0.36, 1];

// Stiffness 100, damping 15 (mass 1): a damping ratio of 0.75, so about 3% overshoot, settled in
// under a second. Opacity eases on its own, so it never overshoots past 1
export const REVEAL_SPRING = { type: 'spring', stiffness: 100, damping: 15 };

// No delay key unless one is asked for: an explicit delay (even 0) on the child replaces the
// stagger its parent container gives it, and the cascade collapses into one step
// Under reduced motion the content only fades: no offset at all, rather than one MotionConfig
// would drop a frame after the fade starts. Read when the variants are built (at render)
const rise = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : 24;

// `fade: false` keeps the rise and drops the fade: for the hero portrait, the page's largest
// paint, which the browser does not count as painted while it is transparent (LCP)
export const reveal = (delay = 0, { fade = true } = {}) => {
  const wait = delay ? { delay } : {};
  const y = { ...REVEAL_SPRING, ...wait };
  if (!fade) return { hidden: { y: rise() }, show: { y: 0, transition: { y } } };
  return {
    hidden: { opacity: 0, y: rise() },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        y,
        opacity: { duration: 0.45, ease: EASE_OUT, ...wait },
      },
    },
  };
};

export const staggerContainer = (staggerChildren = 0.1, delayChildren = 0) => ({
  hidden: {},
  show: {
    transition: { staggerChildren, delayChildren },
  },
});

// The hero's name, word by word: each word rises out of a mask (its own overflow-hidden box), so
// it appears to slide up from a baseline rather than fade in
export const wordReveal = {
  hidden: { y: '110%' },
  show: { y: '0%', transition: { type: 'spring', stiffness: 120, damping: 16 } },
};

export const SPRING = { type: 'spring', stiffness: 400, damping: 30, mass: 0.6 };
// A press drops the button back from its hover lift as it gives, so a click feels physical
export const pressable = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.98, y: 0 },
  transition: SPRING,
};

// SPRING as Web Animations options: a CSS linear() easing sampled once from the spring's motion,
// for what must start before the paint (the navbar's pill) or stay out of the first-paint chunk
// (framer's animate()). Browsers without linear() get the ease-out of the same length
export const SPRING_TIMING = (() => {
  const { stiffness, damping, mass } = SPRING;
  const dt = 1 / 120;
  let x = 0;
  let v = 0;
  const points = [];
  while (points.length < 240) {
    v += ((stiffness * (1 - x) - damping * v) / mass) * dt;
    x += v * dt;
    points.push(x);
    if (Math.abs(1 - x) < 0.001 && Math.abs(v) < 0.01) break;
  }
  const step = Math.ceil(points.length / 40);
  const stops = points.filter((_, i) => i % step === 0).map((p) => +p.toFixed(4));
  const spring = `linear(0, ${stops.join(', ')}, 1)`;
  return {
    duration: Math.round(points.length * dt * 1000),
    easing:
      typeof CSS !== 'undefined' && CSS.supports('transition-timing-function', spring)
        ? spring
        : `cubic-bezier(${EASE_OUT.join(', ')})`,
  };
})();
