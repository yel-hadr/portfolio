import { useCallback, useEffect, useEffectEvent, useId, useRef, useState } from 'react';

import { gameStorage, typingChallenge, typingCommands } from '../../constans';
import { Prompt } from '../terminal/output';
import { saveBest } from './storage';

// The terminal challenge (`game` in the terminal): type the commands shown before the clock runs
// out; each fixed command adds time (constans: typingChallenge) and the next one gets harder. It
// takes the place of the terminal's prompt line while it runs and reports the result through
// onEnd. Everything typed or shown is rendered as React text, never as HTML.

const START_MS = typingChallenge.seconds * 1000;
const BONUS_MS = typingChallenge.bonus * 1000;
const LOW_SECONDS = [10, 5]; // announced once each
// The clock, read only from event handlers and effects (the compiler can't tell onChange is one)
const clock = () => Date.now();

// Easy commands first, then a growing share of harder ones
const poolFor = (score) => {
  const { easy, medium, hard } = typingCommands;
  if (score < 3) return easy;
  if (score < 6) return [...easy, ...medium];
  if (score < 9) return [...medium, ...hard];
  return [...medium, ...hard, ...hard];
};

const nextCommand = (score, previous) => {
  const pool = poolFor(score);
  const choices = pool.filter((cmd) => cmd !== previous);
  const list = choices.length ? choices : pool;
  return list[Math.floor(Math.random() * list.length)];
};

// Screen readers skip punctuation at their default settings: name it ("deployment slash app")
const spoken = (cmd, symbols) =>
  [...cmd]
    .map((char) => (symbols[char] ? ` ${symbols[char]} ` : char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

/** Index of the first character that does not match the target, or -1 */
const firstTypo = (typed, target) => {
  for (let i = 0; i < typed.length; i += 1) {
    if (i >= target.length || typed[i] !== target[i]) return i;
  }
  return -1;
};

/** `inputRef` lets the terminal give focus back to the input (after a click on its log) */
const TerminalTyping = ({ t, onEnd, inputRef }) => {
  const [target, setTarget] = useState(() => nextCommand(0, null));
  const [typed, setTyped] = useState('');
  const [score, setScore] = useState(0);
  // Set on the first key: the clock does not run while the visitor reads the command
  const [deadline, setDeadline] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [bonuses, setBonuses] = useState(0);
  // Starts empty: text already in a live region when it mounts is often not read
  const [message, setMessage] = useState('');
  const announced = useRef(new Set());
  const ended = useRef(false);
  // The latest score, for the save on unmount
  const scoreRef = useRef(0);
  const targetId = useId();
  const inputId = useId();

  const remaining = deadline === null ? START_MS : Math.max(0, deadline - now);
  const seconds = Math.ceil(remaining / 1000);
  const typo = firstTypo(typed, target);
  const symbols = t('terminal.game.symbols');
  const say = (cmd) => spoken(cmd, symbols);
  const started = deadline !== null;

  const announceStart = useEffectEvent(() => {
    inputRef.current?.focus({ preventScroll: true });
    return window.setTimeout(
      () =>
        setMessage(
          t('terminal.game.sr.start', { ...typingChallenge, cmd: spoken(target, symbols) })
        ),
      150
    );
  });
  // Once, on mount
  useEffect(() => {
    const timer = announceStart();
    return () => window.clearTimeout(timer);
  }, []);

  // Re-announces a message even when it is the same as the last one
  const announce = (text) => {
    setMessage('');
    requestAnimationFrame(() => setMessage(text));
  };

  // Closing the terminal mid-run (Escape, the close button) still saves the score
  useEffect(
    () => () => {
      if (!ended.current) saveBest(gameStorage.typing, scoreRef.current);
    },
    []
  );

  const finish = useCallback(
    (reason) => {
      if (ended.current) return;
      ended.current = true;
      onEnd({ reason, score, ...saveBest(gameStorage.typing, score) });
    },
    [onEnd, score]
  );

  // The clock: a timestamp deadline, so a slow or throttled tab never gains time
  useEffect(() => {
    if (deadline === null) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [deadline]);

  // The clock stops while the page is hidden (another tab, a locked phone)
  useEffect(() => {
    if (!started) return undefined;
    let hiddenAt = null;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null) {
        const away = Date.now() - hiddenAt;
        hiddenAt = null;
        setDeadline((d) => d + away);
        setNow(Date.now());
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [started]);

  useEffect(() => {
    if (deadline === null || document.hidden) return;
    if (remaining === 0) {
      finish('timeUp');
      return;
    }
    if (LOW_SECONDS.includes(seconds) && !announced.current.has(seconds)) {
      announced.current.add(seconds);
      setMessage(t('terminal.game.sr.low', { seconds }));
    }
  }, [deadline, remaining, seconds, finish, t]);

  const onChange = (e) => {
    const value = e.target.value;
    // The clock only refreshes every 200 ms (less in a background tab): a command completed after
    // the deadline does not count, and the run ends here
    if (deadline !== null && clock() >= deadline) {
      finish('timeUp');
      return;
    }
    if (deadline === null && value) {
      setDeadline(clock() + START_MS);
      setNow(clock());
    }
    if (value === target) {
      const next = nextCommand(score + 1, target);
      scoreRef.current = score + 1;
      setScore(score + 1);
      setDeadline((d) => (d ?? clock() + START_MS) + BONUS_MS);
      setBonuses((n) => n + 1);
      setTarget(next);
      setTyped('');
      // The bonus may cross a low-time mark again later
      announced.current.clear();
      setMessage(t('terminal.game.sr.next', { cmd: say(next), bonus: typingChallenge.bonus }));
      return;
    }
    // Announced once, when the line goes from right to wrong
    const newTypo = firstTypo(value, target);
    if (newTypo !== -1 && typo === -1) {
      setMessage(t('terminal.game.sr.typo', { position: newTypo + 1 }));
    }
    setTyped(value);
  };

  const onKeyDown = (e) => {
    if (
      e.ctrlKey &&
      e.key.toLowerCase() === 'c' &&
      e.currentTarget.selectionStart === e.currentTarget.selectionEnd
    ) {
      e.preventDefault();
      finish('stopped');
    } else if (e.key === 'Enter') {
      // A correct command completes as soon as it matches; Enter says what is still wrong or left
      e.preventDefault();
      if (typo !== -1) announce(t('terminal.game.sr.typo', { position: typo + 1 }));
      else if (typed) announce(t('terminal.game.sr.left', { count: target.length - typed.length }));
    }
  };

  const percent = Math.min(100, (remaining / START_MS) * 100);

  return (
    <div className='border-t border-line px-3 pb-3 pt-2'>
      <div className='mb-2 flex flex-wrap items-center gap-x-4 gap-y-1'>
        <span className='font-semibold text-danger'>{t('terminal.game.alert')}</span>
        <span role='timer' className='font-semibold tabular-nums text-foreground'>
          {deadline === null ? t('terminal.game.waiting') : t('terminal.game.time', { seconds })}
        </span>
        <span className='tabular-nums text-foreground-muted'>
          {t('terminal.game.fixed', { score })}
        </span>
        {bonuses > 0 && (
          <span key={bonuses} aria-hidden='true' className='font-semibold text-success'>
            {t('terminal.game.bonus', { bonus: typingChallenge.bonus })}
          </span>
        )}
      </div>
      <div aria-hidden='true' className='mb-3 h-1.5 overflow-hidden rounded-full bg-surface-raised'>
        <div
          className={`h-full rounded-full ${seconds <= 5 ? 'bg-danger' : 'bg-primary'}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <p id={targetId} className='mb-1 text-base'>
        <span className='sr-only'>{`${t('terminal.game.target')}: ${say(target)}`}</span>
        {/* Typed characters: green when right, red and struck through when wrong (not color
            alone), the next one on an orange block like a caret */}
        <span aria-hidden='true' className='whitespace-pre-wrap break-all'>
          {[...target].map((char, i) => {
            let tone = 'text-foreground-muted';
            if (i < typed.length) {
              tone =
                typed[i] === char
                  ? 'text-success'
                  : 'rounded-xs bg-danger/10 text-danger line-through decoration-2';
            } else if (i === typed.length) {
              tone = 'rounded-xs bg-primary/20 text-foreground';
            }
            return (
              <span key={i} className={tone}>
                {char}
              </span>
            );
          })}
          {typed.length > target.length && (
            <span className='text-danger line-through'>{typed.slice(target.length)}</span>
          )}
        </span>
      </p>
      <div className='mb-2 flex items-center gap-3'>
        <p className={`flex-1 text-sm ${typo === -1 ? 'text-foreground-muted' : 'text-danger'}`}>
          {typo === -1 ? t('terminal.game.quitHint') : t('terminal.game.typo')}
        </p>
        {/* Ctrl+C has no key on a phone: a visible way out */}
        <button
          type='button'
          onClick={() => finish('stopped')}
          className='shrink-0 rounded-lg border border-line-strong px-3 py-1.5 text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground'
        >
          {t('terminal.game.stop')}
        </button>
      </div>

      <div className='flex items-center gap-2 rounded-lg px-2 py-1.5 text-base -outline-offset-2 outline-focus focus-within:outline-2 md:text-sm'>
        <Prompt t={t} />
        <label htmlFor={inputId} className='sr-only'>
          {t('terminal.game.inputLabel')}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type='text'
          value={typed}
          onChange={onChange}
          onKeyDown={onKeyDown}
          // The commands are to be typed, not pasted or dropped in
          onPaste={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
          aria-describedby={targetId}
          maxLength={80}
          autoComplete='off'
          autoCapitalize='none'
          autoCorrect='off'
          spellCheck={false}
          enterKeyHint='done'
          className='min-w-0 flex-1 bg-transparent text-foreground caret-primary outline-hidden focus-visible:outline-hidden'
        />
      </div>

      {/* Start, each fixed command, the 10 s and 5 s marks and the first typo, politely */}
      <p role='status' className='sr-only'>
        {message}
      </p>
    </div>
  );
};

export default TerminalTyping;
