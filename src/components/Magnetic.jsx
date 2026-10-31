import { m, useMotionValue, useSpring, useTransform } from 'framer-motion';

import { useMediaQuery } from '../hooks/useMediaQuery';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

// A quarter of the pointer's offset from the center, at most 6px either way
const PULL = 0.25;
const MAX = 6;
const pull = (v) => Math.max(-MAX, Math.min(MAX, v * PULL));
const SPRING = { stiffness: 220, damping: 18, mass: 0.4 };

/**
 * A primary call to action that leans toward the pointer while it hovers, and springs back on
 * leave. The pull is set by hand on motion values, which MotionConfig's reduced motion does not
 * cover, so it is switched off here under reduced motion, and for touch (nothing hovers).
 */
const Magnetic = ({ children }) => {
  const reduced = usePrefersReducedMotion();
  const hover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const on = hover && !reduced;
  // The pointer's offset from the center; the transform clamps it, the spring smooths it
  const dx = useMotionValue(0);
  const dy = useMotionValue(0);
  const x = useSpring(useTransform(dx, pull), SPRING);
  const y = useSpring(useTransform(dy, pull), SPRING);

  const onPointerMove = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    dx.set(e.clientX - (box.left + box.width / 2));
    dy.set(e.clientY - (box.top + box.height / 2));
  };
  const onPointerLeave = () => {
    dx.set(0);
    dy.set(0);
  };

  return (
    <m.span
      // Its button fills it, so a full-width slot (the hero's stack on a phone) gives a full-width button
      className='inline-flex *:flex-1'
      style={on ? { x, y } : undefined}
      onPointerMove={on ? onPointerMove : undefined}
      onPointerLeave={on ? onPointerLeave : undefined}
    >
      {children}
    </m.span>
  );
};

export default Magnetic;
