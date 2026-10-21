import { useMediaQuery } from './useMediaQuery';

/**
 * Live prefers-reduced-motion preference. Unlike framer-motion's useReducedMotion
 * (read once per mount), this updates when the OS setting changes.
 */
export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');

export default usePrefersReducedMotion;
