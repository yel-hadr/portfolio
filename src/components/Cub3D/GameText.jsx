import { useEffect, useRef, useState } from 'react';

import { styles } from '../../styles';
import ContactForm from '../ContactForm';
import { GameInfo } from './GameHud';
import { GAME_PANELS, NPCS, SECTIONS } from './rooms';

const TERMINALS = GAME_PANELS.filter(({ kind }) => kind === 'terminal').map(({ id }) => id);

/** Experience or education, as in their dossiers: what, where, when, and what was done */
const Entries = ({ entries }) => (
  <ol className='mt-3 space-y-4'>
    {entries.map(({ title, place, date, points }) => (
      <li key={`${title}-${place}`}>
        <h5 className='font-bold'>{title}</h5>
        <p className='text-sm font-semibold'>
          {place}
          {date && <span className='font-normal text-foreground-muted'> · {date}</span>}
        </p>
        {points.length > 0 && (
          <ul className='mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground-muted'>
            {points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        )}
      </li>
    ))}
  </ol>
);

/**
 * Game Mode's text-only mode: the command center's rooms as plain HTML, with no canvas at all,
 * for screen readers and anyone who would rather read. The same actions as in the game: the
 * terminals' live demos (`onRunDemo`) and the contact form. `canPlay` is false on a phone or
 * without WebGL, where the way back leads out of Game Mode; `returnTo` is the demo just closed,
 * whose button takes focus again.
 */
const GameText = ({ t, details, canPlay, returnTo, onRunDemo, onBack, onExit }) => {
  const headingRef = useRef(null);
  const demoButtons = useRef({});
  const [contact, setContact] = useState(false);
  const contactButton = useRef(null);

  useEffect(() => {
    (demoButtons.current[returnTo] ?? headingRef.current)?.focus();
    // On mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeContact = () => {
    setContact(false);
    requestAnimationFrame(() => contactButton.current?.focus());
  };

  const body = {
    about: details.about.lines.map((line) => (
      <p key={line} className='mt-2 leading-relaxed'>
        {line}
      </p>
    )),
    skills: (
      <ul className='mt-3 flex flex-wrap gap-2'>
        {details.skills.tags.map((tag) => (
          <li
            key={tag}
            className='rounded-lg border border-line-strong bg-surface-raised px-3 py-1'
          >
            {tag}
          </li>
        ))}
      </ul>
    ),
    projects: (
      <>
        <ul className='mt-3 space-y-3'>
          {details.projects.items.map(({ name, description, link }) => (
            <li key={name}>
              <h5 className='font-bold'>{name}</h5>
              <p className='text-sm leading-relaxed text-foreground-muted'>{description}</p>
              {link && (
                <a
                  href={link}
                  target='_blank'
                  rel='noopener noreferrer'
                  aria-label={t('demos.sourceAria', { name })}
                  className='text-sm font-semibold text-primary-400 underline underline-offset-4'
                >
                  {t('demos.source')}
                </a>
              )}
            </li>
          ))}
        </ul>
        <div className='mt-4 flex flex-wrap gap-3'>
          {TERMINALS.map((id) => (
            <button
              key={id}
              ref={(el) => {
                demoButtons.current[id] = el;
              }}
              type='button'
              onClick={() => onRunDemo(id)}
              className={styles.buttonGhost}
            >
              {t('demos.game.runDemo', { name: t(`demos.${id}.name`) })}
            </button>
          ))}
        </div>
      </>
    ),
    experience: <Entries entries={details.experience.entries} />,
    education: <Entries entries={details.education.entries} />,
    contact: (
      <>
        <div className='mt-3 flex flex-wrap gap-3'>
          <button
            ref={contactButton}
            type='button'
            onClick={() => setContact(true)}
            className={styles.buttonGhost}
          >
            {t('demos.game.openContact')}
          </button>
          {details.contact.links.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              target='_blank'
              rel='noopener noreferrer'
              className={styles.buttonGhost}
            >
              {label}
              <span className='sr-only'>{t('footer.newTab')}</span>
            </a>
          ))}
        </div>
      </>
    ),
  };

  return (
    <div className='h-full w-full overflow-y-auto'>
      <div className='mx-auto max-w-3xl p-6 text-foreground'>
        <div className='flex flex-wrap items-center gap-3'>
          <h3 ref={headingRef} tabIndex={-1} className='mr-auto text-2xl font-black outline-none'>
            {t('demos.game.textMode')}
          </h3>
          {canPlay && (
            <button type='button' onClick={onBack} className={styles.buttonPrimary}>
              {t('demos.game.backToGame')}
            </button>
          )}
          <button
            type='button'
            onClick={onExit}
            className={canPlay ? styles.buttonGhost : styles.buttonPrimary}
          >
            {t(canPlay ? 'demos.game.exit' : 'demos.game.back')}
          </button>
        </div>
        <p className='mt-3 text-foreground-muted'>{t('demos.game.textIntro')}</p>

        {SECTIONS.map((id) => (
          <section key={id} className='mt-8 border-t border-line pt-6'>
            <h4 className='text-xl font-bold text-primary-400'>{t(`demos.game.rooms.${id}`)}</h4>
            {body[id]}
          </section>
        ))}

        <section className='mt-8 border-t border-line pt-6'>
          <h4 className='text-xl font-bold text-primary-400'>{t('demos.game.intel')}</h4>
          <dl className='mt-3 space-y-3'>
            {['ddos', 'sql'].map((type) => (
              <div key={type}>
                <dt className='font-bold'>
                  {t(`demos.game.enemies.${type}`)}: {t(`demos.game.facts.${type}.title`)}
                </dt>
                <dd className='text-sm leading-relaxed text-foreground-muted'>
                  {t(`demos.game.facts.${type}.body`)}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* What the crew say in the game, so their lines are not only in the 3D view */}
        <section className='mt-8 border-t border-line pt-6'>
          <h4 className='text-xl font-bold text-primary-400'>{t('demos.game.crewTitle')}</h4>
          <dl className='mt-3 space-y-3'>
            {NPCS.map(({ id }) => (
              <div key={id}>
                <dt className='font-bold'>{t(`demos.game.npcs.${id}.name`)}</dt>
                <dd className='text-sm leading-relaxed text-foreground-muted'>
                  {t(`demos.game.npcs.${id}.line`)} {t(`demos.game.npcs.${id}.hint`)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {contact && (
        <GameInfo
          t={t}
          title={t('demos.game.panels.contact')}
          closeLabel={t('demos.game.closeDialog')}
          onClose={closeContact}
        >
          <ContactForm />
        </GameInfo>
      )}
    </div>
  );
};

export default GameText;
