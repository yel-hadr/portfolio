import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  LineBasicMaterial,
  MathUtils,
  MOUSE,
  OrthographicCamera,
  PerspectiveCamera,
  TOUCH,
  Vector3,
} from 'three';

import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { styles } from '../../styles';
import ReleaseContext from '../canvas/ReleaseContext';
import { readTheme } from '../../utils/themeColors';
import { MAP_42, parseFdf } from './heightmap';

// A web take on FdF: the project's 42.fdf heightmap drawn as a wireframe, every point joined to
// its right and lower neighbours. The original rotates the grid by 45° and halves its height, a
// 2:1 isometric view; the default camera here looks from the same angle (elevation 30°).

const MAP = parseFdf(MAP_42);
const ALTITUDE = 0.1; // world units per altitude unit at a z-scale of 1
const ISO_AZIMUTH = Math.PI / 4;
const ISO_ELEVATION = Math.PI / 6; // asin(1/2): the 2:1 look of halving y
const DIRECTION = new Vector3(
  Math.cos(ISO_ELEVATION) * Math.sin(ISO_AZIMUTH),
  Math.sin(ISO_ELEVATION),
  Math.cos(ISO_ELEVATION) * Math.cos(ISO_AZIMUTH)
);
const SPAN = Math.hypot(MAP.width, MAP.height); // the grid's diagonal
const ROTATE_STEP = Math.PI / 12; // 15° per R
const PAN_STEP = 0.6; // world units per arrow key
const ZOOM_STEP = 1.15;
// Moves for the arrow keys and their buttons: screen direction (x right, y up) and glyph
const PAN = [
  { dir: 'left', key: 'ArrowLeft', x: -1, y: 0, glyph: '←' },
  { dir: 'up', key: 'ArrowUp', x: 0, y: 1, glyph: '↑' },
  { dir: 'down', key: 'ArrowDown', x: 0, y: -1, glyph: '↓' },
  { dir: 'right', key: 'ArrowRight', x: 1, y: 0, glyph: '→' },
];

/** The heightmap as line segments: one vertex per point, an edge to the right and below */
const buildGeometry = () => {
  const { width, height } = MAP;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(width * height * 3), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(width * height * 3), 3));
  const index = [];
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const i = row * width + col;
      if (col < width - 1) index.push(i, i + 1);
      if (row < height - 1) index.push(i, i + width);
    }
  }
  geometry.setIndex(index);
  return geometry;
};

const setHeights = (geometry, zScale) => {
  const { width, height, z } = MAP;
  const position = geometry.getAttribute('position');
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const i = row * width + col;
      position.setXYZ(i, col - (width - 1) / 2, z[i] * ALTITUDE * zScale, row - (height - 1) / 2);
    }
  }
  position.needsUpdate = true;
  geometry.computeBoundingSphere();
};

// Altitude colors: low points in blue, through violet, to orange at the top, with the theme's
// text-safe tokens so 1 px lines keep their contrast on either background (WebGL draws no thicker
// lines). The "original" palette is one color, as the original draws every line in one (white by
// default): here the theme's text color
const setColors = (geometry, palette) => {
  const channels = readTheme(['info', 'secondary', 'primary-400', 'foreground']);
  // three.js parses only the comma form of rgb()
  const color = (name) => new Color(`rgb(${channels[name].replace(/ /g, ',')})`);
  const stops =
    palette === 'altitude'
      ? [color('info'), color('secondary'), color('primary-400')]
      : [color('foreground')];
  const out = new Color();
  const attribute = geometry.getAttribute('color');
  const range = MAP.max - MAP.min || 1;
  MAP.z.forEach((value, i) => {
    const k = ((value - MAP.min) / range) * (stops.length - 1);
    const lo = Math.floor(k);
    out.copy(stops[lo]).lerp(stops[Math.min(lo + 1, stops.length - 1)], k - lo);
    attribute.setXYZ(i, out.r, out.g, out.b);
  });
  attribute.needsUpdate = true;
};

const Model = ({ zScale, palette, turns, reduced }) => {
  const invalidate = useThree((s) => s.invalidate);
  const group = useRef(null);
  // Not created in JSX, so R3F does not own them: freed on unmount below
  const geometry = useMemo(buildGeometry, []);
  const material = useMemo(() => new LineBasicMaterial({ vertexColors: true }), []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useEffect(() => {
    setHeights(geometry, zScale);
    invalidate();
  }, [geometry, zScale, invalidate]);

  useEffect(() => {
    setColors(geometry, palette);
    invalidate();
  }, [geometry, palette, invalidate]);

  // Rotation about the vertical axis, as the original's angle keys; eased unless motion is
  // reduced, and only rendering while it turns
  const turning = useRef(false);
  useFrame((state, delta) => {
    if (!group.current) return;
    const target = turns * ROTATE_STEP;
    const current = group.current.rotation.y;
    if (Math.abs(target - current) < 1e-4) {
      turning.current = false;
      return;
    }
    // In demand mode the first frame's delta spans the idle time before it: one step instead
    const dt = turning.current ? Math.min(delta, 0.1) : 1 / 60;
    turning.current = true;
    group.current.rotation.y = reduced ? target : MathUtils.damp(current, target, 10, dt);
    state.invalidate();
  });
  useEffect(() => invalidate(), [turns, invalidate]);

  return (
    <group ref={group}>
      <lineSegments geometry={geometry} material={material} />
    </group>
  );
};

/** Fits the model: the orthographic camera's zoom, and the perspective camera's distance */
const fitZoom = (size) => Math.min(size.width, size.height * 1.7) / (SPAN * 1.15);
const PERSPECTIVE_DISTANCE = (SPAN / 2 / Math.tan(MathUtils.degToRad(20))) * 1.05;
// Perspective zoom limits, well inside the camera's far plane
const MIN_DISTANCE = 3;
const MAX_DISTANCE = PERSPECTIVE_DISTANCE * 4;

// Module scope: no allocation per action
const ISO_POSITION = DIRECTION.clone().multiplyScalar(60);
const PERSPECTIVE_POSITION = DIRECTION.clone().multiplyScalar(PERSPECTIVE_DISTANCE);

// Plain three.js cameras made the store's default camera (lighter than drei's camera components):
// R3F keeps the default camera's frustum in step with the canvas size on resize
const fitFrustum = (camera, size) => {
  if (camera.isOrthographicCamera) {
    camera.left = -size.width / 2;
    camera.right = size.width / 2;
    camera.top = size.height / 2;
    camera.bottom = -size.height / 2;
  } else {
    camera.aspect = size.width / Math.max(size.height, 1);
  }
  camera.updateProjectionMatrix();
};
const OFFSET = new Vector3();
const RIGHT = new Vector3();
const UP = new Vector3();

const Cameras = ({ projection, reduced, actionsRef }) => {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  // The OrbitControls built for the current default camera (makeDefault puts them in the store;
  // drei rebuilds them when the camera changes)
  const controls = useThree((s) => s.controls);
  const set = useThree((s) => s.set);
  // Fitted once: a later resize (a phone turning, the URL bar folding) keeps the user's zoom
  const [cameras] = useState(() => ({
    isometric: new OrthographicCamera(-1, 1, 1, -1, 0.1, 500),
    perspective: new PerspectiveCamera(40, 1, 0.1, 500),
    isoZoom: fitZoom(size),
  }));

  // A projection switch starts its camera from the default view
  useLayoutEffect(() => {
    const next = cameras[projection];
    next.position.copy(projection === 'isometric' ? ISO_POSITION : PERSPECTIVE_POSITION);
    if (next.isOrthographicCamera) next.zoom = cameras.isoZoom;
    next.lookAt(0, 0, 0);
    fitFrustum(next, size);
    set({ camera: next });
    invalidate();
    // The size at the switch; later resizes are R3F's
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projection, cameras, set, invalidate]);

  // New controls (first mount, or a projection switch) start from the default view, saved for
  // Reset
  useEffect(() => {
    if (!controls) return;
    controls.target.set(0, 0, 0);
    controls.update();
    controls.saveState();
    invalidate();
  }, [controls, invalidate]);

  // Keyboard and button actions, in the camera's own terms
  useEffect(() => {
    if (!controls) return;
    actionsRef.current = {
      zoom: (factor) => {
        if (camera.isOrthographicCamera) {
          camera.zoom = MathUtils.clamp(camera.zoom * factor, 2, 400);
          camera.updateProjectionMatrix();
        } else {
          OFFSET.copy(camera.position).sub(controls.target).divideScalar(factor);
          OFFSET.setLength(MathUtils.clamp(OFFSET.length(), MIN_DISTANCE, MAX_DISTANCE));
          camera.position.copy(controls.target).add(OFFSET);
        }
        controls.update();
        invalidate();
      },
      // Moves the view so the model shifts by (dx, dy) on screen
      pan: (dx, dy) => {
        const scale = camera.isOrthographicCamera
          ? 20 / camera.zoom
          : camera.position.distanceTo(controls.target) / 20;
        RIGHT.setFromMatrixColumn(camera.matrix, 0).multiplyScalar(-dx * scale);
        UP.setFromMatrixColumn(camera.matrix, 1).multiplyScalar(-dy * scale);
        camera.position.add(RIGHT).add(UP);
        controls.target.add(RIGHT).add(UP);
        controls.update();
        invalidate();
      },
      reset: () => {
        controls.reset();
        invalidate();
      },
    };
  }, [camera, controls, actionsRef, invalidate]);

  return (
    <>
      {/* Drag moves the model (as the original's arrow keys), right-drag or two fingers turn it,
          the wheel or a pinch zooms */}
      <OrbitControls
        makeDefault
        enableDamping={!reduced}
        mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
        touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE }}
        minZoom={2}
        maxZoom={400}
        minDistance={MIN_DISTANCE}
        maxDistance={MAX_DISTANCE}
      />
      <ReleaseContext />
    </>
  );
};

// Pressed: an orange fill, plus an underline that survives forced colors
const SEGMENT =
  'inline-flex min-h-10 items-center rounded-lg px-3 py-1.5 text-left leading-tight text-sm font-semibold text-foreground transition-colors aria-pressed:bg-primary aria-pressed:text-on-primary aria-pressed:underline aria-pressed:decoration-2 aria-pressed:underline-offset-4';
const BUTTON =
  'inline-flex min-h-10 items-center justify-center rounded-lg py-1.5 text-center leading-tight border border-line-strong bg-surface/70 px-3 text-sm font-semibold text-foreground transition-colors hover:border-foreground-muted';

/** A group of toggle buttons, one pressed: the projection or the palette */
const Choice = ({ legend, options, value, onChange, label, className = '' }) => (
  <fieldset>
    <legend className='text-sm font-semibold text-foreground'>{legend}</legend>
    <div className='mt-2 inline-flex flex-wrap gap-1 rounded-xl border border-line-strong p-1'>
      {options.map((option) => (
        <button
          key={option}
          type='button'
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`${SEGMENT} ${className}`}
        >
          {label(option)}
        </button>
      ))}
    </div>
  </fieldset>
);

/** The FdF viewer: the canvas and its control panel */
const FdfViewer = ({ t }) => {
  const reduced = usePrefersReducedMotion();
  const [zScale, setZScale] = useState(1);
  const [projection, setProjection] = useState('isometric');
  const [palette, setPalette] = useState('altitude');
  const [turns, setTurns] = useState(0);
  const actionsRef = useRef({});
  const glRef = useRef(null);
  const sliderId = useId();
  const helpId = useId();

  const canvasLabel = t('demos.fdf.canvasLabel', {
    width: MAP.width,
    height: MAP.height,
    projection: t(`demos.fdf.projections.${projection}`),
  });
  useEffect(() => {
    glRef.current?.domElement.setAttribute('aria-label', canvasLabel);
  }, [canvasLabel]);

  const zScaleText = `× ${zScale.toFixed(1)}`;
  const act = useCallback((name, ...args) => actionsRef.current[name]?.(...args), []);
  const rotate = (dir) => setTurns((n) => n + dir);
  const reset = () => {
    setTurns(0);
    act('reset');
  };

  // Keys act while the viewer has focus (Escape is left to the dialog)
  const onKeyDown = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const pan = PAN.find(({ key }) => key === e.key);
    if (pan) act('pan', pan.x * PAN_STEP, pan.y * PAN_STEP);
    else if (['+', '='].includes(e.key) || e.code === 'NumpadAdd') act('zoom', ZOOM_STEP);
    else if (e.key === '-' || e.code === 'NumpadSubtract') act('zoom', 1 / ZOOM_STEP);
    else if (e.code === 'KeyR') rotate(e.shiftKey ? -1 : 1);
    else if (e.code === 'KeyP')
      setProjection((p) => (p === 'isometric' ? 'perspective' : 'isometric'));
    else return;
    e.preventDefault();
  };

  return (
    <div className='flex h-full flex-col md:flex-row'>
      <div
        tabIndex={0}
        // application: screen readers pass the view's own keys (arrows, R, P) through
        role='application'
        aria-label={t('demos.fdf.viewLabel')}
        aria-describedby={helpId}
        onKeyDown={onKeyDown}
        className='group relative min-h-[50vh] flex-1 touch-none outline-none md:min-h-0'
      >
        <Canvas
          frameloop='demand'
          dpr={[1, 2]}
          gl={{ powerPreference: 'default' }}
          onCreated={({ gl, invalidate }) => {
            glRef.current = gl;
            // Demand mode: a restored context stays blank until something asks for a frame
            gl.domElement.addEventListener('webglcontextrestored', () => invalidate());
            gl.domElement.setAttribute('role', 'img');
            gl.domElement.setAttribute('aria-label', canvasLabel);
          }}
        >
          <Model zScale={zScale} palette={palette} turns={turns} reduced={reduced} />
          <Cameras projection={projection} reduced={reduced} actionsRef={actionsRef} />
        </Canvas>
        <p
          id={helpId}
          className='pointer-events-none absolute bottom-3 left-3 max-w-sm rounded-xl bg-background/80 px-3 py-2 text-sm text-foreground-muted'
        >
          {t('demos.fdf.help')}
        </p>
        {/* The focus ring, drawn above the canvas */}
        <span aria-hidden='true' className={styles.viewFocusRing} />
      </div>

      {/* FdF-style controls */}
      <div className='flex shrink-0 flex-col gap-4 overflow-y-auto border-t border-line bg-glass p-4 backdrop-blur-md md:w-72 md:border-l md:border-t-0'>
        <div>
          <label
            htmlFor={sliderId}
            className='flex justify-between text-sm font-semibold text-foreground'
          >
            {t('demos.fdf.zScale')}
            <span aria-hidden='true' className='tabular-nums text-foreground-muted'>
              {zScaleText}
            </span>
          </label>
          <input
            id={sliderId}
            type='range'
            min={0}
            max={3}
            step={0.1}
            value={zScale}
            onChange={(e) => setZScale(Number(e.target.value))}
            aria-valuetext={zScaleText}
            className='mt-2 w-full accent-primary'
          />
        </div>

        <Choice
          legend={t('demos.fdf.projection')}
          options={['isometric', 'perspective']}
          value={projection}
          onChange={setProjection}
          label={(p) => t(`demos.fdf.projections.${p}`)}
          className='capitalize'
        />
        <Choice
          legend={t('demos.fdf.colors')}
          options={['altitude', 'original']}
          value={palette}
          onChange={setPalette}
          label={(p) => t(`demos.fdf.palettes.${p}`)}
        />

        {/* Buttons for everything a drag does (WCAG 2.5.7) */}
        <div role='group' aria-label={t('demos.fdf.move')} className='grid grid-cols-4 gap-2'>
          {PAN.map(({ dir, x, y, glyph }) => (
            <button
              key={dir}
              type='button'
              aria-label={t(`demos.fdf.pan.${dir}`)}
              className={BUTTON}
              onClick={() => act('pan', x * PAN_STEP, y * PAN_STEP)}
            >
              <span aria-hidden='true'>{glyph}</span>
            </button>
          ))}
        </div>
        <div className='grid grid-cols-2 gap-2'>
          <button type='button' className={BUTTON} onClick={() => act('zoom', ZOOM_STEP)}>
            {t('demos.fdf.zoomIn')}
          </button>
          <button type='button' className={BUTTON} onClick={() => act('zoom', 1 / ZOOM_STEP)}>
            {t('demos.fdf.zoomOut')}
          </button>
          <button type='button' className={BUTTON} onClick={() => rotate(1)}>
            {t('demos.fdf.rotate')}
          </button>
          <button type='button' className={BUTTON} onClick={() => rotate(-1)}>
            {t('demos.fdf.rotateBack')}
          </button>
          <button type='button' className={`${BUTTON} col-span-2`} onClick={reset}>
            {t('demos.fdf.reset')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FdfViewer;
