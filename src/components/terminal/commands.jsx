// The terminal's commands. Each one gets ({ args, rest }, ctx) and returns the output to print
// (or null). ctx: { t, lang, setLang, theme, setTheme, history, close, reduced }.
import { education, experiences, person, projects, tils } from '../../constans';
import { dictionaries } from '../../i18n/dictionaries';
import { closest, completeWord, normalize } from './helpers';
import { Block, Bullets, Cmd, ErrorLine, ExtLink, Heading, Link, Muted, Rich } from './output';

// Page sections reachable with goto/cd, by every name a visitor might type
const sectionAliases = {
  about: 'about',
  apropos: 'about',
  'a-propos': 'about',
  experience: 'experience',
  tech: 'tech',
  skills: 'tech',
  competences: 'tech',
  stack: 'tech',
  works: 'works',
  projects: 'works',
  projets: 'works',
  education: 'education',
  formation: 'education',
  til: 'til',
  contact: 'contact',
};
const sectionIds = ['about', 'experience', 'tech', 'works', 'education', 'til', 'contact'];
// Shown in listings and offered by Tab: the canonical id plus the French name where it differs
const sectionNames = [...sectionIds, 'projects', 'projets', 'formation', 'a-propos'];

const RESUME_FILE = 'Youssef_Elhadraoui_Resume.pdf';

const arr = (value) => (Array.isArray(value) ? value : []);
const stripScheme = (url) => url.replace(/^https?:\/\/(www\.)?/, '');

const usageLine = (t, name) => (
  <Muted>
    <Rich
      text={t('terminal.usage')}
      values={{ usage: <Cmd>{`${name} ${t(`terminal.commands.${name}.args`)}`}</Cmd> }}
    />
  </Muted>
);

const sectionsLine = (t) => (
  <Muted>
    <Rich text={t('terminal.goto.sections')} values={{ list: <Cmd>{sectionIds.join(' ')}</Cmd> }} />
  </Muted>
);

// Scroll to a section and move focus there, as the navbar does. Runs two frames later: after
// the terminal has unmounted and App has returned focus to the button that opened it.
const jumpTo = (target, id, reduced) => {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
      window.history.pushState(null, '', `#${id}`);
      // Lets the navbar highlight the matching link (pushState fires no hashchange)
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    })
  );
};

// A programmatic <a download> click: the browser saves the PDF instead of navigating
const download = (href, filename) => {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
};

const LANG_ARGS = {
  en: 'en',
  english: 'en',
  anglais: 'en',
  fr: 'fr',
  french: 'fr',
  francais: 'fr',
};
const THEME_ARGS = { light: 'light', clair: 'light', dark: 'dark', sombre: 'dark' };

export const COMMANDS = [
  {
    name: 'help',
    aliases: ['aide', '?'],
    run: (_, { t }) => (
      <Block>
        <Heading>{t('terminal.help.title')}</Heading>
        <dl className='grid gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]'>
          {COMMANDS.filter((c) => !c.hidden).map((c) => {
            const args = c.args ? ` ${t(`terminal.commands.${c.name}.args`)}` : '';
            const aliases = c.aliases.filter((a) => a !== '?');
            return (
              <div key={c.name} className='contents'>
                <dt className='mt-1 sm:mt-0'>
                  <Cmd>{`${c.name}${args}`}</Cmd>
                </dt>
                <dd className='pl-4 sm:pl-0'>
                  {t(`terminal.commands.${c.name}.description`)}
                  {aliases.length > 0 && (
                    <span className='text-foreground-muted'>
                      {' '}
                      ({t('terminal.help.aliases', { list: aliases.join(', ') })})
                    </span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
        <Muted>{t('terminal.help.footer')}</Muted>
      </Block>
    ),
  },
  {
    name: 'whoami',
    aliases: [],
    run: (_, { t }) => (
      <Block>
        <p className='font-semibold text-foreground'>
          {t('terminal.whoami.name', { name: person.name, alias: person.alias })}
        </p>
        <p className='text-primary-400'>{t('person.title')}</p>
        <p>{t('terminal.whoami.oneLiner')}</p>
      </Block>
    ),
  },
  {
    name: 'about',
    aliases: ['à-propos', 'apropos'],
    run: (_, { t }) => (
      <Block>
        <Heading>{t('terminal.about.title')}</Heading>
        <p>{t('person.summary')}</p>
        <p className='pt-1 font-semibold text-foreground'>{t('about.whatIDo')}</p>
        <Bullets
          items={['backend', 'cloud', 'devops', 'automation'].map((id) =>
            t(`about.services.${id}`)
          )}
        />
        <Muted>
          <Rich
            text={t('terminal.about.more')}
            values={{
              experience: <Cmd>experience</Cmd>,
              projects: <Cmd>projects</Cmd>,
              skills: <Cmd>skills</Cmd>,
            }}
          />
        </Muted>
      </Block>
    ),
  },
  {
    name: 'experience',
    aliases: ['expérience', 'exp'],
    run: (_, { t }) => (
      <Block>
        <Heading>{t('terminal.experience.title')}</Heading>
        {experiences.map((exp) => (
          <div key={exp.id} className='pt-1'>
            <p className='font-semibold text-foreground'>
              {t('terminal.experience.role', {
                title: t(`experience.items.${exp.id}.title`),
                company: exp.company_name,
              })}
            </p>
            {exp.date && <Muted>{exp.date}</Muted>}
            <Bullets items={arr(t(`experience.items.${exp.id}.points`))} />
          </div>
        ))}
        <Muted>
          <Rich text={t('terminal.experience.more')} values={{ resume: <Cmd>resume</Cmd> }} />
        </Muted>
      </Block>
    ),
  },
  {
    name: 'projects',
    aliases: ['projets', 'works'],
    run: (_, { t }) => (
      <Block>
        <Heading>{t('terminal.projects.title')}</Heading>
        {projects.map((project) => {
          const name = t(`works.items.${project.id}.name`);
          return (
            <div key={project.id} className='pt-1'>
              <p className='font-semibold text-foreground'>{name}</p>
              <p>{t(`works.items.${project.id}.description`)}</p>
              <p>
                <span className='text-foreground-muted'>{t('terminal.projects.stack')} </span>
                {project.tags.map((tag) => tag.name).join(' · ')}
              </p>
              {/* No source line for a project without a link, as in the Projects section */}
              {project.source_code_link && (
                <p>
                  <span className='text-foreground-muted'>{t('terminal.projects.source')} </span>
                  <ExtLink href={project.source_code_link} newTab={t('terminal.newTab')}>
                    {stripScheme(project.source_code_link)}
                  </ExtLink>
                </p>
              )}
              {project.diagram && (
                <Muted>
                  <Rich
                    text={t('terminal.projects.diagram')}
                    values={{ cmd: <Cmd>goto works</Cmd> }}
                  />
                </Muted>
              )}
            </div>
          );
        })}
      </Block>
    ),
  },
  {
    name: 'skills',
    aliases: ['compétences', 'stack', 'tech'],
    run: (_, { t }) => (
      <Block>
        <Heading>{t('terminal.skills.title')}</Heading>
        <dl className='grid gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]'>
          {arr(t('terminal.skills.groups')).map((group) => (
            <div key={group.label} className='contents'>
              <dt className='mt-1 font-semibold text-foreground sm:mt-0'>{group.label}</dt>
              <dd className='pl-4 sm:pl-0'>{group.items}</dd>
            </div>
          ))}
        </dl>
        <Muted>
          <Rich text={t('terminal.skills.more')} values={{ resume: <Cmd>resume</Cmd> }} />
        </Muted>
      </Block>
    ),
  },
  {
    name: 'education',
    aliases: ['formation'],
    run: (_, { t }) => (
      <Block>
        <Heading>{t('terminal.education.title')}</Heading>
        {education.map((item) => (
          <div key={item.id} className='pt-1'>
            <p className='font-semibold text-foreground'>{item.school}</p>
            <p>{t(`education.items.${item.id}.degree`)}</p>
            <Muted>{t(`education.items.${item.id}.date`)}</Muted>
            <Bullets items={arr(t(`education.items.${item.id}.points`))} />
          </div>
        ))}
      </Block>
    ),
  },
  {
    name: 'contact',
    aliases: [],
    run: (_, { t }) => {
      const newTab = t('terminal.newTab');
      const rows = [
        [
          'github',
          <ExtLink key='gh' href={person.github} newTab={newTab}>
            {stripScheme(person.github)}
          </ExtLink>,
        ],
        [
          'linkedin',
          <ExtLink key='li' href={person.linkedin} newTab={newTab}>
            {stripScheme(person.linkedin)}
          </ExtLink>,
        ],
        [
          'email',
          <Link key='em' href={`mailto:${person.email}`}>
            {person.email}
          </Link>,
        ],
      ];
      return (
        <Block>
          <Heading>{t('terminal.contact.title')}</Heading>
          <dl className='grid gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,7rem)_minmax(0,1fr)]'>
            {rows.map(([key, link]) => (
              <div key={key} className='contents'>
                <dt className='mt-1 text-foreground-muted sm:mt-0'>
                  {t(`terminal.contact.${key}`)}
                </dt>
                <dd className='pl-4 sm:pl-0'>{link}</dd>
              </div>
            ))}
          </dl>
          <Muted>
            <Rich text={t('terminal.contact.form')} values={{ cmd: <Cmd>goto contact</Cmd> }} />
          </Muted>
        </Block>
      );
    },
  },
  {
    name: 'resume',
    aliases: ['cv'],
    run: (_, { t }) => {
      download(person.resume, RESUME_FILE);
      return (
        <Block>
          <p className='text-success'>{t('terminal.resume.downloading', { file: RESUME_FILE })}</p>
          <Muted>
            <Rich
              text={t('terminal.resume.fallback')}
              values={{
                link: (
                  <ExtLink href={person.resume} newTab={t('terminal.newTab')}>
                    {t('terminal.resume.open')}
                  </ExtLink>
                ),
              }}
            />
          </Muted>
        </Block>
      );
    },
  },
  {
    name: 'goto',
    aliases: ['cd'],
    args: true,
    run: ({ args }, { t, close, reduced }) => {
      if (!args[0])
        return (
          <Block>
            {usageLine(t, 'goto')}
            {sectionsLine(t)}
          </Block>
        );
      const word = normalize(args[0]).replace(/^[#/]+|\/+$/g, '');
      const id = sectionAliases[word];
      if (!id) {
        const suggestion = closest(word, Object.keys(sectionAliases));
        return (
          <Block>
            <ErrorLine>{t('terminal.goto.unknown', { name: args[0] })}</ErrorLine>
            {suggestion && (
              <p>
                <Rich
                  text={t('terminal.didYouMean')}
                  values={{ cmd: <Cmd>{`goto ${suggestion}`}</Cmd> }}
                />
              </p>
            )}
            {sectionsLine(t)}
          </Block>
        );
      }
      const target = document.getElementById(id);
      if (!target)
        return (
          <Block>
            <ErrorLine>
              {t('terminal.goto.missing', { name: t(`terminal.sections.${id}`) })}
            </ErrorLine>
          </Block>
        );
      close();
      jumpTo(target, id, reduced);
      return null;
    },
  },
  {
    name: 'ls',
    aliases: ['dir'],
    run: (_, { t }) => (
      <Block>
        <Heading>{t('terminal.ls.title')}</Heading>
        <dl className='grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-6 gap-y-0.5'>
          {sectionIds
            .filter((id) => document.getElementById(id))
            .map((id) => (
              <div key={id} className='contents'>
                <dt>
                  <Cmd>{id}</Cmd>
                </dt>
                <dd>{t(`terminal.sections.${id}`)}</dd>
              </div>
            ))}
        </dl>
        <Muted>
          <Rich text={t('terminal.ls.hint')} values={{ cmd: <Cmd>goto works</Cmd> }} />
        </Muted>
      </Block>
    ),
  },
  {
    name: 'til',
    aliases: [],
    run: (_, { t }) => (
      <Block>
        <Heading>{t('terminal.til.title')}</Heading>
        {tils.length === 0 ? (
          <Muted>{t('terminal.til.empty')}</Muted>
        ) : (
          <>
            <Bullets items={tils.map((til) => t(`til.items.${til.id}.title`))} />
            <Muted>
              <Rich text={t('terminal.til.more')} values={{ cmd: <Cmd>goto til</Cmd> }} />
            </Muted>
          </>
        )}
      </Block>
    ),
  },
  {
    name: 'lang',
    aliases: ['langue'],
    args: true,
    run: ({ args }, { t, lang, setLang }) => {
      const next = args[0] && LANG_ARGS[normalize(args[0])];
      if (!args[0])
        return (
          <Block>
            <p>{t('terminal.lang.current', { lang: t(`terminal.lang.names.${lang}`) })}</p>
            {usageLine(t, 'lang')}
          </Block>
        );
      if (!next)
        return (
          <Block>
            <ErrorLine>{t('terminal.lang.unknown', { value: args[0] })}</ErrorLine>
          </Block>
        );
      setLang(next);
      // Confirm in the new language: the output that follows is in it too
      return (
        <Block>
          <p className='text-success'>{dictionaries[next].terminal.lang.set}</p>
        </Block>
      );
    },
  },
  {
    name: 'theme',
    aliases: ['thème'],
    args: true,
    run: ({ args }, { t, theme, setTheme }) => {
      const next = args[0] && THEME_ARGS[normalize(args[0])];
      if (!args[0])
        return (
          <Block>
            <p>{t('terminal.theme.current', { theme: t(`terminal.theme.names.${theme}`) })}</p>
            {usageLine(t, 'theme')}
          </Block>
        );
      if (!next)
        return (
          <Block>
            <ErrorLine>{t('terminal.theme.unknown', { value: args[0] })}</ErrorLine>
          </Block>
        );
      setTheme(next);
      return (
        <Block>
          <p className='text-success'>
            {t('terminal.theme.set', { theme: t(`terminal.theme.names.${next}`) })}
          </p>
        </Block>
      );
    },
  },
  {
    name: 'history',
    aliases: ['historique'],
    run: (_, { t, history }) =>
      history.length === 0 ? (
        <Block>
          <Muted>{t('terminal.history.empty')}</Muted>
        </Block>
      ) : (
        <Block>
          <ol>
            {history.map((line, i) => (
              // Lines can repeat, so the position is part of the key
              <li key={`${i}-${line}`} className='flex gap-4'>
                <span className='w-8 shrink-0 text-right text-foreground-muted'>{i + 1}</span>
                <span className='whitespace-pre-wrap break-all'>{line}</span>
              </li>
            ))}
          </ol>
        </Block>
      ),
  },
  { name: 'clear', aliases: ['cls', 'effacer'], run: () => null },
  {
    name: 'echo',
    aliases: [],
    args: true,
    run: ({ rest }) => (
      <Block>
        <p className='whitespace-pre-wrap break-all'>{rest || ' '}</p>
      </Block>
    ),
  },
  {
    name: 'date',
    aliases: [],
    run: (_, { lang }) => (
      <Block>
        <p>
          {new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', {
            dateStyle: 'full',
            timeStyle: 'short',
          }).format(new Date())}
        </p>
      </Block>
    ),
  },
  {
    name: 'exit',
    aliases: ['quit', 'quitter'],
    run: (_, { close }) => {
      close();
      return null;
    },
  },
  // Easter egg, left out of help
  {
    name: 'sudo',
    aliases: [],
    hidden: true,
    run: (_, { t }) => (
      <Block>
        <p>
          <Rich text={t('terminal.sudo')} values={{ cmd: <Cmd>contact</Cmd> }} />
        </p>
      </Block>
    ),
  },
];

const allWords = COMMANDS.flatMap((c) => [c.name, ...c.aliases]);
const completable = COMMANDS.filter((c) => !c.hidden).flatMap((c) => [
  c.name,
  ...c.aliases.filter((a) => a !== '?'),
]);

export const findCommand = (word) => {
  const key = normalize(word);
  return COMMANDS.find((c) => [c.name, ...c.aliases].some((w) => normalize(w) === key));
};

/** The closest command word for an obvious typo, or null */
export const suggestCommand = (word) => closest(word, allWords);

/** Tab completion of the command, or of the argument of goto/cd, lang and theme */
export const complete = (value) => {
  const words = value.trimStart().split(/\s+/);
  if (words.length === 1) return completeWord(value, completable);
  if (words.length > 2) return { value, matches: [] };
  const name = findCommand(words[0])?.name;
  const options = {
    goto: sectionNames,
    lang: ['en', 'fr'],
    theme: ['light', 'dark', 'clair', 'sombre'],
  }[name];
  return options ? completeWord(value, options) : { value, matches: [] };
};
