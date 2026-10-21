import { motion } from 'framer-motion';

import { github } from '../assets';
import { styles } from '../styles';
import { SectionWrapper } from '../hoc';
import { projects } from '../constans';
import { reveal } from '../utils/motion';
import SectionHeader from './SectionHeader';

// Tag colors in src/constans keep their legacy class names; map them to solid,
// AA-contrast text colors (the old gradient text dropped to 4.3:1).
const TAG_COLORS = {
  'blue-text-gradient': 'text-sky-300',
  'green-text-gradient': 'text-emerald-300',
  'pink-text-gradient': 'text-pink-300',
  'orange-text-gradient': 'text-primary-400',
};

const ProjectCard = ({ name, description, tags, image, source_code_link }) => {
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
      <p className='mt-2 text-foreground-muted leading-relaxed'>{description}</p>
      <ul className='mt-4 flex flex-wrap gap-2' aria-label='Technologies'>
        {tags.map((tag) => (
          <li
            key={tag.name}
            className={`rounded-full border border-line bg-surface-raised px-3 py-1 text-sm font-medium ${TAG_COLORS[tag.color] ?? 'text-foreground-muted'}`}
          >
            {tag.name}
          </li>
        ))}
      </ul>
      {source_code_link && (
        <a
          href={source_code_link}
          target='_blank'
          rel='noopener noreferrer'
          className='mt-auto inline-flex w-fit items-center gap-2 rounded-xl pt-6 font-semibold text-foreground hover:text-primary-400 transition-colors'
        >
          <img src={github} alt='' className='h-5 w-5' />
          View source<span className='sr-only'> of {name} on GitHub (opens in a new tab)</span>
        </a>
      )}
    </motion.li>
  );
};

const Works = () => {
  return (
    <>
      <SectionHeader
        id='works'
        title='Projects.'
        lead='Infrastructure, networking and Kubernetes projects, with a link to the source where it is public.'
      />
      <ul className='mt-12 grid gap-8 md:grid-cols-2'>
        {projects.map((project) => (
          <ProjectCard key={project.name} {...project} />
        ))}
      </ul>
    </>
  );
};

const WorksSection = SectionWrapper(Works, 'works');

export default WorksSection;
