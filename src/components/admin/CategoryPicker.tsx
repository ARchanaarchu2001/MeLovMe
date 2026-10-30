"use client";

import Link from "next/link";
import { useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { saveCategory } from "@/app/actions/admin";
import Spinner from "@/components/Spinner";
import {
  categoryKey,
  categoryLabel,
  categoryLimits,
  categoryNameError,
  childrenOf,
  flatTree,
  matchScore,
  pathOf,
  tidyCategoryName,
  type Category,
} from "@/lib/category";

type AddOption = { name: string; parent: Category | null };

// The product's category, as a cascading menu: the main categories, and hovering one with
// sub-categories opens them in a column beside it (as deep as the tree goes). A click on any
// category chooses it (a product can be in any level); on touch screens, where there's no hover,
// the first tap opens the sub-categories and the second chooses. Typing searches every level, and
// a name that isn't there can be added as a new category.
export default function CategoryPicker({ categories, value, onChange, onCreated, invalid, className }: {
  categories: Category[];
  value: string; // the chosen category's id
  onChange: (id: string) => void;
  onCreated: (category: Category) => void; // a category added from here
  invalid?: boolean;
  className: string; // the form's input style
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  // What's typed in the box; null until the person starts typing (the box shows the chosen category)
  const [query, setQuery] = useState<string | null>(null);
  // When a choice last closed the menu: clicks right after it don't reopen it
  const [closedAt, setClosedAt] = useState(0);
  // The categories whose sub-categories are open, from the main one down
  const [trail, setTrail] = useState<string[]>([]);
  // The highlighted row: column and row in the menu, or the row in the search results
  const [active, setActive] = useState<{ col: number; row: number } | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const typed = tidyCategoryName(query ?? "");
  const columns = [null, ...trail].map((parentId) => childrenOf(categories, parentId)).filter((col) => col.length > 0);

  // Search: every category whose name matches, then "Add …" under the last opened category
  // and/or as a main category, when there isn't one by that name there already
  const parentForNew = categories.find((c) => c.id === trail.at(-1)) ?? null;
  const isNewUnder = (parent: Category | null) =>
    typed !== "" && !childrenOf(categories, parent?.id ?? null).some((c) => categoryKey(c.name) === categoryKey(typed));
  // Exact matches first, then near misses (typos), each in tree order
  const found = typed
    ? flatTree(categories)
        .map((c) => ({ c, score: matchScore(c.name, typed) }))
        .filter((m): m is { c: (typeof m)["c"]; score: number } => m.score !== null)
        .sort((a, b) => a.score - b.score)
        .map((m) => m.c)
    : [];
  const adds: AddOption[] = [
    ...(parentForNew && isNewUnder(parentForNew) ? [{ name: typed, parent: parentForNew }] : []),
    ...(isNewUnder(null) ? [{ name: typed, parent: null }] : []),
  ];
  const results: (Category | AddOption)[] = [...found, ...adds];

  function openList() {
    if (open || Date.now() - closedAt < 400) return;
    setOpen(true);
    setQuery(null);
    // Highlight the chosen category's text (after the click that opened it has placed the caret)
    requestAnimationFrame(() => inputRef.current?.select());
    setError("");
    setActive(null);
    // Open the menu down to the chosen category, so it's in view
    setTrail(pathOf(categories, value).slice(0, -1).map((c) => c.id));
  }

  function select(id: string) {
    onChange(id);
    setOpen(false);
    setQuery(null);
    setClosedAt(Date.now());
  }

  // Open the sub-categories of the category in column `col` (or close deeper ones for one without)
  // Hovering one that's already open keeps the columns beyond it, so passing over Body Care on the
  // way in doesn't close the path down to the chosen category.
  function reveal(col: number, c: Category) {
    setTrail((t) => (t[col] === c.id ? t : [...t.slice(0, col), ...(childrenOf(categories, c.id).length ? [c.id] : [])]));
  }

  function add({ name, parent }: AddOption) {
    const nameError = categoryNameError(name);
    if (nameError) return setError(nameError);
    startTransition(async () => {
      const res = await saveCategory(null, { name, parentId: parent?.id ?? null });
      if ("error" in res) return setError(res.error);
      onCreated(res.category);
      select(res.category.id);
    });
  }

  function chooseResult(r: Category | AddOption) {
    if ("id" in r) select(r.id);
    else add(r);
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") return setOpen(false);
    if (!open) {
      if (e.key === "ArrowDown") openList();
      return;
    }
    if (typed) {
      // A single list
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        const row = active ? (active.row + step + results.length) % results.length : step > 0 ? 0 : results.length - 1;
        setActive(results.length ? { col: 0, row } : null);
      } else if (e.key === "Enter") {
        e.preventDefault(); // never submits the product form from here
        const r = results[active?.row ?? (results.length === 1 ? 0 : -1)];
        if (r) chooseResult(r);
      }
      return;
    }
    // The columns: up/down within one, right opens sub-categories, left goes back
    const col = active?.col ?? 0;
    const items = columns[col] ?? [];
    const current = active ? items[active.row] : undefined;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      const row = active ? (active.row + step + items.length) % items.length : 0;
      setActive({ col, row });
      if (items[row]) reveal(col, items[row]);
    } else if (e.key === "ArrowRight" && current && columns[col + 1] && trail[col] === current.id) {
      e.preventDefault();
      setActive({ col: col + 1, row: 0 });
      reveal(col + 1, columns[col + 1][0]);
    } else if (e.key === "ArrowLeft" && col > 0) {
      e.preventDefault();
      setActive({ col: col - 1, row: columns[col - 1].findIndex((c) => c.id === trail[col - 1]) });
      setTrail((t) => t.slice(0, col));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (current) select(current.id);
    }
  }

  // Clicks inside the menu keep the focus in the box, so it stays open
  const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();
  // Whether the last press was a finger (no hover on touch screens)
  const touch = useRef(false);
  const optionId = (col: number, row: number) => `${listId}-${col}-${row}`;
  const row = "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors";
  // Row colours: the row under the pointer and the opened path share one highlight; the chosen category is in gold
  const tone = (opened: boolean, hovered: boolean, chosen: boolean) =>
    `${opened || hovered ? "bg-chocolate text-ivory" : "text-chocolate/80"} ${chosen ? "font-medium !text-gold" : ""}`;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={query ?? categoryLabel(categories, value)}
        onChange={(e) => {
          // The first key starts a new search: what was typed replaces the chosen category's text,
          // wherever the caret was in it (Backspace on it clears it)
          const v = e.target.value;
          const shown = categoryLabel(categories, value);
          let next = v;
          if (query === null && shown) {
            const deleting = (e.nativeEvent as InputEvent).inputType?.startsWith("delete");
            if (deleting) next = "";
            else if (v.startsWith(shown)) next = v.slice(shown.length);
            else if (v.endsWith(shown)) next = v.slice(0, v.length - shown.length);
          }
          setQuery(next);
          // The best match is highlighted, so Enter picks it
          setActive(next.trim() ? { col: 0, row: 0 } : null);
          setError("");
          setOpen(true);
        }}
        onFocus={openList}
        onClick={openList}
        onBlur={() => {
          if (pending) return;
          setOpen(false);
          setQuery(null);
        }}
        onKeyDown={handleKey}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active ? optionId(active.col, active.row) : undefined}
        aria-invalid={invalid}
        maxLength={categoryLimits.name}
        autoComplete="off"
        aria-label="Category"
        placeholder={open ? "Search, or type a new one" : "Choose a category"}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Show categories"
        onMouseDown={keepFocus}
        onClick={() => {
          if (open) return setOpen(false);
          inputRef.current?.focus();
          openList();
        }}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-chocolate/50 hover:text-gold"
      >
        {pending ? (
          <Spinner />
        ) : (
          <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
      </button>

      {open && (
        <div
          onMouseDown={keepFocus}
          onPointerDown={(e) => (touch.current = e.pointerType === "touch")}
          // The form puts each field in a <label>, which passes clicks on to the box and would reopen
          // the menu straight after a choice; this stops that
          onClick={(e) => e.preventDefault()}
          className="absolute left-0 top-full z-20 mt-1.5"
        >
          <div id={listId} role="listbox" className="flex max-w-[calc(100vw-2.5rem)] overflow-x-auto rounded-xl border border-chocolate/15 bg-white shadow-[0_16px_40px_-16px_rgba(46,26,17,0.45)]">
            {typed ? (
              <ul className="max-h-72 w-80 max-w-full overflow-auto p-1.5">
                {results.map((r, i) => (
                  <li
                    key={"id" in r ? r.id : `add-${r.parent?.id ?? "main"}`}
                    id={optionId(0, i)}
                    role="option"
                    aria-selected={"id" in r && r.id === value}
                    onClick={() => !pending && chooseResult(r)}
                    onMouseEnter={() => setActive({ col: 0, row: i })}
                    className={`${row} ${"id" in r ? tone(false, active?.row === i, r.id === value) : `text-gold ${active?.row === i ? "bg-chocolate" : ""}`} ${!("id" in r) && (i === found.length) && found.length ? "mt-1 border-t border-chocolate/10" : ""}`}
                  >
                    {"id" in r ? (
                      <>
                        <span className="truncate">{categoryLabel(categories, r.id)}</span>
                      </>
                    ) : (
                      <span className="truncate">
                        + Add “{r.name}” {r.parent ? `under ${r.parent.name}` : "as a main category"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : columns.length ? (
              columns.map((items, col) => (
                <ul key={col} className={`max-h-72 w-56 shrink-0 overflow-auto p-1.5 ${col ? "border-l border-chocolate/10" : ""}`}>
                  {items.map((c, i) => {
                    const subs = childrenOf(categories, c.id).length;
                    const isOpen = trail[col] === c.id;
                    // Highlighted: on the opened path, the chosen category, or under the pointer
                    const lit = isOpen || c.id === value || (active?.col === col && active.row === i);
                    return (
                      <li
                        key={c.id}
                        id={optionId(col, i)}
                        role="option"
                        aria-selected={c.id === value}
                        onMouseEnter={() => {
                          setActive({ col, row: i });
                          reveal(col, c);
                        }}
                        // On a touch screen the first tap opens the sub-categories, the next chooses
                        onClick={() => (touch.current && subs && !isOpen ? reveal(col, c) : select(c.id))}
                        className={`${row} ${tone(lit, false, c.id === value)}`}
                      >
                        <span className="truncate">{c.name}</span>
                        {subs > 0 && (
                          <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 ${lit ? "text-ivory/70" : "text-chocolate/40"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label={`${subs} sub-categories`}>
                            <path d="m9 6 6 6-6 6" />
                          </svg>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ))
            ) : (
              <p className="w-64 px-4 py-3 text-sm text-chocolate/60">No categories yet. Type a name to add one.</p>
            )}
          </div>
          {error && (
            <p className="mt-1 max-w-80 rounded-lg bg-red-700/10 px-3 py-2 text-xs text-red-800" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
      {!categories.length && !open && (
        <p className="mt-1.5 text-xs text-chocolate/60">
          Type a name to add your first category, or set them up on the <Link href="/admin/categories/" className="underline hover:text-gold">Categories</Link> page.
        </p>
      )}
    </div>
  );
}
