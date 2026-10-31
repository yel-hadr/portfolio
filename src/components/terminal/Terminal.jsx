import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { m } from 'framer-motion';

import { useLiveRef } from '../../hooks/useLiveRef';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { useI18n } from '../../i18n/context';
import { registerNamespace } from '../../i18n/dictionaries';
import en from '../../locales/en/terminal.json';
import fr from '../../locales/fr/terminal.json';
import { useTheme } from '../../theme/context';
import TerminalTyping from '../Games/TerminalTyping';
import { CloseIcon } from '../icons';
import { complete, findCommand, suggestCommand } from './commands';
import { Block, Cmd, ErrorLine, Muted, Prompt, PromptLine, Rich, Welcome } from './output';

// The terminal strings ship with this lazy chunk, not the page: register them as soon as the
// module is evaluated, before any component below renders
registerNamespace('terminal', { en, fr });

// Older output is dropped past this many entries, so a long session stays light
const MAX_ENTRIES = 300;
// One-tap commands, mostly for phones where typing is slow
const QUICK_COMMANDS = ['help', 'whoami', 'projects', 'skills', 'resume', 'game'];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled])';

// Kept for the whole visit, so ↑ still recalls earlier commands after the terminal reopens
const saved = { history: [] };
let nextId = 0;
const entry = (node) => ({ id: nextId++, node });

// On phones the on-screen keyboard shrinks the visual viewport but not the layout viewport:
// size the overlay to the visible area so the prompt stays above the keyboard.
const useVisibleViewport = () => {
  const [box, setBox] = useState(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    // Pinch zoom also shrinks it; keep the plain full-screen overlay then
    const update = () =>
      setBox(Math.abs(vv.scale - 1) < 0.01 ? { top: vv.offsetTop, height: vv.height } : null);
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return box;
};

/**
 * Terminal overlay: a modal dialog where visitors type commands (help, projects, resume...) to
 * explore the portfolio. App renders it only while open; `onClose` closes it and restores focus.
 * `initialCommand` runs once on open (the games menu opens it on `game`).
 */
const Terminal = ({ onClose, initialCommand = null }) => {
  const { lang, setLang, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const reduced = usePrefersReducedMotion();
  const viewport = useVisibleViewport();

  const [entries, setEntries] = useState(() => [entry(<Welcome t={t} />)]);
  const [value, setValue] = useState('');
  const [history, setHistory] = useState(saved.history);
  // The terminal challenge replaces the prompt line while it runs
  const [playing, setPlaying] = useState(false);
  // Position while browsing history with ↑/↓ (null: editing a new line) and the line in progress
  const browse = useRef({ index: null, draft: '' });
  // The first entry of the latest command: the log scrolls so it stays in view
  const scrollAnchor = useRef(null);

  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const logRef = useRef(null);
  const inputRef = useRef(null);
  const gameInputRef = useRef(null);
  const pressedBackdrop = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();

  // The prompt takes focus on open and again when the challenge ends
  useEffect(() => {
    if (!playing) inputRef.current?.focus();
  }, [playing]);

  // The page behind must not scroll (the stable gutter avoids a layout shift) and is inert, like
  // behind the other dialogs: no Tab, click or screen reader reaches it while the terminal is open
  useEffect(() => {
    const root = document.documentElement;
    const { overflow, scrollbarGutter } = root.style;
    root.style.scrollbarGutter = 'stable';
    root.style.overflow = 'hidden';
    const madeInert = [...document.body.children].filter(
      (el) => el !== overlayRef.current && !el.inert && el.tagName !== 'SCRIPT'
    );
    madeInert.forEach((el) => (el.inert = true));
    return () => {
      root.style.overflow = overflow;
      root.style.scrollbarGutter = scrollbarGutter;
      madeInert.forEach((el) => (el.inert = false));
    };
  }, []);

  // Show the new output from its prompt line down, keeping that line in view when the output
  // is taller than the log
  useLayoutEffect(() => {
    const log = logRef.current;
    if (!log) return;
    const bottom = log.scrollHeight - log.clientHeight;
    const anchor = log.querySelector(`[data-entry="${scrollAnchor.current}"]`);
    log.scrollTop = anchor ? Math.min(bottom, anchor.offsetTop - 12) : bottom;
  }, [entries]);

  const print = useCallback((...nodes) => {
    const added = nodes.filter(Boolean).map(entry);
    if (added.length === 0) return;
    scrollAnchor.current = added[0].id;
    setEntries((prev) => [...prev, ...added].slice(-MAX_ENTRIES));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  const run = (line) => {
    const trimmed = line.trim();
    const echo = <PromptLine t={t} text={line} />;
    browse.current = { index: null, draft: '' };
    if (!trimmed) {
      print(echo);
      return;
    }

    const nextHistory = history[history.length - 1] === trimmed ? history : [...history, trimmed];
    const kept = nextHistory.slice(-100);
    setHistory(kept);

    const [word, ...args] = trimmed.split(/\s+/);
    const rest = trimmed.slice(word.length).trim();
    const command = findCommand(word);

    if (!command) {
      const suggestion = suggestCommand(word);
      print(
        echo,
        <Block>
          <ErrorLine>{t('terminal.notFound', { cmd: word })}</ErrorLine>
          {suggestion && (
            <p>
              <Rich text={t('terminal.didYouMean')} values={{ cmd: <Cmd>{suggestion}</Cmd> }} />
            </p>
          )}
          <Muted>
            <Rich text={t('terminal.helpHint')} values={{ cmd: <Cmd>help</Cmd> }} />
          </Muted>
        </Block>
      );
      return;
    }
    if (command.name === 'clear') {
      clear();
      return;
    }
    print(echo, command.run({ args, rest }, context(kept)));
  };

  // Kept for the next time the terminal opens
  useEffect(() => {
    saved.history = history;
  }, [history]);

  // What every command gets as its second argument (`kept`: the history with this command in it)
  const context = (kept = history) => ({
    t,
    lang,
    setLang,
    theme,
    setTheme,
    history: kept,
    close: onClose,
    reduced,
    startGame: () => setPlaying(true),
  });

  // The opening command runs once (StrictMode runs effects twice in development), without an
  // echo or a history entry: the visitor did not type it
  const ranInitial = useRef(false);
  const runInitial = useEffectEvent(() => {
    const command = initialCommand && findCommand(initialCommand);
    if (command) print(command.run({ args: [], rest: '' }, context()));
  });
  useEffect(() => {
    if (ranInitial.current) return;
    ranInitial.current = true;
    runInitial();
  }, []);

  const endGame = useCallback(
    ({ reason, score, best, newBest }) => {
      setPlaying(false);
      print(
        <Block>
          {reason === 'timeUp' ? (
            <ErrorLine>{t('terminal.game.timeUp')}</ErrorLine>
          ) : (
            <Muted>{t('terminal.game.stopped')}</Muted>
          )}
          <p>{t('terminal.game.result', { score, best })}</p>
          {newBest && <p className='text-success'>{t('terminal.game.newBest')}</p>}
          <Muted>
            <Rich text={t('terminal.game.again')} values={{ cmd: <Cmd>game</Cmd> }} />
          </Muted>
        </Block>
      );
    },
    [print, t]
  );

  const recall = (step) => {
    if (history.length === 0) return;
    const state = browse.current;
    let index;
    if (state.index === null) {
      if (step > 0) return;
      state.draft = value;
      index = history.length - 1;
    } else {
      index = state.index + step;
    }
    if (index < 0) index = 0;
    if (index >= history.length) {
      state.index = null;
      setValue(state.draft);
      return;
    }
    state.index = index;
    setValue(history[index]);
  };

  // Keep the caret at the end after ↑/↓ or completion replace the line
  useEffect(() => {
    const input = inputRef.current;
    if (input && document.activeElement === input) {
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, [value]);

  const onInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      run(value);
      setValue('');
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      recall(e.key === 'ArrowUp' ? -1 : 1);
    } else if (e.key === 'Tab' && !e.shiftKey && value.trim()) {
      // Completes when there is something to complete; otherwise Tab moves focus as usual
      const result = complete(value);
      if (result.matches.length === 0) return;
      e.preventDefault();
      if (result.value !== value) {
        setValue(result.value);
      } else if (result.matches.length > 1) {
        print(
          <PromptLine t={t} text={value} />,
          <Block>
            <Muted>{t('terminal.completions')}</Muted>
            <p className='flex flex-wrap gap-x-4'>
              {result.matches.map((match) => (
                <Cmd key={match}>{match}</Cmd>
              ))}
            </p>
          </Block>
        );
      }
    } else if (e.ctrlKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      clear();
    } else if (
      e.ctrlKey &&
      e.key.toLowerCase() === 'c' &&
      e.currentTarget.selectionStart === e.currentTarget.selectionEnd
    ) {
      // Ctrl+C with nothing selected abandons the line, as in a shell (with a selection: copy)
      e.preventDefault();
      print(
        <p className='flex flex-wrap gap-x-2'>
          <Prompt t={t} />
          <span className='whitespace-pre-wrap break-all'>{value}</span>
          <span className='text-foreground-muted'>{t('terminal.interrupted')}</span>
        </p>
      );
      setValue('');
      browse.current = { index: null, draft: '' };
    }
  };

  // Escape closes; Tab cycles inside the dialog
  const onDialogKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || e.defaultPrevented) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = [...dialog.querySelectorAll(FOCUSABLE)];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    // Focus on the dialog itself (after a click on its title or an empty area) counts as
    // outside the cycle: Tab enters at the start, Shift+Tab at the end
    const outside = active === dialog || !dialog.contains(active);
    if (e.shiftKey && (outside || active === first)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (outside || active === last)) {
      e.preventDefault();
      first.focus();
    }
  };

  // A click on the log (not a link, not a text selection) puts the caret back in the prompt, or
  // in the challenge's input while it runs
  const onLogClick = (e) => {
    if (e.target.closest('a, button')) return;
    if (window.getSelection()?.toString()) return;
    (playing ? gameInputRef : inputRef).current?.focus({ preventScroll: true });
  };

  // A quick command types itself into the prompt, a key at a time with a slightly uneven rhythm
  // (45 to 115 ms), then runs: it reads as typed, not pasted. At once under reduced motion; a key
  // the visitor presses meanwhile takes over (onChange cancels it). The run is read through a ref,
  // so a command that lands after a re-render runs with the latest history
  const typing = useRef(0);
  const runLatest = useLiveRef(run);
  useEffect(() => () => clearTimeout(typing.current), []);
  const runQuick = (name) => {
    clearTimeout(typing.current);
    inputRef.current?.focus({ preventScroll: true });
    if (reduced) {
      runLatest.current(name);
      return;
    }
    let typed = 0;
    const key = () => {
      typed += 1;
      setValue(name.slice(0, typed));
      if (typed < name.length) {
        typing.current = setTimeout(key, 45 + Math.random() * 70);
        return;
      }
      typing.current = setTimeout(() => {
        setValue('');
        runLatest.current(name);
      }, 160);
    };
    setValue('');
    typing.current = setTimeout(key, 60);
  };

  const fade = reduced ? false : { opacity: 0 };
  const rise = reduced ? false : { opacity: 0, y: 12, scale: 0.985 };

  // Rendered into <body>, beside the page, so the page can be made inert without the terminal
  return createPortal(
    <m.div
      ref={overlayRef}
      initial={fade}
      animate={{ opacity: 1 }}
      // The backdrop dims and blurs in over 200 ms, as behind every dialog
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={viewport ? { top: viewport.top, height: viewport.height, bottom: 'auto' } : undefined}
      className='fixed inset-0 z-[60] flex bg-background/80 backdrop-blur-sm md:items-center md:justify-center md:p-6'
      // Backdrop click closes (only reachable on larger screens; phones are full screen). The
      // press must start on the backdrop too, so a text selection dragged out does not close it.
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) onClose();
      }}
    >
      <m.div
        ref={dialogRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        initial={rise}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        // Focusable by script and by click (not by Tab), so a click on a non-interactive part
        // keeps focus inside the dialog and Escape and the Tab cycle keep working
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
        className='flex h-full w-full flex-col overflow-hidden bg-glass-strong font-mono text-sm text-foreground backdrop-blur-md md:h-[min(44rem,85vh)] md:max-w-4xl md:rounded-2xl md:border md:border-line-strong md:shadow-modal outline-hidden'
      >
        {/* Title bar */}
        <div className='flex items-center gap-3 border-b border-line bg-surface-raised/60 py-1.5 pl-4 pr-1.5'>
          <span aria-hidden='true' className='flex gap-1.5'>
            <span className='h-3 w-3 rounded-full bg-danger' />
            <span className='h-3 w-3 rounded-full bg-primary' />
            <span className='h-3 w-3 rounded-full bg-success' />
          </span>
          <h2
            id={titleId}
            className='min-w-0 flex-1 truncate text-center font-semibold text-foreground-muted'
          >
            <span className='sr-only'>{t('terminal.name')}, </span>
            {t('terminal.title')}
          </h2>
          <button
            type='button'
            onClick={onClose}
            aria-label={t('terminal.close')}
            title={t('terminal.close')}
            className='inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground'
          >
            <CloseIcon />
          </button>
        </div>
        <p id={descriptionId} className='sr-only'>
          {t('terminal.description')}
        </p>

        {/* The screen stays dark in either theme (scheme-dark: every token takes its dark value
            inside); the window's frame and title bar follow the page */}
        <div className="scheme-dark flex min-h-0 flex-1 flex-col text-foreground [:root[data-theme='light']_&]:bg-background/95">
          {/* Output: only ever appended to (or cleared on request), announced politely. The click
            handler is a mouse convenience only; the input is always reachable by keyboard. */}
          <div
            ref={logRef}
            role='log'
            aria-live='polite'
            onClick={onLogClick}
            className='relative flex-1 overflow-y-auto overscroll-contain break-words px-4 py-3 leading-relaxed'
          >
            {entries.map(({ id, node }) => (
              <div key={id} data-entry={id}>
                {node}
              </div>
            ))}
          </div>

          {playing ? (
            <TerminalTyping t={t} onEnd={endGame} inputRef={gameInputRef} />
          ) : (
            <div className='border-t border-line px-3 pb-3 pt-2'>
              <div
                role='group'
                aria-label={t('terminal.suggestions')}
                className='mb-2 flex flex-wrap gap-1'
              >
                {QUICK_COMMANDS.map((name) => (
                  <button
                    key={name}
                    type='button'
                    onClick={() => runQuick(name)}
                    className='rounded-lg border border-line-strong px-2 py-1 text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground'
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className='flex items-center gap-2 rounded-lg px-2 py-1.5 text-base -outline-offset-2 outline-focus focus-within:outline-2 md:text-sm'>
                <Prompt t={t} />
                <label htmlFor={inputId} className='sr-only'>
                  {t('terminal.inputLabel')}
                </label>
                <input
                  ref={inputRef}
                  id={inputId}
                  type='text'
                  value={value}
                  onChange={(e) => {
                    clearTimeout(typing.current);
                    setValue(e.target.value);
                    browse.current.index = null;
                  }}
                  onKeyDown={onInputKeyDown}
                  aria-describedby={descriptionId}
                  autoComplete='off'
                  autoCapitalize='none'
                  autoCorrect='off'
                  spellCheck={false}
                  enterKeyHint='send'
                  className='min-w-0 flex-1 bg-transparent text-foreground caret-primary [caret-shape:block] outline-hidden focus-visible:outline-hidden'
                />
              </div>
            </div>
          )}
        </div>
      </m.div>
    </m.div>,
    document.body
  );
};

export default Terminal;
