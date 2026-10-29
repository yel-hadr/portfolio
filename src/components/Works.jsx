import { Suspense, lazy, useState } from 'react';
import { motion } from 'framer-motion';

import { styles } from '../styles';
import { SectionWrapper } from '../hoc';
import { projects } from '../constans';
import { reveal } from '../utils/motion';
import SectionHeader from './SectionHeader';
import { useI18n } from '../i18n/context';
import CanvasErrorBoundary from './CanvasErrorBoundary';
import { GithubIcon } from './icons';

// The diagram modal (SVG diagrams + text) loads only when a visitor opens one
const ArchitectureModal = lazy(() => import('./diagrams/ArchitectureModal'));
// The live demos (each with its own 3D scene) load only when a visitor runs one
const DEMOS = {
  cub3d: lazy(() => import('./Cub3D/Cub3DModal')),
  fdf: lazy(() => import('./Fdf/FdfModal')),
};

// Tag colors in src/constans keep their legacy class names; map them to theme tokens with AA
// contrast on surface-raised in both themes.
const TAG_COLORS = {
  'blue-text-gradient': 'text-info',
  'green-text-gradient': 'text-success',
  'pink-text-gradient': 'text-danger',
  'orange-text-gradient': 'text-primary-400',
};

const ProjectCard = ({
  id,
  tags,
  image,
  source_code_link,
  diagram,
  demo,
  onOpenDiagram,
  onRunDemo,
}) => {
  const { t } = useI18n();
  const name = t(`works.items.${id}.name`);

  return (
    <motion.li variants={reveal()} className={`${styles.card} flex flex-col`}>
      {image && (
        <img
          src={image}
          alt=''
          loading='lazy'
          decoding='async'
          className='mb-5 aspect-video w-full rounded-xl object-cover'
        />
      )}
      <h3 className='text-foreground text-xl font-bold'>{name}</h3>
      <p className='mt-2 text-foreground-muted leading-relaxed'>
        {t(`works.items.${id}.description`)}
      </p>
      <ul className='mt-4 flex flex-wrap gap-2' aria-label={t('works.technologies')}>
        {tags.map((tag) => (
          <li
            key={tag.name}
            // Technology names are English, also on the French page
            lang='en'
            className={`rounded-full border border-line bg-surface-raised px-3 py-1 text-sm font-medium ${TAG_COLORS[tag.color] ?? 'text-foreground-muted'}`}
          >
            {tag.name}
          </li>
        ))}
      </ul>
      {demo && (
        // A live demo: two buttons, the demo first
        <div className='mt-auto flex flex-wrap items-center gap-3 pt-6'>
          <button
            type='button'
            onClick={(e) => onRunDemo(demo, e.currentTarget)}
            aria-haspopup='dialog'
            aria-label={t('works.runDemoAria', { name })}
            className={styles.buttonPrimary}
          >
            {t('works.runDemo')}
          </button>
          <a
            href={source_code_link}
            target='_blank'
            rel='noopener noreferrer'
            aria-label={t('works.viewOnGithubAria', { name })}
            className={`${styles.buttonGhost} gap-2`}
          >
            <GithubIcon className='h-5 w-5' />
            {t('works.viewOnGithub')}
          </a>
        </div>
      )}
      {!demo && (diagram || source_code_link) && (
        <div className='mt-auto flex flex-wrap items-center gap-x-6 gap-y-3 pt-6'>
          {diagram && (
            <button
              type='button'
              onClick={(e) => onOpenDiagram(diagram, e.currentTarget)}
              aria-haspopup='dialog'
              className='inline-flex w-fit items-center gap-2 rounded-xl font-semibold text-primary-400 transition-colors hover:text-foreground'
            >
              <svg
                aria-hidden='true'
                viewBox='0 0 20 20'
                fill='none'
                stroke='currentColor'
                strokeWidth='1.75'
                strokeLinecap='round'
                strokeLinejoin='round'
                className='h-5 w-5'
              >
                <rect x='2.5' y='3' width='6' height='4.5' rx='1' />
                <rect x='11.5' y='12.5' width='6' height='4.5' rx='1' />
                <rect x='2.5' y='12.5' width='6' height='4.5' rx='1' />
                <path d='M5.5 7.5v5M8.5 5.25h3.5a2.5 2.5 0 0 1 2.5 2.5v4.75' />
              </svg>
              {t('works.viewArchitecture')}
              <span className='sr-only'>{t('works.viewArchitectureSr', { name })}</span>
            </button>
          )}
          {source_code_link && (
            <a
              href={source_code_link}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex w-fit items-center gap-2 rounded-xl font-semibold text-foreground hover:text-primary-400 transition-colors'
            >
              <GithubIcon className='h-5 w-5' />
              {t('works.viewSource')}
              <span className='sr-only'>{t('works.viewSourceSr', { name })}</span>
            </a>
          )}
        </div>
      )}
    </motion.li>
  );
};

const Works = () => {
  const { t } = useI18n();
  // { diagram, opener }: the button that opened the modal gets focus back when it closes
  const [open, setOpen] = useState(null);
  // { demo, opener }, the same for a live demo
  const [running, setRunning] = useState(null);
  // Said when a demo's chunk fails to load and its dialog closes again
  const [demoNotice, setDemoNotice] = useState('');
  const Demo = running && DEMOS[running.demo];
  // `running?.`: the React Compiler reads this as the callback's memo dependency during render,
  // when no demo is running
  const closeDemo = () => {
    running?.opener?.focus();
    setRunning(null);
  };

  return (
    <>
      <SectionHeader id='works' title={t('works.title')} lead={t('works.lead')} />
      <ul className='mt-12 grid gap-8 md:grid-cols-2'>
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            {...project}
            onOpenDiagram={(diagram, opener) => setOpen({ diagram, opener })}
            onRunDemo={(demo, opener) => setRunning({ demo, opener })}
          />
        ))}
      </ul>
      {open && (
        <Suspense fallback={null}>
          <ArchitectureModal
            diagram={open.diagram}
            onClose={() => {
              open.opener?.focus();
              setOpen(null);
            }}
          />
        </Suspense>
      )}
      {Demo && (
        // A demo chunk that fails to load closes it again (the card keeps its GitHub link)
        <CanvasErrorBoundary
          key={running.demo}
          sectionType={`demo chunk ${running.demo}`}
          onError={() => {
            closeDemo();
            setDemoNotice(t('works.demoFailed'));
          }}
        >
          <Suspense fallback={null}>
            <Demo onClose={closeDemo} />
          </Suspense>
        </CanvasErrorBoundary>
      )}
      <p role='status' className='sr-only'>
        {demoNotice}
      </p>
    </>
  );
};

const WorksSection = SectionWrapper(Works, 'works');

export default WorksSection;
