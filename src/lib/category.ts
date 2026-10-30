// Product categories, managed in /admin/categories. They form a tree of any depth
// (e.g. Body Care › Lotions › Travel size). A product belongs to exactly one category, at any
// level: Body Care can hold products of its own as well as sub-categories. In the shop a category
// shows its own products and those of everything under it.

export type Category = {
  id: string;
  name: string;
  slug: string; // used in shop links, e.g. /products/?category=body-care
  parentId: string | null; // null = a main category
};

// How deep the tree can go (a main category is level 1)
export const MAX_CATEGORY_DEPTH = 6;
export const categoryLimits = { name: 50 };

// Letters, spaces and & , . ' - e.g. "Body Care", "Bath & Body"
const CATEGORY_NAME = /^\p{L}[\p{L}\p{M}\s&,.'-]*$/u;

// The same text for names that only differ in case or spacing ("Body Care" = "body  care ")
export const categoryKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

// Single spaces, no spaces at the ends
export const tidyCategoryName = (name: string) => name.trim().replace(/\s+/g, " ");

export function categoryNameError(name: string) {
  const n = tidyCategoryName(name);
  if (!n) return "Enter a category name.";
  if (n.length > categoryLimits.name) return `Keep it under ${categoryLimits.name} characters.`;
  if (!CATEGORY_NAME.test(n)) return "Use letters only, e.g. Body Care.";
  return null;
}

// The link name made from a category name, e.g. "Bath & Body" → "bath-body"
export const categorySlug = (name: string) =>
  name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "") ||
  "category";

const byName = (a: Category, b: Category) => a.name.localeCompare(b.name);

export function childrenOf(categories: Category[], parentId: string | null) {
  return categories.filter((c) => c.parentId === parentId).sort(byName);
}

export const hasChildren = (categories: Category[], id: string) => categories.some((c) => c.parentId === id);

// The category and everything under it, at any depth
export function descendantIds(categories: Category[], id: string) {
  const ids = new Set([id]);
  for (let added = true; added; ) {
    added = false;
    for (const c of categories) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        added = true;
      }
    }
  }
  return ids;
}

// From the main category down to this one, e.g. [Body Care, Lotions]. Empty if it doesn't exist.
export function pathOf(categories: Category[], id: string | null) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const path: Category[] = [];
  for (let c = id ? byId.get(id) : undefined; c && !path.includes(c); c = c.parentId ? byId.get(c.parentId) : undefined) {
    path.unshift(c);
  }
  return path;
}

// "Body Care › Lotions"
export const categoryLabel = (categories: Category[], id: string | null) =>
  pathOf(categories, id)
    .map((c) => c.name)
    .join(" › ");

// Typing distance: letters added, removed, changed or swapped ("sunscrenn" → "sunscreen" is 1)
function typoDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// How well a category name matches what was typed, for search: 0 = contains it exactly (best),
// 1, 2… = that many typos away (from the whole name, one of its words, or its start), null = no match.
// Short searches allow fewer typos, so "lip" doesn't match "tip".
export function matchScore(name: string, typed: string) {
  const q = categoryKey(typed);
  const n = categoryKey(name);
  if (!q) return null;
  if (n.includes(q)) return 0;
  const allowed = q.length <= 3 ? 0 : q.length <= 6 ? 1 : 2;
  if (!allowed) return null;
  const targets = [n, ...n.split(" ")].flatMap((t) => [t, t.slice(0, q.length)]);
  const best = Math.min(...targets.map((t) => typoDistance(q, t)));
  return best <= allowed ? best : null;
}

// The whole tree as one list, each category followed by its sub-categories (for lists and pickers)
export function flatTree(categories: Category[]) {
  const out: (Category & { depth: number })[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const c of childrenOf(categories, parentId)) {
      out.push({ ...c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

// How many levels a category and its sub-categories take up (1 = no sub-categories)
function height(categories: Category[], id: string): number {
  return 1 + Math.max(0, ...childrenOf(categories, id).map((c) => height(categories, c.id)));
}

// Why `id` (or a new category, when `id` is null) can't go under `parentId`, or null if it can.
// Doesn't check names or products; the server does that.
export function placementError(categories: Category[], id: string | null, parentId: string | null) {
  if (!parentId) return null;
  if (!categories.some((c) => c.id === parentId)) return "That parent category no longer exists.";
  if (id && descendantIds(categories, id).has(parentId)) return "A category can't go inside itself or one of its own sub-categories.";
  const depth = pathOf(categories, parentId).length + (id ? height(categories, id) : 1);
  if (depth > MAX_CATEGORY_DEPTH) return `Categories can be up to ${MAX_CATEGORY_DEPTH} levels deep.`;
  return null;
}

// Products per category: `direct` = in the category itself, `total` = with all its sub-categories
export function productCounts(categories: Category[], products: { categoryId: string }[]) {
  const direct = new Map<string, number>();
  for (const p of products) direct.set(p.categoryId, (direct.get(p.categoryId) ?? 0) + 1);
  return new Map(
    categories.map((c) => {
      let total = 0;
      for (const id of descendantIds(categories, c.id)) total += direct.get(id) ?? 0;
      return [c.id, { direct: direct.get(c.id) ?? 0, total }];
    }),
  );
}
