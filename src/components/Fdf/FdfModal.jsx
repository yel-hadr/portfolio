import { lazy } from 'react';

import { projects } from '../../constans';
import { useI18n } from '../../i18n/context';
import DemoShell from '../DemoShell';

// The 3D scene (three.js and R3F) is its own chunk, fetched only where WebGL can run it
const FdfViewer = lazy(() => import('./FdfViewer'));

const REPO = projects.find((p) => p.demo === 'fdf').source_code_link;

/** The FdF demo's dialog, loaded lazily from the Works section */
const FdfModal = ({ onClose, origin }) => {
  const { t } = useI18n();
  return (
    <DemoShell id='fdf' repo={REPO} onClose={onClose} origin={origin}>
      <FdfViewer t={t} />
    </DemoShell>
  );
};

export default FdfModal;
