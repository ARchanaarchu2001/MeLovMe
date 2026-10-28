"use client";

import { useId, useState, type KeyboardEvent } from "react";

// Text box for a product's category with a list of the categories already in use. Typing filters
// the list; a name that isn't in it is offered as a new category.
export default function CategoryPicker({ value, options, onChange, invalid, maxLength, className }: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  invalid?: boolean;
  maxLength?: number;
  className: string; // the form's input style
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const typed = value.trim();
  const matches = options.filter((o) => o.toLowerCase().includes(typed.toLowerCase()));
  const isNew = typed !== "" && !options.some((o) => o.toLowerCase() === typed.toLowerCase());
  // What the list shows: matching categories, then "Add …" for a new one
  const items = [...matches.map((o) => ({ value: o, isNew: false })), ...(isNew ? [{ value: typed, isNew: true }] : [])];
  const show = open && items.length > 0;

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    setActive(-1);
  };

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (items.length ? (i + step + items.length) % items.length : -1));
    } else if (e.key === "Enter" && show && active >= 0) {
      e.preventDefault();
      choose(items[active].value);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKey}
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid}
        maxLength={maxLength}
        autoComplete="off"
        placeholder="Body Care"
        className={`${className} pr-10`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Show categories"
        // Keep focus in the box, so the list doesn't close and reopen
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-chocolate/50 hover:text-gold"
      >
        <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${show ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {show && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-60 overflow-auto rounded-xl border border-chocolate/15 bg-cream p-1.5 shadow-lg"
        >
          {items.map((item, i) => {
            const selected = !item.isNew && item.value.toLowerCase() === typed.toLowerCase();
            return (
              <li
                key={`${item.isNew}-${item.value}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={selected}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(item.value)}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                  i === active ? "bg-gold/15 text-chocolate" : "text-chocolate/80"
                } ${item.isNew ? "mt-1 border-t border-chocolate/10 text-gold" : ""}`}
              >
                {item.isNew ? (
                  <span className="truncate">+ Add “{item.value}”</span>
                ) : (
                  <>
                    <span className="truncate">{item.value}</span>
                    {selected && (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-gold" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m5 12 5 5 9-10" />
                      </svg>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
