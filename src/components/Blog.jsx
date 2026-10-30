import { m } from 'framer-motion';
// Titles and summaries come from the posts' front matter (build/blog.js); dates and tags from
// src/constans/posts.js. The posts themselves are static pages under /blog/ and /fr/blog/.
import { blogPath, blogPosts, feedPath } from 'virtual:blog-posts';

import { styles } from '../styles';
import { SectionWrapper } from '../hoc';
import { pressable, reveal } from '../utils/motion';
import SectionHeader from './SectionHeader';
import { useI18n } from '../i18n/context';

// How many of the newest posts the home page shows; the rest are on /blog/
const LATEST = 4;

// Tag colors are theme tokens with AA contrast on the glass card in both themes, cycled as on
// the blog pages
const TAG_COLORS = ['text-info', 'text-success', 'text-primary-400'];

const DATE_LOCALES = { en: 'en-GB', fr: 'fr-FR' };

// Dates are calendar days: format them in UTC so no time zone shifts them by one
const formatDate = (date, lang) =>
  new Intl.DateTimeFormat(DATE_LOCALES[lang] ?? DATE_LOCALES.en, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));

const RssIcon = () => (
  <svg
    aria-hidden='true'
    focusable='false'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    className='h-4 w-4'
  >
    <path d='M5 11a8 8 0 0 1 8 8M5 4a15 15 0 0 1 15 15' />
    <circle cx='6' cy='18' r='1.5' fill='currentColor' />
  </svg>
);

const PostCard = ({ slug, date, tags, title, summary }) => {
  const { t, lang } = useI18n();
  const text = (field) => field[lang] ?? field.en;

  return (
    <m.li
      variants={reveal()}
      className={`${styles.card} relative flex min-w-0 flex-col gap-4 transition-colors hover:border-line-strong`}
    >
      <h3 className={styles.cardTitle}>
        {/* The link covers the whole card (one link per card); its focus ring is drawn there */}
        <a
          href={blogPath(lang, slug)}
          className='underline-offset-4 after:absolute after:inset-0 after:rounded-3xl hover:underline focus-visible:outline-hidden focus-visible:after:outline-2 focus-visible:after:outline-offset-[3px] focus-visible:after:outline-focus'
        >
          {text(title)}
        </a>
      </h3>
      <p className='text-sm text-foreground-muted'>
        <time dateTime={date}>{formatDate(date, lang)}</time>
      </p>
      <p className={styles.body}>{text(summary)}</p>
      <ul className='mt-auto flex flex-wrap gap-2' aria-label={t('blog.topics')}>
        {tags.map((tag, i) => (
          <li
            key={tag}
            className={`rounded-full border border-line bg-surface-raised px-3 py-1 text-sm font-medium ${TAG_COLORS[i % TAG_COLORS.length]}`}
          >
            {tag}
          </li>
        ))}
      </ul>
    </m.li>
  );
};

const Blog = () => {
  const { t, lang } = useI18n();

  return (
    <>
      <SectionHeader id='blog' title={t('blog.title')} lead={t('blog.lead')} />
      <ul className='mt-12 grid gap-8 md:grid-cols-2' aria-label={t('blog.latest')}>
        {blogPosts.slice(0, LATEST).map((post) => (
          <PostCard key={post.slug} {...post} />
        ))}
      </ul>
      <m.div variants={reveal()} className='mt-10 flex flex-wrap items-center gap-x-8 gap-y-4'>
        <m.a href={blogPath(lang)} className={styles.buttonGhost} {...pressable}>
          {t('blog.allPosts')}
        </m.a>
        <a
          href={feedPath(lang)}
          type='application/rss+xml'
          className='inline-flex items-center gap-2 font-medium text-primary-400 underline underline-offset-4 hover:decoration-2'
        >
          <RssIcon />
          {t('blog.rss')}
        </a>
      </m.div>
    </>
  );
};

const BlogSection = SectionWrapper(Blog, 'blog');

export default BlogSection;
