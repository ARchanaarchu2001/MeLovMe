"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

// Brand-styled dropdown (the native <select> popup can't be themed).
// Submits its value through a hidden input, so it works inside a normal <form>.
export default function Select({
  name,
  options,
  defaultValue = options[0],
}: {
  name: string;
  options: string[];
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(options.indexOf(defaultValue));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function choose(i: number) {
    setValue(options[i]);
    setHighlight(i);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setHighlight((h) => (h + step + options.length) % options.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) choose(highlight);
      else setOpen(true);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${name}-listbox`}
        onClick={() => setOpen(!open)}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between rounded-xl border bg-transparent px-4 py-3 text-left text-sm text-ivory outline-none transition-colors ${
          open ? "border-gold" : "border-ivory/20 focus:border-gold"
        }`}
      >
        {value}
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 text-gold transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <ul
        id={`${name}-listbox`}
        role="listbox"
        className={`absolute left-0 right-0 top-full z-20 mt-2 origin-top overflow-hidden rounded-xl border border-gold/40 bg-espresso py-1.5 shadow-2xl shadow-black/40 transition-all duration-200 ${
          open ? "visible scale-100 opacity-100" : "invisible scale-95 opacity-0"
        }`}
      >
        {options.map((opt, i) => (
          <li
            key={opt}
            role="option"
            aria-selected={opt === value}
            onMouseEnter={() => setHighlight(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(i)}
            className={`flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm transition-colors ${
              i === highlight ? "bg-chocolate text-gold" : "text-ivory/85"
            }`}
          >
            {opt}
            {opt === value && (
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-gold" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="m5 12 5 5 9-10" />
              </svg>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
