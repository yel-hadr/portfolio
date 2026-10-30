// Motion language: one easing and one duration family for reveals, springs for hover and press.
// Content fades up a short distance; nothing slides in from off-screen. Under
// prefers-reduced-motion, the root <MotionConfig reducedMotion="user"> drops the transforms and
// keeps only opacity.
export const EASE_OUT = [0.22, 1, 0.36, 1];

export const reveal = (delay = 0) => ({
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_OUT, delay },
  },
});

export const staggerContainer = (staggerChildren = 0.08, delayChildren = 0) => ({
  hidden: {},
  show: {
    transition: { staggerChildren, delayChildren },
  },
});

// Hover and press on buttons and button-styled links: a spring rather than an eased duration, and
// a press that gives a little (0.98). Under reduced motion the root MotionConfig applies these
// transforms instantly, with no animation. Spread on an m.a / m.button that has no variants of its
// own
export const SPRING = { type: 'spring', stiffness: 400, damping: 30, mass: 0.6 };
export const pressable = { whileHover: { y: -1 }, whileTap: { scale: 0.98 }, transition: SPRING };
