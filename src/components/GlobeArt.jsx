/**
 * The Contact globe drawn flat, in the page's tokens: the slate wireframe and the orange network,
 * as the 3D Globe shows them. The static stand-in where there is no 3D (no WebGL2, a lost
 * context) and, faded, the placeholder while the 3D globe loads. Decorative: SceneView hides it.
 */
const GlobeArt = ({ className = '' }) => (
  <svg viewBox='0 0 200 200' fill='none' aria-hidden='true' focusable='false' className={className}>
    <g className='stroke-line-strong' strokeWidth='1.25'>
      <circle cx='100' cy='100' r='80' />
      {/* Meridians */}
      <ellipse cx='100' cy='100' rx='28' ry='80' />
      <ellipse cx='100' cy='100' rx='56' ry='80' />
      <line x1='100' y1='20' x2='100' y2='180' />
      {/* Latitudes */}
      <ellipse cx='100' cy='60' rx='69' ry='9' />
      <line x1='20' y1='100' x2='180' y2='100' />
      <ellipse cx='100' cy='140' rx='69' ry='9' />
    </g>
    {/* The network: two arcs between nodes */}
    <g className='stroke-primary-400' strokeWidth='2' strokeLinecap='round'>
      <path d='M62 74 Q 96 30 138 66' />
      <path d='M138 66 Q 160 110 122 146' />
    </g>
    <g className='fill-primary-400'>
      <circle cx='62' cy='74' r='4' />
      <circle cx='138' cy='66' r='4' />
      <circle cx='122' cy='146' r='4' />
    </g>
  </svg>
);

export default GlobeArt;
