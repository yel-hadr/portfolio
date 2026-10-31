import { Suspense, lazy, useState } from 'react';
import { m } from 'framer-motion';

import { styles } from '../styles';
import { SectionWrapper } from '../hoc';
import { projects } from '../constans';
import { pressable, reveal } from '../utils/motion';
import SectionHeader from './SectionHeader';
import Spotlight from './Spotlight';
import { useI18n } from '../i18n/context';
import CanvasErrorBoundary from './CanvasErrorBoundary';
import { GithubIcon } from './icons';
import { tagName } from '../utils/tagName';

// The diagram modal (SVG diagrams + text) loads only when a visitor opens one
const loadDiagram = () => import('./diagrams/ArchitectureModal');
const ArchitectureModal = lazy(loadDiagram);
// The live demos (each with its own 3D scene) load only when a visitor runs one
const DEMO_LOADERS = {
  cub3d: () => import('./Cub3D/Cub3DModal'),
  fdf: () => import('./Fdf/FdfModal'),
};
const DEMOS = { cub3d: lazy(DEMO_LOADERS.cub3d), fdf: lazy(DEMO_LOADERS.fdf) };
// Starts a chunk's download when the pointer reaches its button or the button takes focus, so the
// click finds it loaded. A failure here is ignored: the click's own load reports it
const prefetch = (load) => {
  load().catch(() => {});
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
    <m.li
      variants={reveal()}
      data-spotlight
      // The two 42 demos: a blueprint grid and a scan line on hover, like a terminal's screen
      className={`${styles.card} relative flex flex-col ${demo ? 'blueprint overflow-hidden' : ''}`}
    >
      <Spotlight />
      {demo && <span aria-hidden='true' className='scanline' />}
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
            key={tag.id ?? tag.name}
            // Product names are English, also on the French page; a technique (`id`) is translated
            lang={tag.id ? undefined : 'en'}
            className={`rounded-full border border-line bg-surface-raised px-3 py-1 text-sm font-medium ${TAG_COLORS[tag.color] ?? 'text-foreground-muted'}`}
          >
            {tagName(t, tag)}
          </li>
        ))}
      </ul>
      {demo && (
        // A live demo: two buttons, the demo first
        <div className='mt-auto grid gap-3 pt-6 xs:flex xs:flex-wrap xs:items-center'>
          <m.button
            type='button'
            onClick={(e) => onRunDemo(demo, e.currentTarget)}
            onPointerEnter={() => prefetch(DEMO_LOADERS[demo])}
            onFocus={() => prefetch(DEMO_LOADERS[demo])}
            aria-haspopup='dialog'
            aria-label={t('works.runDemoAria', { name })}
            className={styles.buttonPrimary}
            {...pressable}
          >
            {t('works.runDemo')}
          </m.button>
          <m.a
            href={source_code_link}
            target='_blank'
            rel='noopener noreferrer'
            aria-label={t('works.viewOnGithubAria', { name })}
            className={`${styles.buttonGhost} gap-2`}
            {...pressable}
          >
            <GithubIcon className='h-5 w-5' />
            {t('works.viewOnGithub')}
          </m.a>
        </div>
      )}
      {!demo && (diagram || source_code_link) && (
        <div className='mt-auto flex flex-wrap items-center gap-x-6 gap-y-3 pt-6'>
          {diagram && (
            <button
              type='button'
              onClick={(e) => onOpenDiagram(diagram, e.currentTarget)}
              onPointerEnter={() => prefetch(loadDiagram)}
              onFocus={() => prefetch(loadDiagram)}
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
    </m.li>
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
            onRunDemo={(demo, opener) => {
              // Cleared first, so a second failure changes the live region and is said again
              setDemoNotice('');
              // The card's box: the demo's dialog grows out of it
              setRunning({ demo, opener, origin: opener.closest('li')?.getBoundingClientRect() });
            }}
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
            <Demo onClose={closeDemo} origin={running.origin} />
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
