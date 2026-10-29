import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  LineBasicMaterial,
  MathUtils,
  MeshBasicMaterial,
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
import { DEFAULT_MAP, FDF_MAPS, loadMap } from '../../data/fdfMaps';

// A web take on FdF: the project's own test_maps (42.fdf first) drawn as a wireframe, every point
// joined to its right and lower neighbours. The original rotates the grid by 45° and halves its
// height, a 2:1 isometric view; the default camera here looks from the same angle (elevation 30°).
// Each map is its own Model (keyed by id), so a switch frees the last one's geometry; the materials
// are shared (Wireframe), so it compiles no shaders.

const ISO_AZIMUTH = Math.PI / 4;
const ISO_ELEVATION = Math.PI / 6; // asin(1/2): the 2:1 look of halving y
const DIRECTION = new Vector3(
  Math.cos(ISO_ELEVATION) * Math.sin(ISO_AZIMUTH),
  Math.sin(ISO_ELEVATION),
  Math.cos(ISO_ELEVATION) * Math.cos(ISO_AZIMUTH)
);
const ROTATE_STEP = Math.PI / 12; // 15° per R
const PAN_STEP = 0.6; // world units per arrow key
const ZOOM_STEP = 1.15;
const SCAN_TIME = 1.6; // s: the wireframe drawn in, row by row, as it loads
const edgesOf = ({ width, height }) => (width - 1) * height + width * (height - 1);
const spanOf = ({ width, height }) => Math.hypot(width, height); // the grid's diagonal
// Moves for the arrow keys and their buttons: screen direction (x right, y up) and glyph
const PAN = [
  { dir: 'left', key: 'ArrowLeft', x: -1, y: 0, glyph: '←' },
  { dir: 'up', key: 'ArrowUp', x: 0, y: 1, glyph: '↑' },
  { dir: 'down', key: 'ArrowDown', x: 0, y: -1, glyph: '↓' },
  { dir: 'right', key: 'ArrowRight', x: 1, y: 0, glyph: '→' },
];

/** The heightmap as line segments: one vertex per point, an edge to the right and below */
const buildGeometry = (map) => {
  const { width, height } = map;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(width * height * 3), 3));
  // Colors as normalized bytes: a quarter of the floats' memory (setXYZ takes 0..1 all the same)
  geometry.setAttribute('color', new BufferAttribute(new Uint8Array(width * height * 3), 3, true));
  // Two indices per edge; 32-bit, as the 500 x 500 maps have a quarter of a million points
  const index = new (width * height > 65535 ? Uint32Array : Uint16Array)(edgesOf(map) * 2);
  let n = 0;
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const i = row * width + col;
      if (col < width - 1) {
        index[n++] = i;
        index[n++] = i + 1;
      }
      if (row < height - 1) {
        index[n++] = i;
        index[n++] = i + width;
      }
    }
  }
  geometry.setIndex(new BufferAttribute(index, 1));
  return geometry;
};

const setHeights = (geometry, map, zScale) => {
  const { width, height, z, altitude } = map;
  const position = geometry.getAttribute('position');
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const i = row * width + col;
      position.setXYZ(i, col - (width - 1) / 2, z[i] * altitude * zScale, row - (height - 1) / 2);
    }
  }
  position.needsUpdate = true;
  geometry.computeBoundingSphere();
};

// Altitude colors: low points in blue, through violet, to orange at the top, with the theme's
// text-safe tokens so 1 px lines keep their contrast on either background (WebGL draws no thicker
// lines). The "original" palette is one color, as the original draws every line in one (white by
// default): here the theme's text color. "file" takes the map's own colors (",0xRRGGBB", one per
// altitude) and the original's white for points without one, drawn on black like its window: the
// one place the viewer draws colors that are not tokens
const FILE_DEFAULT = '#ffffff'; // the original's color for a point without one (ft_atoi_base)
const setColors = (geometry, map, palette) => {
  const channels = readTheme(['info', 'secondary', 'primary-400', 'foreground']);
  // three.js parses only the comma form of rgb()
  const color = (name) => new Color(`rgb(${channels[name].replace(/ /g, ',')})`);
  const stops =
    palette === 'altitude'
      ? [color('info'), color('secondary'), color('primary-400')]
      : [color('foreground')];
  const out = new Color();
  const attribute = geometry.getAttribute('color');
  const { z, min, max, colors } = map;
  if (palette === 'file' && colors) {
    // One Color per altitude, not per point
    const byAltitude = new Map();
    z.forEach((value, i) => {
      if (!byAltitude.has(value)) {
        byAltitude.set(value, new Color(colors[value] ?? FILE_DEFAULT));
      }
      const c = byAltitude.get(value);
      attribute.setXYZ(i, c.r, c.g, c.b);
    });
  } else {
    const range = max - min || 1;
    z.forEach((value, i) => {
      const k = ((value - min) / range) * (stops.length - 1);
      const lo = Math.floor(k);
      out.copy(stops[lo]).lerp(stops[Math.min(lo + 1, stops.length - 1)], k - lo);
      attribute.setXYZ(i, out.r, out.g, out.b);
    });
  }
  attribute.needsUpdate = true;
};

const Model = ({ map, materials, zScale, palette, turns, reduced, scanId, onScan }) => {
  const invalidate = useThree((s) => s.invalidate);
  const group = useRef(null);
  const sheet = useRef(null);
  // Not created in JSX, so R3F does not own it: freed on unmount below (the materials outlive it)
  const geometry = useMemo(() => buildGeometry(map), [map]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Heights at a z-scale of 1, once per map: the slider scales the model's y instead, so a drag
  // costs no pass over a quarter of a million points and no upload
  useEffect(() => {
    setHeights(geometry, map, 1);
    invalidate();
  }, [geometry, map, invalidate]);
  useEffect(() => invalidate(), [zScale, invalidate]);

  useEffect(() => {
    setColors(geometry, map, palette);
    invalidate();
  }, [geometry, map, palette, invalidate]);

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

  // The load scan: the edges are drawn in index order (row by row) while a translucent sheet in
  // the theme's orange sweeps from the first row to the last. Skipped under reduced motion
  const scan = useRef(reduced ? 1 : 0);
  const scanning = useRef(false);
  // Reset view scans it in again
  const firstScan = useRef(scanId);
  useEffect(() => {
    if (scanId === firstScan.current || reduced) return;
    scan.current = 0;
    invalidate();
  }, [scanId, reduced, invalidate]);
  useFrame((state, delta) => {
    const progress = scan.current;
    if (progress >= 1 && !scanning.current) return;
    // Its first frame's delta spans the time before it opened: one step instead
    const dt = scanning.current ? Math.min(delta, 0.1) : 1 / 60;
    scanning.current = progress < 1;
    const next = reduced ? 1 : Math.min(1, progress + dt / SCAN_TIME);
    scan.current = next;
    const count = geometry.index.count;
    geometry.setDrawRange(0, next >= 1 ? count : Math.floor((next * count) / 2) * 2);
    if (sheet.current) {
      sheet.current.visible = next < 1;
      sheet.current.position.z = (next - 0.5) * (map.height - 1);
    }
    onScan?.(next);
    state.invalidate();
  });
  const sheetBottom = Math.min(map.min, 0) * map.altitude * zScale - 0.3;
  const sheetHeight = (Math.max(map.max, 0) - Math.min(map.min, 0)) * map.altitude * zScale + 0.6;

  return (
    <group ref={group}>
      <lineSegments geometry={geometry} material={materials.lines} scale={[1, zScale, 1]} />
      {!reduced && (
        // A unit plane scaled to the grid: its geometry is never rebuilt
        <mesh
          ref={sheet}
          position={[0, sheetBottom + sheetHeight / 2, -(map.height - 1) / 2]}
          scale={[map.width + 1, sheetHeight, 1]}
        >
          <planeGeometry />
          <primitive object={materials.sheet} attach='material' />
        </mesh>
      )}
    </group>
  );
};

/**
 * The materials, made once per Canvas and shared by each map's Model (keyed by map id, so a switch
 * frees the last map's geometry) so a switch compiles no shaders. Not created in JSX: freed here
 */
const Wireframe = ({ map, ...props }) => {
  const materials = useMemo(
    () => ({
      lines: new LineBasicMaterial({ vertexColors: true }),
      // Two-sided, so it shows whichever way the model is turned
      sheet: new MeshBasicMaterial({
        color: new Color(`rgb(${readTheme(['primary-400'])['primary-400'].replace(/ /g, ',')})`),
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        side: DoubleSide,
      }),
    }),
    []
  );
  useEffect(
    () => () => {
      materials.lines.dispose();
      materials.sheet.dispose();
    },
    [materials]
  );
  return <Model key={map.id} map={map} materials={materials} {...props} />;
};

/**
 * A terminal-style readout over the view: the original's command, the map's grid and counts, the
 * current view, and the load scan's progress. The counter's running figure is visual only; the
 * total is in the text for screen readers
 */
const Readout = ({ t, map, counterRef, status, projection, zScaleText, solid }) => {
  const vertices = map.width * map.height;
  // [label, value, shown on phones too]: a short readout there, so it does not cover the model
  const rows = [
    ['grid', `${map.width} × ${map.height}`, false],
    ['vertices', null, true],
    ['edges', edgesOf(map), true],
    ['zRange', `${map.min} → ${map.max}`, false],
    ['view', `${t(`demos.fdf.projections.${projection}`)} · z ${zScaleText}`, false],
  ];
  return (
    <div
      className={`pointer-events-none absolute left-3 top-3 rounded-xl border border-line ${solid ? 'bg-background' : 'bg-background/85'} px-3 py-2 font-mono text-xs leading-relaxed text-foreground`}
    >
      <p>
        <span aria-hidden='true' className='text-primary-400'>
          ${' '}
        </span>
        ./exut_fdf_bonus {map.file}
      </p>
      <dl className='mt-1 grid grid-cols-[auto_auto] gap-x-4'>
        {rows.map(([key, value, always]) => (
          <div key={key} className={always ? 'contents' : 'hidden sm:contents'}>
            <dt className='text-foreground-muted'>{t(`demos.fdf.readout.${key}`)}</dt>
            <dd className='tabular-nums'>
              {value ?? (
                <>
                  {/* Keyed: the scan writes its text directly, so each map gets a fresh node */}
                  <span key={map.id} aria-hidden='true' ref={counterRef}>
                    {status === 'scanning' ? 0 : vertices}
                  </span>
                  <span className='sr-only'>{vertices}</span>
                </>
              )}
            </dd>
          </div>
        ))}
        <dt className='text-foreground-muted'>{t('demos.fdf.readout.status')}</dt>
        <dd className={status === 'rendered' ? 'text-success' : 'text-foreground-muted'}>
          {t(`demos.fdf.readout.${status}`)}
        </dd>
      </dl>
    </div>
  );
};

/** Fits the model: the orthographic camera's zoom, and the perspective camera's distance */
const fitZoom = (size, span) => Math.min(size.width, size.height * 1.7) / (span * 1.15);
const MIN_DISTANCE = 3;
/** A map's default views and limits, from the grid's diagonal */
const viewFor = (span) => {
  const distance = (span / 2 / Math.tan(MathUtils.degToRad(20))) * 1.05;
  return {
    span,
    // The orthographic camera sits in front of every point of the grid
    iso: DIRECTION.clone().multiplyScalar(span + 20),
    perspective: DIRECTION.clone().multiplyScalar(distance),
    // Perspective zoom limit, inside the cameras' far plane
    maxDistance: distance * 4,
    far: distance * 4 + span,
  };
};

// Plain three.js cameras made the store's default camera (lighter than drei's camera components):
// R3F keeps the default camera's frustum in step with the canvas size on resize
const fitFrustum = (camera, size, far) => {
  camera.far = far;
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

const Cameras = ({ map, projection, reduced, actionsRef }) => {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  // The OrbitControls built for the current default camera (makeDefault puts them in the store;
  // drei rebuilds them when the camera changes)
  const controls = useThree((s) => s.controls);
  const set = useThree((s) => s.set);
  const span = spanOf(map);
  // Per map, not per span: julia and elem-fract share one, and each starts from its own default
  const view = useMemo(() => ({ ...viewFor(span), id: map.id }), [span, map.id]);
  // Fitted per map: a later resize (a phone turning, the URL bar folding) keeps the user's zoom
  const [cameras] = useState(() => ({
    isometric: new OrthographicCamera(-1, 1, 1, -1, 0.1, 500),
    perspective: new PerspectiveCamera(40, 1, 0.1, 500),
    id: null,
    isoZoom: 1,
  }));
  if (cameras.id !== map.id) {
    cameras.id = map.id;
    cameras.isoZoom = fitZoom(size, span);
  }
  const minZoom = cameras.isoZoom / 20;
  const maxZoom = cameras.isoZoom * 10;

  // A projection switch or a new map starts the camera from the default view
  useLayoutEffect(() => {
    const next = cameras[projection];
    next.position.copy(projection === 'isometric' ? view.iso : view.perspective);
    if (next.isOrthographicCamera) next.zoom = cameras.isoZoom;
    next.lookAt(0, 0, 0);
    fitFrustum(next, size, view.far);
    set({ camera: next });
    invalidate();
    // The size at the switch; later resizes are R3F's
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projection, view, cameras, set, invalidate]);

  // New controls (first mount, or a projection switch) and a new map start from the default view
  // centred on the grid, saved for Reset
  useEffect(() => {
    if (!controls) return;
    controls.target.set(0, 0, 0);
    controls.update();
    controls.saveState();
    invalidate();
  }, [controls, view, invalidate]);

  // Keyboard and button actions, in the camera's own terms
  useEffect(() => {
    if (!controls) return;
    actionsRef.current = {
      zoom: (factor) => {
        if (camera.isOrthographicCamera) {
          camera.zoom = MathUtils.clamp(camera.zoom * factor, minZoom, maxZoom);
          camera.updateProjectionMatrix();
        } else {
          OFFSET.copy(camera.position).sub(controls.target).divideScalar(factor);
          OFFSET.setLength(MathUtils.clamp(OFFSET.length(), MIN_DISTANCE, view.maxDistance));
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
  }, [camera, controls, actionsRef, invalidate, minZoom, maxZoom, view]);

  return (
    <>
      {/* Drag moves the model (as the original's arrow keys), right-drag or two fingers turn it,
          the wheel or a pinch zooms */}
      <OrbitControls
        makeDefault
        enableDamping={!reduced}
        mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
        touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE }}
        minZoom={minZoom}
        maxZoom={maxZoom}
        minDistance={MIN_DISTANCE}
        maxDistance={view.maxDistance}
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

// A map: its name over its grid. Checked: the orange fill of the toggles, the name underlined
const PILL =
  'group flex shrink-0 snap-start flex-col items-start rounded-lg border-2 border-transparent px-3 py-1 text-left leading-tight text-sm font-semibold text-foreground transition-colors aria-checked:bg-primary aria-checked:text-on-primary forced-colors:aria-checked:border-[Highlight]';

/**
 * The map picker: a radio group of pills, one checked. Tab enters on the checked map; arrows, Home
 * and End move and pick (the radio pattern), Enter or Space pick the focused one. A row that
 * scrolls sideways on phones, wrapped beside the view
 */
const MapPicker = ({ t, value, onChange, reduced }) => {
  const labelId = useId();
  const pills = useRef({});
  const row = useRef(null);
  const first = useRef(true);
  useEffect(() => {
    const pill = pills.current[value];
    const box = row.current;
    if (!pill || !box) return;
    // Focus in the group follows the checked map: after an arrow key, and back from a map that
    // failed to load (an unchecked pill is no tab stop, and shows no ring)
    if (box.contains(document.activeElement) && document.activeElement !== pill) {
      pill.focus({ preventScroll: true });
    }
    if (first.current) {
      first.current = false;
      return;
    }
    // Scrolls the row only (not the dialog), leaving room for the focus ring
    const pad = 8;
    const left = pill.offsetLeft; // the row is the pills' offsetParent (relative)
    const behavior = reduced ? 'auto' : 'smooth';
    if (left - pad < box.scrollLeft) box.scrollTo({ left: left - pad, behavior });
    else if (left + pill.offsetWidth + pad > box.scrollLeft + box.clientWidth) {
      box.scrollTo({ left: left + pill.offsetWidth + pad - box.clientWidth, behavior });
    }
  }, [value, reduced]);

  const onKeyDown = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const at = FDF_MAPS.findIndex((map) => map.id === value);
    const last = FDF_MAPS.length - 1;
    const next = {
      ArrowRight: at + 1,
      ArrowDown: at + 1,
      ArrowLeft: at - 1,
      ArrowUp: at - 1,
      Home: 0,
      End: last,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    onChange(FDF_MAPS[(next + FDF_MAPS.length) % FDF_MAPS.length].id);
  };

  return (
    <div>
      <p id={labelId} className='text-sm font-semibold text-foreground'>
        {t('demos.fdf.map')}
      </p>
      {/* Room inside the scroller for the focus ring (2 px, 3 px off), snapped or not */}
      <div
        ref={row}
        role='radiogroup'
        aria-labelledby={labelId}
        onKeyDown={onKeyDown}
        className='relative mt-2 flex snap-x scroll-px-2 gap-1 overflow-x-auto rounded-xl border border-line-strong p-2 md:flex-wrap md:overflow-visible'
      >
        {FDF_MAPS.map((map) => {
          const checked = map.id === value;
          return (
            <button
              key={map.id}
              ref={(node) => {
                pills.current[map.id] = node;
              }}
              type='button'
              role='radio'
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => onChange(map.id)}
              className={PILL}
            >
              <span className='decoration-2 underline-offset-4 group-aria-checked:underline'>
                {t(`demos.fdf.maps.${map.id}.name`)}
              </span>
              <span
                className={`text-xs font-normal tabular-nums ${checked ? 'text-on-primary' : 'text-foreground-muted'}`}
              >
                {map.width} × {map.height}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/** The FdF viewer: the canvas and its control panel */
const FdfViewer = ({ t }) => {
  const reduced = usePrefersReducedMotion();
  // The map drawn, and the one picked (ahead of it while its file loads)
  const [map, setMap] = useState(DEFAULT_MAP);
  const [picked, setPicked] = useState(DEFAULT_MAP.id);
  const [failed, setFailed] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [zScale, setZScale] = useState(1);
  const [projection, setProjection] = useState('isometric');
  const [palette, setPalette] = useState('altitude');
  const [turns, setTurns] = useState(0);
  const [scanId, setScanId] = useState(0);
  const actionsRef = useRef({});
  const glRef = useRef(null);
  // The load scan's progress, written straight to the readout's counter (no render per frame)
  const counterRef = useRef(null);
  const [scanned, setScanned] = useState(reduced);
  const vertices = map.width * map.height;
  const onScan = useCallback(
    (progress) => {
      if (counterRef.current) counterRef.current.textContent = Math.round(progress * vertices);
      if (progress >= 1) setScanned(true);
    },
    [vertices]
  );
  const sliderId = useId();
  const helpId = useId();

  // The file's colors only for a map that has them; By altitude stands in for the others
  // (both the map drawn and the one picked, so the button never vanishes under focus at the draw)
  const fileColors = map.colors && FDF_MAPS.find(({ id }) => id === picked).colors;
  const palettes = fileColors ? ['altitude', 'original', 'file'] : ['altitude', 'original'];
  const shownPalette = palettes.includes(palette) ? palette : 'altitude';
  // The file's colors are drawn on black: the overlays turn opaque over it, for their contrast
  const onBlack = shownPalette === 'file';

  // Picks a map: drawn once its file is in (at once if it was loaded before). The latest pick
  // wins; a file that fails to load leaves the current map
  const wanted = useRef(DEFAULT_MAP.id);
  const drawn = useRef(map);
  drawn.current = map;
  const pick = useCallback(
    (id) => {
      if (id === wanted.current) return;
      wanted.current = id;
      setPicked(id);
      setFailed(null);
      // Cleared first, so the same message (a retry failing again) is announced again
      setAnnouncement('');
      loadMap(id).then(
        (next) => {
          if (wanted.current !== id) return;
          setMap(next);
          setTurns(0);
          setScanned(reduced);
          setAnnouncement(
            t('demos.fdf.mapLoaded', {
              name: t(`demos.fdf.maps.${id}.name`),
              width: next.width,
              height: next.height,
            })
          );
        },
        () => {
          if (wanted.current !== id) return;
          wanted.current = drawn.current.id;
          setPicked(drawn.current.id);
          setFailed(id);
          setAnnouncement(t('demos.fdf.loadError', { name: t(`demos.fdf.maps.${id}.name`) }));
        }
      );
    },
    [reduced, t]
  );
  const step = (dir) => {
    const at = FDF_MAPS.findIndex(({ id }) => id === picked);
    pick(FDF_MAPS[(at + dir + FDF_MAPS.length) % FDF_MAPS.length].id);
  };

  const canvasLabel = t('demos.fdf.canvasLabel', {
    file: map.file.replace('test_maps/', ''),
    width: map.width,
    height: map.height,
    shape: t(`demos.fdf.maps.${map.id}.shape`),
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
    if (!reduced) {
      setScanned(false);
      setScanId((n) => n + 1);
    }
  };

  // Keys act while the viewer has focus (Escape is left to the dialog)
  const onKeyDown = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const pan = PAN.find(({ key }) => key === e.key);
    const letter = e.key.toLowerCase();
    if (pan) act('pan', pan.x * PAN_STEP, pan.y * PAN_STEP);
    else if (['+', '='].includes(e.key) || e.code === 'NumpadAdd') act('zoom', ZOOM_STEP);
    else if (e.key === '-' || e.code === 'NumpadSubtract') act('zoom', 1 / ZOOM_STEP);
    // Letters by the character typed (mnemonics, not positions: M is elsewhere on AZERTY)
    else if (letter === 'r') rotate(e.shiftKey ? -1 : 1);
    else if (letter === 'p')
      setProjection((p) => (p === 'isometric' ? 'perspective' : 'isometric'));
    else if (letter === 'm') step(e.shiftKey ? -1 : 1);
    else return;
    e.preventDefault();
  };

  const status = picked !== map.id ? 'loading' : scanned ? 'rendered' : 'scanning';

  return (
    <div className='flex h-full flex-col md:flex-row'>
      <div
        tabIndex={0}
        // application: screen readers pass the view's own keys (arrows, R, P, M) through
        role='application'
        aria-label={t('demos.fdf.viewLabel')}
        aria-describedby={helpId}
        onKeyDown={onKeyDown}
        // The file's colors on black, as in the original's MiniLibX window (light lines and pure
        // greens would vanish on the light theme)
        className={`group relative min-h-[50vh] flex-1 touch-none outline-none md:min-h-0 ${onBlack ? 'bg-black' : ''}`}
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
          <Wireframe
            map={map}
            zScale={zScale}
            palette={shownPalette}
            turns={turns}
            reduced={reduced}
            scanId={scanId}
            onScan={onScan}
          />
          <Cameras map={map} projection={projection} reduced={reduced} actionsRef={actionsRef} />
        </Canvas>
        <Readout
          t={t}
          map={map}
          counterRef={counterRef}
          status={status}
          projection={projection}
          zScaleText={zScaleText}
          solid={onBlack}
        />
        <p
          id={helpId}
          className={`pointer-events-none absolute bottom-3 left-3 max-w-sm rounded-xl ${onBlack ? 'bg-background' : 'bg-background/80'} px-3 py-2 text-sm text-foreground-muted`}
        >
          {t('demos.fdf.help')}
        </p>
        {/* The focus ring, drawn above the canvas */}
        <span aria-hidden='true' className={styles.viewFocusRing} />
      </div>

      {/* FdF-style controls */}
      <div className='flex shrink-0 flex-col gap-4 overflow-y-auto border-t border-line bg-glass p-4 backdrop-blur-md md:w-72 md:border-l md:border-t-0'>
        <div>
          <MapPicker t={t} value={picked} onChange={pick} reduced={reduced} />
          {/* One live region: a map loaded (for screen readers), or an error, shown */}
          <p role='status' className={failed ? 'mt-2 text-sm text-danger' : 'sr-only'}>
            {announcement}
          </p>
        </div>

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
          options={palettes}
          value={shownPalette}
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
