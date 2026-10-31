// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CategoryDoc, ProductDoc } from "./db";
import {
  adjustStock,
  categoryNames,
  getCatalog,
  getCatalogProduct,
  loadCategories,
  refreshCatalog,
  toCategory,
  toProduct,
} from "./products";

const { db, state, revalidateTag } = vi.hoisted(() => {
  const state = { products: [] as unknown[], categories: [] as unknown[] };
  const productCursor = { sort: vi.fn(), toArray: vi.fn(async () => state.products) };
  productCursor.sort.mockReturnValue(productCursor);
  return {
    state,
    revalidateTag: vi.fn(),
    db: {
      productCursor,
      products: { find: vi.fn(() => productCursor), updateOne: vi.fn(async () => ({})) },
      categories: { find: vi.fn(() => ({ toArray: async () => state.categories })) },
    },
  };
});

vi.mock("server-only", () => ({}));
// No caching in tests: the function runs every time
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag }));
vi.mock("./db", () => ({ getDb: async () => db }));

const NOW = new Date("2026-06-15T12:00:00+05:30");

const bodyCare: CategoryDoc = { _id: "cat1", name: "Body Care", key: "body care", slug: "body-care", parentId: null, createdAt: NOW, updatedAt: NOW };

const lotion = (change: Partial<ProductDoc> = {}): ProductDoc => ({
  _id: "signature-body-lotion",
  name: "Signature Body Lotion",
  categoryId: "cat1",
  size: "200 ml",
  price: 1550,
  shortDescription: "Soft skin",
  description: "A rich lotion.",
  images: ["https://res.cloudinary.com/x/lotion.jpg"],
  highlights: ["Vegan"],
  ingredients: ["Shea butter"],
  howToUse: "Apply daily.",
  enabled: true,
  stock: 5,
  inStock: true,
  offer: null,
  combos: [{ qty: 2, price: 3000 }],
  createdAt: NOW,
  updatedAt: NOW,
  ...change,
});

const names = new Map([["cat1", "Body Care"]]);

beforeEach(() => {
  state.products = [];
  state.categories = [];
  vi.clearAllMocks();
});

describe("toCategory", () => {
  test("keeps only the fields the shop needs", () => {
    expect(toCategory(bodyCare)).toEqual({ id: "cat1", name: "Body Care", slug: "body-care", parentId: null });
  });
});

describe("categoryNames", () => {
  test("maps each category id to its name", () => {
    expect(categoryNames([toCategory(bodyCare)])).toEqual(names);
  });
});

describe("toProduct", () => {
  test("uses the database id as the slug and adds the category name", () => {
    const p = toProduct(lotion(), names);
    expect(p.slug).toBe("signature-body-lotion");
    expect(p.category).toBe("Body Care");
  });

  test("leaves out database-only fields like dates", () => {
    expect(toProduct(lotion(), names)).not.toHaveProperty("createdAt");
    expect(toProduct(lotion(), names)).not.toHaveProperty("_id");
  });

  test("a product whose category was deleted has an empty category name", () => {
    expect(toProduct(lotion({ categoryId: "gone" }), names).category).toBe("");
  });

  test("a product not linked to any category gets empty category id and name", () => {
    const p = toProduct(lotion({ categoryId: undefined as unknown as string }), names);
    expect(p.categoryId).toBe("");
    expect(p.category).toBe("");
  });

  test("with a stock count, in stock means more than 0 left", () => {
    expect(toProduct(lotion({ stock: 3 }), names)).toMatchObject({ stock: 3, inStock: true });
    // the stock count wins over an old switch that says otherwise
    expect(toProduct(lotion({ stock: 0, inStock: true }), names)).toMatchObject({ stock: 0, inStock: false });
  });

  test("without a stock count, the old in/out of stock switch decides", () => {
    expect(toProduct(lotion({ stock: undefined, inStock: false }), names)).toMatchObject({ stock: null, inStock: false });
    expect(toProduct(lotion({ stock: undefined, inStock: true }), names)).toMatchObject({ stock: null, inStock: true });
  });

  test("products from before the switch existed are in stock", () => {
    expect(toProduct(lotion({ stock: undefined, inStock: undefined }), names).inStock).toBe(true);
  });

  test("products saved before offers or combos existed get none", () => {
    const p = toProduct(lotion({ offer: undefined, combos: undefined }), names);
    expect(p.offer).toBeNull();
    expect(p.combos).toEqual([]);
  });
});

describe("loadCategories", () => {
  test("returns every category in the shop's form", async () => {
    state.categories = [bodyCare];
    expect(await loadCategories()).toEqual([{ id: "cat1", name: "Body Care", slug: "body-care", parentId: null }]);
  });
});

describe("getCatalog", () => {
  test("only enabled products, in the order they were added", async () => {
    await getCatalog();
    expect(db.products.find).toHaveBeenCalledWith({ enabled: true });
    expect(db.productCursor.sort).toHaveBeenCalledWith({ createdAt: 1 });
  });

  test("returns the products with their category names", async () => {
    state.products = [lotion()];
    state.categories = [bodyCare];
    const [p] = await getCatalog();
    expect(p).toEqual(toProduct(lotion(), names));
  });
});

describe("getCatalogProduct", () => {
  test("finds a product in the catalogue by its slug", async () => {
    state.products = [lotion(), lotion({ _id: "gift-set", name: "Gift Set" })];
    expect((await getCatalogProduct("gift-set"))?.name).toBe("Gift Set");
  });

  test("a slug that isn't in the catalogue finds nothing", async () => {
    state.products = [lotion()];
    expect(await getCatalogProduct("nope")).toBeUndefined();
  });
});

describe("refreshCatalog", () => {
  test("expires the cached catalogue straight away", () => {
    refreshCatalog();
    expect(revalidateTag).toHaveBeenCalledWith("products", { expire: 0 });
  });
});

// Works out what MongoDB would do with adjustStock's update pipeline, for the few operators it uses
type Doc = Record<string, unknown>;
function evaluate(expr: unknown, doc: Doc): unknown {
  if (expr === "$$NOW") return NOW;
  if (typeof expr === "string" && expr.startsWith("$")) return doc[expr.slice(1)];
  if (expr && typeof expr === "object" && !Array.isArray(expr)) {
    const [[op, args]] = Object.entries(expr);
    const v = (args as unknown[]).map((a) => evaluate(a, doc)) as number[];
    if (op === "$add") return v[0] + v[1];
    if (op === "$max") return Math.max(...v);
    if (op === "$gt") return v[0] > v[1];
    throw new Error(`operator not handled in test: ${op}`);
  }
  return expr;
}
function applyUpdate(doc: Doc, filter: Doc, pipeline: { $set: Doc }[]) {
  // adjustStock's filter only touches products that have a stock count of 0 or more
  if (doc._id !== filter._id || !(typeof doc.stock === "number" && doc.stock >= 0)) return doc;
  const set = pipeline[0].$set;
  return { ...doc, ...Object.fromEntries(Object.entries(set).map(([k, e]) => [k, evaluate(e, doc)])) };
}
const stockAfter = async (doc: Doc, qty: number, direction: 1 | -1) => {
  await adjustStock([{ slug: doc._id as string, qty }], direction);
  const [filter, pipeline] = db.products.updateOne.mock.calls[0] as unknown as [Doc, { $set: Doc }[]];
  return applyUpdate(doc, filter, pipeline);
};

describe("adjustStock", () => {
  test("updates each ordered product, only if it has a stock count", async () => {
    await adjustStock([{ slug: "a", qty: 1 }, { slug: "b", qty: 2 }], -1);
    expect(db.products.updateOne).toHaveBeenCalledTimes(2);
    expect(db.products.updateOne.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      { _id: "a", stock: { $gte: 0 } },
      { _id: "b", stock: { $gte: 0 } },
    ]);
  });

  test("a paid order takes its pieces out of stock", async () => {
    // 5 on hand, 2 sold → 3
    expect(await stockAfter({ _id: "a", stock: 5, inStock: true }, 2, -1)).toMatchObject({ stock: 3, inStock: true, updatedAt: NOW });
  });

  test("selling the last pieces marks the product out of stock", async () => {
    expect(await stockAfter({ _id: "a", stock: 2, inStock: true }, 2, -1)).toMatchObject({ stock: 0, inStock: false });
  });

  test("stock never goes below 0", async () => {
    // 1 on hand, 3 sold (e.g. two customers paying at once) → 0, not -2
    expect(await stockAfter({ _id: "a", stock: 1, inStock: true }, 3, -1)).toMatchObject({ stock: 0, inStock: false });
  });

  test("a cancelled order puts its pieces back and the product is in stock again", async () => {
    expect(await stockAfter({ _id: "a", stock: 0, inStock: false }, 2, 1)).toMatchObject({ stock: 2, inStock: true });
  });

  test("products without a stock count are left alone", async () => {
    const old = { _id: "a", inStock: true };
    expect(await stockAfter(old, 2, -1)).toEqual(old);
  });

  test("refreshes the shop's catalogue afterwards", async () => {
    await adjustStock([{ slug: "a", qty: 1 }], -1);
    expect(revalidateTag).toHaveBeenCalledWith("products", { expire: 0 });
  });
});
