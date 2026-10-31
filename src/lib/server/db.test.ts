// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { seedProducts } from "@/data/seed-products";
import type { CategoryDoc } from "./db";

type Doc = Record<string, unknown>;

const { mongo } = vi.hoisted(() => {
  // Just enough of a MongoDB query: equal values, { $exists }, { $ne }
  const matches = (doc: Doc, filter: Doc) =>
    Object.entries(filter).every(([k, cond]) => {
      if (cond && typeof cond === "object" && !Array.isArray(cond)) {
        const c = cond as Doc;
        if ("$exists" in c) return (k in doc && doc[k] !== undefined) === c.$exists;
        if ("$ne" in c) return doc[k] !== c.$ne;
      }
      return (doc[k] ?? null) === cond;
    });

  // An in-memory collection with the methods db.ts calls
  class FakeCollection {
    docs: Doc[] = [];
    indexes: unknown[][] = [];
    dropIndex = vi.fn(async () => {
      throw new Error("index not found");
    });
    createIndex = vi.fn(async (...args: unknown[]) => void this.indexes.push(args));
    estimatedDocumentCount = vi.fn(async () => this.docs.length);
    insertMany = vi.fn(async (docs: Doc[]) => void this.docs.push(...docs));
    insertOne = vi.fn(async (doc: Doc) => {
      this.docs.push(doc);
    });
    findOne = vi.fn(async (filter: Doc) => this.docs.find((d) => matches(d, filter)) ?? null);
    distinct = vi.fn(async (field: string, filter: Doc) => [...new Set(this.docs.filter((d) => matches(d, filter)).map((d) => d[field]))]);
    updateMany = vi.fn(async (filter: Doc, update: { $set?: Doc; $unset?: Doc }) => {
      for (const d of this.docs.filter((d) => matches(d, filter))) {
        Object.assign(d, update.$set);
        for (const k of Object.keys(update.$unset ?? {})) delete d[k];
      }
    });
  }

  const mongo = {
    FakeCollection,
    collections: new Map<string, FakeCollection>(),
    connects: 0,
    failConnect: false,
    clientArgs: [] as unknown[],
    dbName: "",
    collection(name: string) {
      if (!mongo.collections.has(name)) mongo.collections.set(name, new FakeCollection());
      return mongo.collections.get(name)!;
    },
  };
  return { mongo };
});

vi.mock("server-only", () => ({}));
vi.mock("mongodb", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  MongoClient: class {
    constructor(...args: unknown[]) {
      mongo.clientArgs = args;
    }
    async connect() {
      mongo.connects++;
      if (mongo.failConnect) throw new Error("ECONNREFUSED");
      return {
        db: (name: string) => {
          mongo.dbName = name;
          return { collection: (c: string) => mongo.collection(c) };
        },
      };
    }
  },
}));

// db.ts keeps its connection on globalThis; each test starts without one
const g = globalThis as { mongo?: unknown };
const load = async () => {
  vi.resetModules();
  return import("./db");
};

beforeEach(() => {
  delete g.mongo;
  mongo.collections.clear();
  mongo.connects = 0;
  mongo.failConnect = false;
  vi.stubEnv("MONGODB_URI", "mongodb+srv://test.example/");
  vi.stubEnv("MONGODB_DB", "");
});

afterEach(() => {
  delete g.mongo;
  vi.unstubAllEnvs();
});

describe("getDb: connecting", () => {
  test("fails with a clear message when MONGODB_URI isn't set", async () => {
    vi.stubEnv("MONGODB_URI", "");
    const { getDb } = await load();
    await expect(getDb()).rejects.toThrow("MONGODB_URI is not set");
  });

  test("connects with a small pool of connections", async () => {
    const { getDb } = await load();
    await getDb();
    expect(mongo.clientArgs).toEqual(["mongodb+srv://test.example/", { maxPoolSize: 10, minPoolSize: 2, maxIdleTimeMS: 600000 }]);
  });

  test("uses the melovme database unless MONGODB_DB names another", async () => {
    const { getDb } = await load();
    await getDb();
    expect(mongo.dbName).toBe("melovme");

    delete g.mongo;
    vi.stubEnv("MONGODB_DB", "melovme-staging");
    await (await load()).getDb();
    expect(mongo.dbName).toBe("melovme-staging");
  });

  test("returns every collection the shop uses", async () => {
    const { getDb } = await load();
    const db = await getDb();
    expect(Object.keys(db).sort()).toEqual(["categories", "orders", "otps", "products", "reviews", "sessions", "settings", "users"]);
    expect(db.orders).toBe(mongo.collection("orders"));
  });

  test("connects once and shares the connection between requests", async () => {
    const { getDb } = await load();
    await Promise.all([getDb(), getDb()]);
    await getDb();
    expect(mongo.connects).toBe(1);
  });

  test("after a failed connection the next request tries again", async () => {
    const { getDb } = await load();
    mongo.failConnect = true;
    await expect(getDb()).rejects.toThrow("ECONNREFUSED");
    mongo.failConnect = false;
    await expect(getDb()).resolves.toBeDefined();
    expect(mongo.connects).toBe(2);
  });
});

describe("getDb: setting up the database", () => {
  test("drops the old email login indexes, ignoring them if they're already gone", async () => {
    const { getDb } = await load();
    await getDb();
    expect(mongo.collection("users").dropIndex).toHaveBeenCalledWith("email_1");
    expect(mongo.collection("otps").dropIndex).toHaveBeenCalledWith("email_1");
  });

  test("one account per phone number, and one review per customer per product", async () => {
    const { getDb } = await load();
    await getDb();
    expect(mongo.collection("users").indexes).toContainEqual([{ phone: 1 }, { unique: true }]);
    expect(mongo.collection("reviews").indexes).toContainEqual([
      { productSlug: 1, userId: 1 },
      { unique: true, partialFilterExpression: { userId: { $exists: true } } },
    ]);
  });

  test("sessions and login codes are deleted by MongoDB when they expire", async () => {
    const { getDb } = await load();
    await getDb();
    expect(mongo.collection("sessions").indexes).toContainEqual([{ expiresAt: 1 }, { expireAfterSeconds: 0 }]);
    expect(mongo.collection("otps").indexes).toContainEqual([{ expiresAt: 1 }, { expireAfterSeconds: 0 }]);
  });

  test("an empty shop gets the starting catalogue, enabled and in stock, in order", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-06-15T12:00:00+05:30"));
    const { getDb } = await load();
    await getDb();
    vi.useRealTimers();
    const products = mongo.collection("products").docs;
    expect(products.map((p) => p._id)).toEqual(seedProducts.map((p) => p.slug));
    expect(products[0]).toMatchObject({ name: seedProducts[0].name, enabled: true, inStock: true, offer: null });
    expect(products[0]).not.toHaveProperty("slug");
    // createdAt 1 ms apart, so the shop keeps the catalogue's order
    expect((products[1].createdAt as Date).getTime() - (products[0].createdAt as Date).getTime()).toBe(1);
  });

  test("a shop that already has products isn't seeded again", async () => {
    mongo.collection("products").docs.push({ _id: "my-product", name: "Mine", categoryId: "c1" });
    const { getDb } = await load();
    await getDb();
    expect(mongo.collection("products").insertMany).not.toHaveBeenCalled();
  });

  test("seeding at the same moment as another request doesn't fail", async () => {
    mongo.collection("products").insertMany.mockRejectedValueOnce(new Error("E11000 duplicate key"));
    const { getDb } = await load();
    await expect(getDb()).resolves.toBeDefined();
  });
});

describe("getDb: linking old products to categories", () => {
  const products = () => mongo.collection("products").docs;
  const categories = () => mongo.collection("categories").docs as CategoryDoc[];

  test("each old category name becomes a main category and its products are linked to it", async () => {
    products().push(
      { _id: "a", category: "Body Care" },
      { _id: "b", category: "Body Care" },
      { _id: "c", category: "Gift Sets" },
    );
    const { getDb } = await load();
    await getDb();
    expect(categories().map((c) => [c.name, c.key, c.slug, c.parentId])).toEqual([
      ["Body Care", "body care", "body-care", null],
      ["Gift Sets", "gift sets", "gift-sets", null],
    ]);
    const bodyCare = categories()[0]._id;
    expect(products()[0]).toEqual({ _id: "a", categoryId: bodyCare });
    expect(products()[1]).toEqual({ _id: "b", categoryId: bodyCare });
  });

  test("an existing main category with the same name (ignoring case and spaces) is reused", async () => {
    categories().push({ _id: "cat1", name: "Body Care", key: "body care", slug: "body-care", parentId: null } as CategoryDoc);
    products().push({ _id: "a", category: "  body   CARE " });
    const { getDb } = await load();
    await getDb();
    expect(categories()).toHaveLength(1);
    expect(products()[0]).toEqual({ _id: "a", categoryId: "cat1" });
  });

  test("a blank old category name goes into Uncategorised", async () => {
    products().push({ _id: "a", category: "   " });
    const { getDb } = await load();
    await getDb();
    expect(categories()[0]).toMatchObject({ name: "Uncategorised", slug: "uncategorised" });
    expect(products()[0].categoryId).toBe(categories()[0]._id);
  });

  test("products already linked are left alone", async () => {
    products().push({ _id: "a", categoryId: "cat1", category: "Leftover" });
    const { getDb } = await load();
    await getDb();
    expect(categories()).toEqual([]);
    expect(products()[0]).toEqual({ _id: "a", categoryId: "cat1", category: "Leftover" });
  });

  test("if another request made the category at the same moment, its category is used", async () => {
    products().push({ _id: "a", category: "Body Care" });
    const cats = mongo.collection("categories");
    // Our insert fails as a duplicate; meanwhile the other request's category is there
    cats.insertOne.mockImplementationOnce(async () => {
      cats.docs.push({ _id: "theirs", name: "Body Care", key: "body care", slug: "body-care", parentId: null });
      throw new Error("E11000 duplicate key");
    });
    const { getDb } = await load();
    await getDb();
    expect(products()[0]).toEqual({ _id: "a", categoryId: "theirs" });
  });
});

describe("freeCategorySlug", () => {
  const withSlugs = (...slugs: string[]) => {
    const c = new mongo.FakeCollection();
    c.docs = slugs.map((slug, i) => ({ _id: `c${i}`, slug }));
    return c as never;
  };

  test("uses the name's slug when it's free", async () => {
    const { freeCategorySlug } = await load();
    expect(await freeCategorySlug(withSlugs(), "Gift Sets")).toBe("gift-sets");
  });

  test("puts the parent's slug in front when the name's slug is taken", async () => {
    const { freeCategorySlug } = await load();
    expect(await freeCategorySlug(withSlugs("gift-sets"), "Gift Sets", "men")).toBe("men-gift-sets");
  });

  test("adds -2, -3… when those are taken too", async () => {
    const { freeCategorySlug } = await load();
    expect(await freeCategorySlug(withSlugs("gift-sets", "men-gift-sets"), "Gift Sets", "men")).toBe("men-gift-sets-2");
    expect(await freeCategorySlug(withSlugs("gift-sets", "gift-sets-2"), "Gift Sets")).toBe("gift-sets-3");
  });

  test("a category keeps its own slug when renamed to the same name", async () => {
    const { freeCategorySlug } = await load();
    // "gift-sets" belongs to c0, the category being renamed
    expect(await freeCategorySlug(withSlugs("gift-sets"), "Gift Sets", undefined, "c0")).toBe("gift-sets");
  });
});
