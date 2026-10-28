import { lazy, useMemo } from 'react';

import { projects, technologies } from '../../constans';
import { useI18n } from '../../i18n/context';
import DemoShell from '../DemoShell';

// The 3D scene (three.js and R3F) is its own chunk, fetched only where WebGL can run it
const Cub3DWorld = lazy(() => import('./Cub3DWorld'));

const REPO = projects.find((p) => p.demo === 'cub3d').source_code_link;
// The wall panels show the same facts as the page: the stack and the project names
const TECH_NAMES = technologies.map((tech) => tech.name);

/** The cub3D demo's dialog, loaded lazily from the Works section */
const Cub3DModal = ({ onClose }) => {
  const { t } = useI18n();
  const projectNames = useMemo(
    () => projects.filter((p) => !p.demo).map((p) => t(`works.items.${p.id}.name`)),
    [t]
  );

  return (
    <DemoShell id='cub3d' repo={REPO} onClose={onClose}>
      <Cub3DWorld t={t} technologies={TECH_NAMES} projects={projectNames} />
    </DemoShell>
  );
};

export default Cub3DModal;
