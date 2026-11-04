import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  LineBasicMaterial,
  MeshBasicMaterial,
  Object3D,
  QuadraticBezierCurve3,
  SphereGeometry,
  Vector3,
} from 'three';

import { useStillMotion } from '../../hooks/useMotionPaused';
import { onMessageSent } from '../../utils/messageSent';
import { readTheme } from '../../utils/themeColors';
import { toColor } from '../Cub3D/toColor';
import { AutoRotate, ViewCamera, WarmUp } from './helpers';

// The Contact globe, built in code (no model file): a wireframe sphere in the slate line color, its
// far half hidden by an inner sphere in the page color, with a small network on it, orange nodes
// joined by arcs that a pulse runs along. Cloud and infrastructure, in the page's own colors.
// Four draw calls: the inner sphere, the wireframe, the arcs (one set of segments) and the nodes
// with the pulses (one instanced mesh)
const R = 1.6;
const LATITUDES = 9;
const MERIDIANS = 12;
const SEGMENTS = 64;
// The arcs rise to this share of the radius above the surface at their middle
const LIFT = 0.16;
// Points along each arc
const ARC_POINTS = 48;
// Seconds a pulse takes along its arc
const PULSE_TIME = 3.2;
const NODE_RADIUS = 0.055;
const PULSE_SCALE = 0.04 / NODE_RADIUS;
// The wireframe's color, mixed this far toward the page color: it reads as a slightly translucent
// line, drawn opaque (on this unpremultiplied canvas a translucent line darkens where it meets
// the clear pixels past the inner sphere's edge)
const GRID_FADE = 0.25;
// The arcs draw themselves in once, as the globe comes into view (this share of its box showing),
// over ARC_DRAW_TIME seconds, and the pulses come out of them just after, by PULSE_IN of that time
const ARC_DRAW_TIME = 1.4;
const IN_VIEW = 0.3;
const PULSE_IN = 0.2;
const DRAWN = 1 + PULSE_IN;
// A message sent: the arcs flash and the nodes swell for this long
const FLASH_TIME = 1.2;
const NODE_SWELL = 0.6;
// Once for the page: the Canvas remounts after a demo, and the arcs should not draw in again
let arcsDrawn = false;
const markArcsDrawn = () => {
  arcsDrawn = true;
};

// Nodes as [latitude, longitude] in degrees; arcs join two of them
const NODES = [
  [48, 2],
  [34, -6],
  [40, -74],
  [37, -122],
  [-23, -46],
  [1, 104],
  [35, 139],
  [-33, 151],
];
const ARCS = [
  [0, 1],
  [0, 2],
  [2, 3],
  [2, 4],
  [0, 5],
  [5, 6],
  [5, 7],
];

const onSphere = ([lat, lon], r = R) => {
  const phi = (lat * Math.PI) / 180;
  const theta = (lon * Math.PI) / 180;
  return new Vector3(
    r * Math.cos(phi) * Math.sin(theta),
    r * Math.sin(phi),
    r * Math.cos(phi) * Math.cos(theta)
  );
};

const segments = (points) => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  return geometry;
};

// The wireframe: latitude rings and meridians as one set of line segments
const gridGeometry = () => {
  const points = [];
  const at = (phi, theta) => [
    R * Math.cos(phi) * Math.sin(theta),
    R * Math.sin(phi),
    R * Math.cos(phi) * Math.cos(theta),
  ];
  for (let i = 0; i < SEGMENTS; i++) {
    const [u0, u1] = [i / SEGMENTS, (i + 1) / SEGMENTS];
    for (let k = 1; k < LATITUDES; k++) {
      const phi = -Math.PI / 2 + (k * Math.PI) / LATITUDES;
      points.push(...at(phi, u0 * Math.PI * 2), ...at(phi, u1 * Math.PI * 2));
    }
    for (let m = 0; m < MERIDIANS; m++) {
      const theta = (m * Math.PI * 2) / MERIDIANS;
      points.push(
        ...at(-Math.PI / 2 + u0 * Math.PI, theta),
        ...at(-Math.PI / 2 + u1 * Math.PI, theta)
      );
    }
  }
  return segments(points);
};

// An arc between two nodes: a curve through a control point lifted above their midpoint
const arcCurve = ([a, b]) => {
  const from = onSphere(NODES[a]);
  const to = onSphere(NODES[b]);
  const control = from
    .clone()
    .add(to)
    .multiplyScalar(0.5)
    .setLength(R * (1 + LIFT * 2));
  return new QuadraticBezierCurve3(from, control, to);
};

// Every arc as one set of segments (one draw call), the first step of each arc, then the second of
// each...: so a growing draw range draws them all in together
const arcsGeometry = (curves) => {
  const paths = curves.map((curve) => curve.getPoints(ARC_POINTS));
  const points = [];
  for (let i = 0; i < ARC_POINTS; i++)
    for (const p of paths) points.push(p[i].x, p[i].y, p[i].z, p[i + 1].x, p[i + 1].y, p[i + 1].z);
  return segments(points);
};

// How far the arcs are drawn at `progress` (0 to 1), easing out: two vertices per segment
const showArcs = (geometry, progress) => {
  const shown = 1 - (1 - Math.min(progress, 1)) ** 3;
  geometry.setDrawRange(0, 2 * ARCS.length * Math.round(shown * ARC_POINTS));
};

// The pulses' size at `progress`: none until the arcs are drawn
const pulseSize = (progress) => PULSE_SCALE * Math.min(Math.max((progress - 1) / PULSE_IN, 0), 1);

// The theme's colors on the materials (method calls, so the memoized materials are not reassigned)
const paint = ({ materials, arcColors }) => {
  const c = readTheme(['line-strong', 'background', 'primary', 'primary-400', 'primary-hover']);
  const background = toColor(c.background);
  materials.grid.color.copy(toColor(c['line-strong']).lerp(background, GRID_FADE));
  materials.veil.color.copy(background);
  arcColors.rest.copy(toColor(c.primary));
  // The flash stands out from the arc: lighter on the dark page, deeper on the light one, whose
  // primary-400 is almost the arc's own color
  const light = document.documentElement.dataset.theme === 'light';
  arcColors.flash.copy(light ? toColor(c['primary-hover']) : toColor(c['primary-400'], 1.4));
  materials.arc.color.copy(arcColors.rest);
  materials.node.color.copy(toColor(c['primary-400'], 1.2));
};

// The instanced mesh's writes live here, outside the component (the React Compiler rejects
// property writes on values it holds). One scratch object, so no frame allocates
const dummy = new Object3D();

// The nodes: the first instances, placed once, and again while a flash swells them
const placeNodes = (mesh, nodes, size = 1) => {
  if (!mesh) return;
  nodes.forEach((position, i) => {
    dummy.position.copy(position);
    dummy.scale.setScalar(size);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
};

// The pulses: the instances after the nodes, each moved along its arc
const placePulses = (mesh, curves, time, size) => {
  if (!mesh) return;
  for (let i = 0; i < curves.length; i++) {
    curves[i].getPoint((time / PULSE_TIME + i / curves.length) % 1, dummy.position);
    dummy.scale.setScalar(size);
    dummy.updateMatrix();
    mesh.setMatrixAt(NODES.length + i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
};

// `strength` 0 to 1: the arcs' color toward the flash, the nodes' size
const flashGlobe = ({ materials, arcColors, nodes }, mesh, strength) => {
  materials.arc.color.copy(arcColors.rest).lerp(arcColors.flash, strength);
  placeNodes(mesh, nodes, 1 + NODE_SWELL * strength);
};

const Globe = ({ boxRef }) => {
  const still = useStillMotion();
  const invalidate = useThree((state) => state.invalidate);
  const points = useRef(null);
  const clock = useRef(0);
  // The arcs' draw-in: 0 to DRAWN, moving once `drawing` is set
  const drawn = useRef(arcsDrawn ? DRAWN : 0);
  const drawing = useRef(false);
  // What is left of a flash, from 1 to 0
  const flash = useRef(0);

  // Created once and freed on unmount: these are this scene's own, not a cached loader's
  const scene = useMemo(() => {
    const curves = ARCS.map(arcCurve);
    return {
      grid: gridGeometry(),
      veil: new SphereGeometry(R * 0.985, 48, 32),
      node: new SphereGeometry(NODE_RADIUS, 12, 8),
      arcs: arcsGeometry(curves),
      curves,
      nodes: NODES.map((n) => onSphere(n, R * 1.002)),
      // The arcs' two colors, kept for the flash; paint fills them
      arcColors: { rest: new Color(), flash: new Color() },
      // Untouched by the Canvas's tone mapping, which greyed the page's own colors: each takes
      // its token as it is. All opaque: on this unpremultiplied canvas a translucent fill
      // multiplies its alpha twice and came out a darker grey than the page
      materials: {
        grid: new LineBasicMaterial({ toneMapped: false }),
        veil: new MeshBasicMaterial({ toneMapped: false }),
        arc: new LineBasicMaterial({ toneMapped: false }),
        node: new MeshBasicMaterial({ toneMapped: false }),
      },
    };
  }, []);

  // Colored before the first frame, then again on every theme switch. Watching data-theme itself
  // (as the waves do) rather than the theme context: the colors are read from the page, which
  // must already be in the new theme
  useLayoutEffect(() => {
    paint(scene);
    invalidate();
    const observer = new MutationObserver(() => {
      paint(scene);
      invalidate();
    });
    observer.observe(document.documentElement, { attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [scene, invalidate]);

  // Stilled, or already drawn once: the arcs are whole, with nothing to wait for
  useLayoutEffect(() => {
    if (still) drawn.current = DRAWN;
    showArcs(scene.arcs, drawn.current);
    placeNodes(points.current, scene.nodes);
    placePulses(points.current, scene.curves, clock.current, pulseSize(drawn.current));
    invalidate();
  }, [scene, still, invalidate]);

  // The draw-in starts as the globe comes into view: it mounts a viewport ahead of it
  useEffect(() => {
    const box = boxRef?.current;
    if (drawn.current >= DRAWN) return undefined;
    if (!box || typeof IntersectionObserver === 'undefined') {
      drawn.current = DRAWN;
      showArcs(scene.arcs, DRAWN);
      invalidate();
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        drawing.current = true;
        markArcsDrawn();
        observer.disconnect();
      },
      { threshold: IN_VIEW }
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, [boxRef, scene, invalidate]);

  // A message sent flashes the arcs; stilled, nothing moves
  useEffect(() => {
    if (still) return undefined;
    return onMessageSent(() => {
      flash.current = 1;
    });
  }, [still]);

  useEffect(
    () => () => {
      scene.grid.dispose();
      scene.veil.dispose();
      scene.node.dispose();
      scene.arcs.dispose();
      Object.values(scene.materials).forEach((m) => m.dispose());
    },
    [scene]
  );

  // The pulses, the draw-in and a flash run on the ambient ticks; stilled, they hold where they are
  useFrame((_, delta) => {
    if (still) {
      if (flash.current > 0) {
        flash.current = 0;
        flashGlobe(scene, points.current, 0);
      }
      return;
    }
    const dt = Math.min(delta, 0.1);
    clock.current += dt;
    if (drawing.current && drawn.current < DRAWN) {
      drawn.current = Math.min(DRAWN, drawn.current + dt / ARC_DRAW_TIME);
      showArcs(scene.arcs, drawn.current);
    }
    placePulses(points.current, scene.curves, clock.current, pulseSize(drawn.current));
    if (flash.current > 0) {
      flash.current = Math.max(0, flash.current - dt / FLASH_TIME);
      flashGlobe(scene, points.current, Math.sin(Math.PI * flash.current));
    }
  });

  return (
    <>
      <ViewCamera position={[0, 0.4, 6.2]} fov={45} near={0.1} far={50} />
      {/* Its shaders compile while it loads a viewport away, not in the scroll frame that
          reaches it */}
      <WarmUp />
      {/* Tilted like the Earth's axis, turning slowly */}
      <group rotation={[0.35, 0, 0.12]}>
        <AutoRotate speed={0.12}>
          <mesh geometry={scene.veil} material={scene.materials.veil} />
          <lineSegments geometry={scene.grid} material={scene.materials.grid} />
          <lineSegments geometry={scene.arcs} material={scene.materials.arc} />
          {/* The moving instances leave the mesh's bounds, so it is never culled */}
          <instancedMesh
            ref={points}
            args={[scene.node, scene.materials.node, NODES.length + ARCS.length]}
            frustumCulled={false}
          />
        </AutoRotate>
      </group>
    </>
  );
};

export default Globe;
