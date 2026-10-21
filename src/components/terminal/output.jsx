// Building blocks for terminal output. Commands render their output once, with the language
// active at that moment (t is passed in, not read from context), so printed lines never change.

/** One command's output */
export const Block = ({ children }) => <div className='mb-3 space-y-1'>{children}</div>;

export const Heading = ({ children }) => (
  <p className='font-semibold text-primary-400'>{children}</p>
);

export const Muted = ({ children }) => <p className='text-foreground-muted'>{children}</p>;

export const ErrorLine = ({ children }) => <p className='text-danger'>{children}</p>;

/** A command name or other literal input */
export const Cmd = ({ children }) => <code className='font-mono text-success'>{children}</code>;

/** Bulleted list with a terminal-style dash (the dash is decorative; the list is semantic) */
export const Bullets = ({ items }) => (
  <ul className='space-y-0.5'>
    {items.map((item) => (
      <li key={item} className='flex gap-2'>
        <span aria-hidden='true' className='text-foreground-muted'>
          -
        </span>
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

const LINK =
  'break-all py-1 text-info underline underline-offset-2 transition-colors hover:text-foreground';

/** External link (new tab). `newTab` is the screen reader suffix, e.g. " (opens in a new tab)" */
export const ExtLink = ({ href, newTab, children }) => (
  <a href={href} target='_blank' rel='noopener noreferrer' className={LINK}>
    {children}
    <span className='sr-only'>{newTab}</span>
  </a>
);

export const Link = ({ href, children, ...props }) => (
  <a href={href} className={LINK} {...props}>
    {children}
  </a>
);

/** Replaces {name} placeholders in a translated string with nodes (commands, links...) */
export const Rich = ({ text, values }) =>
  String(text)
    .split(/(\{\w+\})/)
    .map((part, i) => {
      const name = part.match(/^\{(\w+)\}$/)?.[1];
      return name && name in values ? <span key={i}>{values[name]}</span> : part;
    });

/** The prompt string, as printed before each command and the input */
export const Prompt = ({ t }) => (
  <span aria-hidden='true' className='shrink-0 select-none'>
    <span className='text-success'>{t('terminal.prompt.user')}</span>
    <span className='text-info'>{t('terminal.prompt.path')}</span>
  </span>
);

/** An echoed command line */
export const PromptLine = ({ t, text }) => (
  <p className='flex flex-wrap gap-x-2'>
    <Prompt t={t} />
    <span className='sr-only'>{t('terminal.commandSr')}</span>
    <span className='whitespace-pre-wrap break-all text-foreground'>{text}</span>
  </p>
);

export const Welcome = ({ t }) => (
  <Block>
    <p className='font-semibold text-foreground'>{t('terminal.welcome.title')}</p>
    <p>
      <Rich
        text={t('terminal.welcome.hint')}
        values={{ help: <Cmd>help</Cmd>, whoami: <Cmd>whoami</Cmd> }}
      />
    </p>
    <Muted>{t('terminal.welcome.keys')}</Muted>
  </Block>
);
