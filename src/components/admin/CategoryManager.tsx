"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { deleteCategory, moveCategoryProducts, saveCategory } from "@/app/actions/admin";
import Spinner from "@/components/Spinner";
import AdminToast from "@/components/admin/AdminToast";
import {
  categoryLabel,
  categoryLimits,
  categoryNameError,
  childrenOf,
  descendantIds,
  flatTree,
  matchScore,
  pathOf,
  placementError,
  productCounts,
  type Category,
} from "@/lib/category";
import { EditIcon, IconButton, TrashIcon } from "./actions";

export type CategoryProduct = { slug: string; name: string; categoryId: string; enabled: boolean };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const input =
  "w-full rounded-xl border border-chocolate/20 bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-gold aria-invalid:border-red-700";

type Open = { kind: "edit"; id: string | null; parentId: string | null } | { kind: "delete"; id: string } | null;

// The category tree on /admin/categories: add, rename, move and delete, with product counts
export default function CategoryManager({ categories, products }: { categories: Category[]; products: CategoryProduct[] }) {
  const [open, setOpen] = useState<Open>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ title: string; message: string; n: number } | null>(null);
  const counts = productCounts(categories, products);
  const notify = (title: string, message: string) => setToast((t) => ({ title, message, n: (t?.n ?? 0) + 1 }));

  // Rows under a collapsed category are left out
  const rows = flatTree(categories).filter((c) => !pathOf(categories, c.parentId).some((a) => collapsed.has(a.id)));
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const current = open && open.id ? categories.find((c) => c.id === open.id) : undefined;

  return (
    <div>
      {toast && <AdminToast key={toast.n} title={toast.title} message={toast.message} />}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm text-chocolate/70">
          {plural(categories.length, "category", "categories")} · {plural(products.length, "product", "products")}. A category&apos;s count includes its
          sub-categories. To move a product, edit it and choose another category.
        </p>
        <button type="button" onClick={() => setOpen({ kind: "edit", id: null, parentId: null })} className="btn btn-primary !px-6 !py-3">
          + Add category
        </button>
      </div>

      {!categories.length ? (
        <p className="rounded-2xl border border-dashed border-chocolate/25 px-6 py-12 text-center text-sm text-chocolate/60">
          No categories yet. Add your first one, e.g. Body Care.
        </p>
      ) : (
        <ul className="divide-y divide-chocolate/10 rounded-2xl border border-chocolate/15">
          {rows.map((c) => {
            const subs = childrenOf(categories, c.id).length;
            const { total, direct } = counts.get(c.id) ?? { total: 0, direct: 0 };
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3 pr-4" style={{ paddingLeft: `${1 + c.depth * 1.75}rem` }}>
                {subs > 0 ? (
                  <button
                    type="button"
                    onClick={() => toggle(c.id)}
                    aria-expanded={!collapsed.has(c.id)}
                    aria-label={`${collapsed.has(c.id) ? "Show" : "Hide"} the sub-categories of ${c.name}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-chocolate/60 hover:bg-chocolate/5 hover:text-gold"
                  >
                    <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${collapsed.has(c.id) ? "-rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center text-chocolate/30" aria-hidden="true">
                    {c.depth > 0 ? "└" : "•"}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className={c.depth ? "" : "font-medium"}>{c.name}</p>
                  <p className="text-xs text-chocolate/60">
                    {plural(total, "product", "products")}
                    {subs > 0 && direct > 0 && direct < total && ` (${direct} directly in it)`}
                    {subs > 0 && ` · ${plural(subs, "sub-category", "sub-categories")}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <IconButton label={`Add a sub-category to ${c.name}`} onClick={() => setOpen({ kind: "edit", id: null, parentId: c.id })}>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </IconButton>
                  <IconButton label={`Edit ${c.name}`} onClick={() => setOpen({ kind: "edit", id: c.id, parentId: c.parentId })}>
                    <EditIcon />
                  </IconButton>
                  <IconButton label={`Delete ${c.name}`} tone="red" onClick={() => setOpen({ kind: "delete", id: c.id })}>
                    <TrashIcon />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {open?.kind === "edit" && (open.id === null || current) && (
        <EditDialog
          categories={categories}
          category={current}
          parentId={open.parentId}
          onClose={() => setOpen(null)}
          onSaved={(title, message) => {
            setOpen(null);
            notify(title, message);
          }}
        />
      )}
      {open?.kind === "delete" && current && (
        <DeleteDialog
          category={current}
          categories={categories}
          products={products}
          onClose={() => setOpen(null)}
          onDeleted={() => {
            setOpen(null);
            notify("Category deleted", current.name);
          }}
        />
      )}
    </div>
  );
}

// Adds a category (no `category`) or renames / moves one
function EditDialog({ categories, category, parentId: startParent, onClose, onSaved }: {
  categories: Category[];
  category?: Category;
  parentId: string | null;
  onClose: () => void;
  onSaved: (title: string, message: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(category?.name ?? "");
  const [parentId, setParentId] = useState(startParent);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nameError = categoryNameError(name) ?? placementError(categories, category?.id ?? null, parentId);
    if (nameError) return setError(nameError);
    startTransition(async () => {
      const res = await saveCategory(category?.id ?? null, { name, parentId });
      if ("error" in res) return setError(res.error);
      router.refresh();
      onSaved(category ? "Category saved" : "Category added", categoryLabel([...categories.filter((c) => c.id !== res.category.id), res.category], res.category.id));
    });
  }

  // Not itself or anything inside it, and not so deep that the tree gets too many levels
  const parentOption = (c: Category) => {
    if (category && descendantIds(categories, category.id).has(c.id)) return { disabled: true, note: c.id === category.id ? "this one" : "inside it" };
    return placementError(categories, category?.id ?? null, c.id) ? { disabled: true, note: "too deep" } : {};
  };

  return (
    <Modal
      title={category ? "Edit category" : startParent ? "Add a sub-category" : "Add a category"}
      subject={category ? categoryLabel(categories, category.id) : startParent ? `Under ${categoryLabel(categories, startParent)}` : undefined}
      pending={pending}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate className="grid gap-5">
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-chocolate/60">Name</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            maxLength={categoryLimits.name}
            placeholder="Body Care"
            aria-invalid={!!error}
            autoFocus
            className={input}
          />
        </label>
        <div>
          <span className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-chocolate/60">Put it under</span>
          <CategoryList
            categories={categories}
            value={parentId}
            onChange={(id) => {
              setParentId(id);
              setError("");
            }}
            note={(c) => parentOption(c).note}
            noneLabel="Nothing — a main category"
          />
        </div>
        {error && (
          <p className="rounded-xl bg-red-700/10 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className="btn btn-primary w-full justify-center disabled:opacity-70">
          {pending && <Spinner />}
          {pending ? "Saving…" : category ? "Save" : "Add category"}
        </button>
      </form>
    </Modal>
  );
}

// Deletes an empty category. One with sub-categories or products says so instead, and for
// products offers to move them all to another category first.
function DeleteDialog({ category, categories, products, onClose, onDeleted }: {
  category: Category;
  categories: Category[];
  products: CategoryProduct[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [moved, setMoved] = useState(""); // what the last move did, e.g. Moved 1 product to “Face”.
  // Products not ticked for moving (all are ticked to start with)
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const subs = childrenOf(categories, category.id);
  const inIt = products.filter((p) => p.categoryId === category.id);
  const ticked = inIt.filter((p) => !unticked.has(p.slug));
  const tick = (slug: string) =>
    setUnticked((prev) => {
      const next = new Set(prev);
      if (!next.delete(slug)) next.add(slug);
      return next;
    });

  const run = (action: () => Promise<{ error: string } | { ok: true }>, done: () => void) =>
    startTransition(async () => {
      const res = await action();
      if ("error" in res) return setError(res.error);
      setError("");
      router.refresh(); // new counts; this dialog then shows the next step
      done();
    });

  const label = categoryLabel(categories, category.id);
  // What has to go first: its own products (they can be moved from here), then sub-categories
  const one = inIt.length === 1;
  const subNames = subs.map((s) => s.name).join(", ");
  const subsText = subs.length === 1 ? `1 sub-category, ${subNames}` : `${subs.length} sub-categories (${subNames})`;
  const itOrThem = subs.length === 1 ? "it" : "them";
  let body: ReactNode;
  if (inIt.length) {
    body = (
      <>
        <p className="text-sm text-chocolate/75">
          {one ? "There is 1 product" : `There are ${inIt.length} products`} in “{category.name}”. Once you move {one ? "it" : "them"} to another
          category, you can delete this category.
          {subs.length > 0 && ` It also has ${subsText}: delete ${itOrThem} or move ${itOrThem} under another category too.`}
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-[0.15em] text-chocolate/60">In “{category.name}”</span>
              {inIt.length > 1 && (
                <button
                  type="button"
                  onClick={() => setUnticked(ticked.length === inIt.length ? new Set(inIt.map((p) => p.slug)) : new Set())}
                  className="text-xs text-chocolate/60 underline-offset-2 hover:text-gold hover:underline"
                >
                  {ticked.length === inIt.length ? "Clear all" : "Select all"}
                </button>
              )}
            </div>
            <ul className="grid max-h-56 gap-0.5 overflow-y-auto rounded-2xl border border-chocolate/15 bg-white p-1.5 text-sm [scrollbar-width:thin]">
              {inIt.map((p) => {
                const on = !unticked.has(p.slug);
                return (
                  <li key={p.slug} className="flex items-center gap-1 rounded-lg hover:bg-chocolate/5">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-2">
                      <input type="checkbox" checked={on} onChange={() => tick(p.slug)} className="h-4 w-4 shrink-0 accent-chocolate" />
                      <span className={`truncate ${on ? "" : "text-chocolate/50"}`}>{p.name}</span>
                      {!p.enabled && <span className="shrink-0 text-xs text-chocolate/50">hidden</span>}
                    </label>
                    <Link
                      href={`/admin/products/${p.slug}/`}
                      aria-label={`Edit ${p.name}`}
                      title={`Edit ${p.name}`}
                      className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-chocolate/50 hover:text-gold"
                    >
                      <EditIcon className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <span className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-chocolate/60">
              Move {ticked.length === 1 ? "it" : ticked.length === inIt.length ? "them" : "the ticked ones"} to
            </span>
            <CategoryList
              categories={categories}
              value={target}
              onChange={(id) => {
                setTarget(id);
                setError("");
              }}
              note={(c) => (c.id === category.id ? "this one" : undefined)}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onClose} disabled={pending} className="btn btn-outline w-full">
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || !target || !ticked.length}
            onClick={() => {
              const count = ticked.length;
              run(
                () => moveCategoryProducts(category.id, target!, ticked.map((p) => p.slug)),
                () => {
                  setMoved(`Moved ${count} product${count === 1 ? "" : "s"} to “${categoryLabel(categories, target)}”.`);
                  setUnticked(new Set()); // the ones left are ticked again, ready for the next move
                  setTarget(null);
                },
              );
            }}
            className="btn btn-primary w-full justify-center disabled:opacity-60"
          >
            {pending && <Spinner />}
            {pending
              ? "Moving…"
              : !ticked.length
                ? "Tick products to move"
                : ticked.length === inIt.length
                  ? one
                    ? "Move it"
                    : `Move all ${inIt.length}`
                  : `Move ${ticked.length} of ${inIt.length}`}
          </button>
        </div>
      </>
    );
  } else if (subs.length) {
    body = (
      <>
        <p className="text-sm text-chocolate/75">
          “{category.name}” has {subsText}. Once you delete {itOrThem} or move {itOrThem} under
          another category, you can delete this category.
        </p>
        <button type="button" onClick={onClose} className="btn btn-outline w-full">
          OK
        </button>
      </>
    );
  } else {
    body = (
      <>
        <p className="text-sm text-chocolate/75">
          It has no products or sub-categories, so it can be deleted. This can&apos;t be undone.
        </p>
        <div className="grid gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => deleteCategory(category.id), onDeleted)}
            className="btn w-full justify-center bg-red-700 text-ivory hover:bg-red-800 disabled:opacity-70"
          >
            {pending && <Spinner />}
            {pending ? "Deleting…" : "Yes, delete"}
          </button>
          <button type="button" onClick={onClose} disabled={pending} className="btn btn-outline w-full">
            Cancel
          </button>
        </div>
      </>
    );
  }

  return (
    <Modal
      title={subs.length || inIt.length ? "Can't delete this yet" : "Delete this category?"}
      subject={label}
      pending={pending}
      onClose={onClose}
      wide={inIt.length > 0}
    >
      <div className="grid gap-5">
        {moved && (
          <p className="rounded-xl bg-green-700/10 px-4 py-3 text-sm text-green-800" role="status">
            {moved}
          </p>
        )}
        {body}
        {error && (
          <p className="rounded-xl bg-red-700/10 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

// Categories to pick one from, as an always-open list indented by level (used in the pop-ups, where
// a dropdown would hang off the edge). `note` greys out a category and says why it can't be picked.
// A search box is added when the list is long.
function CategoryList({ categories, value, onChange, note, noneLabel }: {
  categories: Category[];
  value: string | null;
  onChange: (id: string | null) => void;
  note?: (c: Category) => string | undefined;
  noneLabel?: string; // a first choice with the value null
}) {
  const [q, setQ] = useState("");
  const typed = q.trim();
  const rows = [
    ...(noneLabel && !typed ? [{ id: null, label: noneLabel, depth: 0, note: undefined }] : []),
    ...flatTree(categories)
      .filter((c) => !typed || matchScore(c.name, typed) !== null)
      .map((c) => ({ id: c.id as string | null, label: typed ? categoryLabel(categories, c.id) : c.name, depth: typed ? 0 : c.depth, note: note?.(c) })),
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-chocolate/15 bg-white">
      {categories.length > 8 && (
        <div className="border-b border-chocolate/10 p-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search categories…"
            aria-label="Search categories"
            autoComplete="off"
            className="w-full rounded-full border border-chocolate/15 bg-cream/60 px-4 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
      )}
      <ul role="radiogroup" className="grid max-h-56 gap-0.5 overflow-y-auto p-1.5 [scrollbar-width:thin]">
        {rows.length === 0 && <li className="px-3 py-4 text-center text-sm text-chocolate/50">No categories match “{typed}”.</li>}
        {rows.map((r) => {
          const chosen = r.id === value;
          return (
            <li key={r.id ?? "none"}>
              <button
                type="button"
                role="radio"
                aria-checked={chosen}
                disabled={!!r.note}
                onClick={() => onChange(r.id)}
                style={{ paddingLeft: `${0.75 + r.depth * 1.1}rem` }}
                className={`flex w-full items-center gap-2 rounded-lg py-2 pr-3 text-left text-sm transition-colors ${
                  chosen ? "bg-chocolate text-ivory" : r.note ? "cursor-not-allowed text-chocolate/35" : "text-chocolate/80 hover:bg-chocolate/5"
                }`}
              >
                {r.depth > 0 && <span className={chosen ? "text-ivory/50" : "text-chocolate/30"} aria-hidden="true">└</span>}
                <span className="min-w-0 flex-1 truncate">{r.label}</span>
                {r.note && <span className="shrink-0 text-xs">{r.note}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// The admin's pop-up frame (as ConfirmDialog): a native <dialog>, closed by Escape, the ×, or a
// click on the dimmed backdrop, except while something is saving
function Modal({ title, subject, pending, onClose, wide, children }: {
  title: string;
  wide?: boolean; // room for two columns
  subject?: string;
  pending: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => pending && e.preventDefault()}
      onClick={(e) => e.target === ref.current && !pending && ref.current.close()}
      aria-labelledby="category-dialog-title"
      // Scrolls if it's ever taller than the screen
      className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] ${wide ? "max-w-2xl" : "max-w-md"} overflow-y-auto rounded-[2rem] bg-cream p-0 text-chocolate [scrollbar-width:thin] backdrop:bg-espresso/50`}
    >
      <div className="relative p-6 md:p-8">
        <button
          type="button"
          onClick={() => ref.current?.close()}
          disabled={pending}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-chocolate/60 transition-colors hover:bg-chocolate/10 hover:text-chocolate disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <div className="mb-6 pr-8">
          <h2 id="category-dialog-title" className="font-medium">
            {title}
          </h2>
          {subject && <p className="mt-1 truncate text-sm text-chocolate/60">{subject}</p>}
        </div>
        {children}
      </div>
    </dialog>
  );
}
