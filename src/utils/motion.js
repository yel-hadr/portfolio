// Motion language: one easing and one duration family everywhere. Content fades up a short
// distance; nothing slides in from off-screen and nothing loops. Under prefers-reduced-motion,
// the root <MotionConfig reducedMotion="user"> drops the transforms and keeps only opacity.
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
