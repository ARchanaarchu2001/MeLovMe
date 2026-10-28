"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type ProductOption = { slug: string; name: string; image?: string; count?: number };

// A product picker that stays one line however many products there are: a button that opens a
// searchable list. `allLabel` adds a first "All products" choice (value "") for filters.
export default function ProductSelect({ products, value, onChange, allLabel, placeholder = "Choose a product", invalid, className = "" }: {
  products: ProductOption[];
  value: string;
  onChange: (slug: string) => void;
  allLabel?: string;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
}) {
  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const selected = products.find((p) => p.slug === value);
  const typed = q.trim().toLowerCase();
  const options: ProductOption[] = [
    ...(allLabel && !typed ? [{ slug: "", name: allLabel }] : []),
    ...products.filter((p) => p.name.toLowerCase().includes(typed)),
  ];

  // Close on a click anywhere else
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const show = () => {
    setQ("");
    setActive(Math.max(0, [...(allLabel ? [""] : []), ...products.map((p) => p.slug)].indexOf(value)));
    setOpen(true);
    requestAnimationFrame(() => search.current?.focus());
  };
  const choose = (slug: string) => {
    setOpen(false);
    if (slug !== value) onChange(slug);
  };

  function handleKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (options.length ? (i + step + options.length) % options.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[active]) choose(options[active].slug);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrap} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : show())}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-full border bg-white/60 py-2 pl-2 pr-4 text-left text-sm outline-none transition-colors hover:border-gold focus-visible:border-gold ${
          invalid ? "border-red-700" : "border-chocolate/20"
        }`}
      >
        <Thumb image={selected?.image} />
        <span className={`min-w-0 flex-1 truncate ${selected || allLabel ? "" : "text-chocolate/50"}`}>
          {selected?.name ?? allLabel ?? placeholder}
        </span>
        <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-chocolate/50 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-full min-w-[16rem] overflow-hidden rounded-2xl border border-chocolate/15 bg-cream shadow-[0_16px_40px_-16px_rgba(46,26,17,0.45)]">
          <div className="border-b border-chocolate/10 p-2">
            <input
              ref={search}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={handleKey}
              role="combobox"
              aria-controls={listId}
              aria-expanded
              aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
              placeholder="Search products…"
              autoComplete="off"
              className="w-full rounded-full border border-chocolate/15 bg-white/70 px-4 py-2 text-sm outline-none focus:border-gold"
            />
          </div>
          <ul id={listId} role="listbox" className="max-h-72 overflow-auto p-1.5">
            {options.length === 0 && <li className="px-3 py-6 text-center text-sm text-chocolate/50">No products match “{q.trim()}”.</li>}
            {options.map((p, i) => {
              const isSelected = p.slug === value;
              return (
                <li
                  key={p.slug || "all"}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => choose(p.slug)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm ${i === active ? "bg-gold/15" : ""} ${
                    !p.slug && options.length > 1 ? "mb-1 border-b border-chocolate/10 pb-2" : ""
                  }`}
                >
                  <Thumb image={p.image} all={!p.slug} />
                  <span className={`min-w-0 flex-1 truncate ${isSelected ? "font-medium text-chocolate" : "text-chocolate/80"}`}>{p.name}</span>
                  {p.count !== undefined && <span className="shrink-0 text-xs tabular-nums text-chocolate/50">{p.count}</span>}
                  {isSelected && (
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-gold" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 12 5 5 9-10" />
                    </svg>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// Small round product photo (or a grid icon for "All products")
function Thumb({ image, all }: { image?: string; all?: boolean }) {
  return (
    <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ivory text-chocolate/50">
      {image ? (
        <Image src={image} alt="" fill sizes="28px" className="object-cover" />
      ) : (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
          {all ? <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /> : <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Zm0 0v18M4 7.5l8 4.5 8-4.5" />}
        </svg>
      )}
    </span>
  );
}
