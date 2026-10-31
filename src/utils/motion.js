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

export const reveal = (delay = 0) => {
  const wait = delay ? { delay } : {};
  return {
    hidden: { opacity: 0, y: rise() },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        y: { ...REVEAL_SPRING, ...wait },
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
export const pressable = { whileHover: { y: -1 }, whileTap: { scale: 0.98 }, transition: SPRING };
