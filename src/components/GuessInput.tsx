import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CHARACTERS, type Character } from '../data/characters';
import { Avatar } from './Avatar';

interface Props {
  exclude: string[];
  disabled?: boolean;
  onGuess: (id: string) => void;
}

export function GuessInput({ exclude, disabled, onGuess }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState<number | undefined>();

  // Keep the suggestion list above the on-screen keyboard: size it to the
  // part of the screen that's still visible below the input.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    const fit = () => {
      const row = rowRef.current;
      if (!row || !vv) return;
      const visibleBottom = vv.offsetTop + vv.height;
      setListHeight(Math.max(140, Math.min(300, visibleBottom - row.getBoundingClientRect().bottom - 16)));
    };
    fit();
    vv?.addEventListener('resize', fit);
    vv?.addEventListener('scroll', fit);
    window.addEventListener('scroll', fit, { passive: true });
    return () => {
      vv?.removeEventListener('resize', fit);
      vv?.removeEventListener('scroll', fit);
      window.removeEventListener('scroll', fit);
    };
  }, [open]);

  // On phones, once the keyboard is up, scroll so the quote sits at the top of
  // the screen with the input and suggestions right under it.
  function bringIntoView() {
    if (!matchMedia('(max-width: 600px) and (pointer: coarse)').matches) return;
    setTimeout(() => {
      const card = document.querySelector('.quote-card');
      if (!card) return;
      const top = card.getBoundingClientRect().top + window.scrollY - 30; // room for the quote mark
      window.scrollTo({ top, behavior: 'smooth' });
    }, 350);
  }

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const available = CHARACTERS.filter((c) => !exclude.includes(c.id));
    if (!q) return available;
    return available
      .filter((c) => c.name.toLowerCase().includes(q))
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)));
  }, [query, exclude]);

  function submit(c: Character | undefined) {
    if (!c) return;
    onGuess(c.id);
    setQuery('');
    setActive(0);
    setOpen(false);
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open || query) submit(options[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="guess-input">
      <div className="guess-row" ref={rowRef}>
        <input
          ref={inputRef}
          type="text"
          name="bbd-character"
          enterKeyHint="go"
          autoComplete="off"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          aria-controls="guess-options"
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `opt-${options[active].id}` : undefined}
          aria-label="Who said it?"
          placeholder="Who said it? Start typing…"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            bringIntoView();
          }}
          onClick={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
        <button className="btn primary" disabled={disabled || !options.length} onClick={() => submit(options[active])}>
          Guess
        </button>
      </div>
      {open && !disabled && options.length > 0 && (
        <ul id="guess-options" role="listbox" className="options" style={{ maxHeight: listHeight }}>
          {options.map((c, i) => (
            <li
              key={c.id}
              id={`opt-${c.id}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                submit(c);
              }}
            >
              <Avatar character={c} />
              {c.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
