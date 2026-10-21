import { useEffect, useLayoutEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { View } from '@react-three/drei';

import LoadingProgress from '../LoadingProgress';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

const AMBIENT_FPS = 30;

/**
 * Drives the demand frameloop. Scroll and resize redraw at full rate so every View keeps up
 * with its DOM box (2 frames: drei draws a view one frame after it reports entering the
 * screen). Ambient motion (rotation, Float, stars) ticks at ~30 fps, and pointer moves redraw
 * at full rate for the hero parallax. With reduced motion only scroll and resize redraw.
 * Hidden tabs cost nothing: requestAnimationFrame pauses.
 */
const FrameDriver = ({ reduced }) => {
  const invalidate = useThree((state) => state.invalidate);
  const again = useRef(false);

  // The second frame after a scroll or resize. invalidate(2) from the handlers added 2 per event
  // (R3F caps it at 60), so a long scroll left up to a second of identical full-rate renders;
  // invalidate() called inside useFrame asks for exactly one more frame.
  useFrame((state) => {
    if (again.current) {
      again.current = false;
      state.invalidate();
    }
  });

  useEffect(() => {
    const redraw = () => {
      again.current = true;
      invalidate();
    };
    window.addEventListener('scroll', redraw, { passive: true });
    window.addEventListener('resize', redraw);
    if (!reduced) window.addEventListener('pointermove', redraw, { passive: true });

    let raf = 0;
    let last = 0;
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      if (t - last >= 1000 / AMBIENT_FPS - 1) {
        last = t;
        invalidate();
      }
    };
    if (!reduced) raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', redraw);
      window.removeEventListener('resize', redraw);
      window.removeEventListener('pointermove', redraw);
    };
  }, [invalidate, reduced]);

  return null;
};

/**
 * Keeps the canvas moving with the page while it scrolls. The canvas is not position: fixed: the
 * browser scrolls the page on its compositor thread, but a fixed canvas only changes when the
 * main thread draws a new frame, so a scene lagged behind its DOM box (in Firefox it stayed in
 * place until scrolling stopped). Instead the layer sits in the document and, at the start of
 * every rendered frame (priority -1 runs before drei's views), moves to the current scroll
 * position with a composited transform. The compositor then scrolls the drawn pixels together
 * with the page, and the transform and the new drawing are presented in the same frame.
 * No React state: the scroll position is read straight from the DOM inside the render loop.
 */
// The page root clips the layer with overflow: clip (App.jsx). Without it (Safari 15, Chrome < 90,
// Firefox < 81) the layer would lengthen the page every time it reached the bottom, so those
// browsers keep a plain fixed canvas: scenes lag on fast scrolls there, but nothing breaks.
const CLIP = typeof CSS !== 'undefined' && CSS.supports?.('overflow', 'clip');

const LAYER = CLIP
  ? // 125vh: a quarter screen of overscan below the viewport. drei draws any view inside the
    // canvas, so a scene scrolling up into view is already drawn when the compositor scrolls
    // ahead of the main thread (the largest lead measured was 100 px). There is no overscan
    // above: drei never draws a view whose bottom is above the viewport, so on a fast upward
    // scroll a scene entering from the top appears on the next drawn frame.
    'pointer-events-none absolute inset-x-0 top-0 z-0 h-[125vh] will-change-transform'
  : 'pointer-events-none fixed inset-0 z-0';

const followScroll = (el) => {
  if (el && CLIP) el.style.transform = `translate3d(0, ${window.scrollY}px, 0)`;
};

const ScrollSync = ({ layer }) => {
  useFrame((state) => {
    followScroll(layer.current);
    // drei places each view relative to the canvas rect R3F measured. Moved here every frame,
    // the canvas always starts at the viewport's top-left, but R3F's first (asynchronous)
    // measurement can land mid-scroll, e.g. right after a deep link jumps down the page.
    // Correct it here; this only sets state when the stored offset is wrong.
    const { size } = state;
    if (size.top !== 0 || size.left !== 0) state.setSize(size.width, size.height, size.updateStyle);
  }, -1);
  return null;
};

/**
 * The 3D layer, loaded lazily: one Canvas behind the page renders every
 * SceneView through <View.Port />. The layer is absolutely positioned at the top of the page
 * and follows the scroll position (ScrollSync), on its own compositor layer (will-change).
 */
const Scene3D = () => {
  const reduced = usePrefersReducedMotion();
  const layer = useRef(null);
  // Place the layer before R3F measures the canvas (its measuring effect runs after layout
  // effects), so a page that loads already scrolled (a deep link) measures it at the top.
  useLayoutEffect(() => followScroll(layer.current), []);

  return (
    <>
      <LoadingProgress />
      <div ref={layer} aria-hidden='true' className={LAYER}>
        <Canvas
          // Inline style because R3F's own `position: relative` beats classes
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          // No re-measure on scroll: the layer is moved to the viewport top every frame, so the
          // canvas never moves relative to the viewport when drei measures the views. R3F's
          // default re-measures 50 ms after scrolling stops, which made the views snap.
          resize={{ scroll: false }}
          frameloop='demand'
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
          onCreated={({ gl, invalidate }) => {
            // Redraw once the GPU hands the context back after a loss
            gl.domElement.addEventListener('webglcontextrestored', () => invalidate());
          }}
        >
          <ScrollSync layer={layer} />
          <View.Port />
          <FrameDriver reduced={reduced} />
        </Canvas>
      </div>
    </>
  );
};

export default Scene3D;
