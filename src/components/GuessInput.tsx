import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CHARACTERS, CHARACTER_BY_ID } from '../data/characters';
import { Avatar } from './Avatar';

interface Props {
  exclude: string[];
  disabled?: boolean;
  onGuess: (id: string) => void;
}

/**
 * Pick a character instead of typing one: a button opens a scrollable list,
 * tapping one selects it, and Guess submits. No text box means no on-screen
 * keyboard (or iOS autofill bar) on phones.
 */
export function GuessInput({ exclude, disabled, onGuess }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const options = useMemo(() => CHARACTERS.filter((c) => !exclude.includes(c.id)), [exclude]);
  const chosen = selected ? CHARACTER_BY_ID.get(selected) : undefined;

  // Close when tapping anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Keep the highlighted option in view while using the arrow keys.
  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function openList() {
    if (disabled) return;
    setActive(Math.max(0, options.findIndex((c) => c.id === selected)));
    setOpen(true);
    // Make sure the whole list is on screen (clear of the phone tab bar; see scroll-margin in CSS).
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }

  function choose(id: string) {
    setSelected(id);
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }

  function submit() {
    if (!selected || disabled) return;
    onGuess(selected);
    setSelected(null);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        openList();
      }
      return;
    }
    const move = (d: number) => {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, Math.max(0, a + d)));
    };
    if (e.key === 'ArrowDown') move(1);
    else if (e.key === 'ArrowUp') move(-1);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (options[active]) choose(options[active].id);
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (/^[a-z]$/i.test(e.key)) {
      // Type a letter to jump to the next character starting with it.
      const k = e.key.toLowerCase();
      const n = options.length;
      for (let i = 1; i <= n; i++) {
        const idx = (active + i) % n;
        if (options[idx].name.toLowerCase().startsWith(k)) {
          setActive(idx);
          break;
        }
      }
    }
  }

  return (
    <div className="guess-input" ref={rootRef}>
      <div className="guess-row">
        <button
          ref={triggerRef}
          type="button"
          className={`picker-trigger ${chosen ? 'has-value' : ''}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls="guess-options"
          aria-activedescendant={open && options[active] ? `opt-${options[active].id}` : undefined}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={onKeyDown}
        >
          {chosen ? (
            <>
              <Avatar character={chosen} />
              <span className="picker-label">{chosen.name}</span>
            </>
          ) : (
            <span className="picker-label placeholder">Choose who said it</span>
          )}
          <span className="picker-caret" aria-hidden="true">
            ▾
          </span>
        </button>
        <button className="btn primary" disabled={disabled || !selected} onClick={submit}>
          Guess
        </button>
      </div>
      {open && !disabled && (
        <ul id="guess-options" role="listbox" aria-label="Characters" className="options picker-list" ref={listRef}>
          {options.map((c, i) => (
            <li
              key={c.id}
              id={`opt-${c.id}`}
              role="option"
              aria-selected={c.id === selected}
              className={`${i === active ? 'active' : ''} ${c.id === selected ? 'selected' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(c.id)}
            >
              <Avatar character={c} />
              <span>{c.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
