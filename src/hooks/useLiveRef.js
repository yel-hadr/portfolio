import { useLayoutEffect, useRef } from 'react';

/**
 * A ref that follows `value`, for the frame loops and listeners that write to it: a three.js
 * object made in a memo, R3F's camera. The React Compiler treats hook values (and the arguments
 * of a hook's callback, such as useFrame's state) as immutable; a ref's `current` is not.
 * Name the result `…Ref`, so the compiler knows it for one
 */
export const useLiveRef = (value) => {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
};
