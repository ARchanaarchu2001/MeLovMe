import { describe, expect, test } from "vitest";
import {
  MAX_CATEGORY_DEPTH,
  categoryKey,
  categoryLabel,
  categoryNameError,
  categorySlug,
  descendantIds,
  flatTree,
  matchScore,
  pathOf,
  placementError,
  productCounts,
  type Category,
} from "./category";

const cat = (id: string, name: string, parentId: string | null = null): Category => ({ id, name, slug: categorySlug(name), parentId });

// Body Care › Lotions › Travel size, Body Care › Oils, and Gifts on its own
const tree = [
  cat("body", "Body Care"),
  cat("lotions", "Lotions", "body"),
  cat("travel", "Travel size", "lotions"),
  cat("oils", "Oils", "body"),
  cat("gifts", "Gifts"),
];

describe("category names", () => {
  test("names that differ only in case or spacing are the same", () => {
    expect(categoryKey("Body Care")).toBe(categoryKey("  body   care "));
  });

  test("letters and & , . ' - are allowed", () => {
    expect(categoryNameError("Bath & Body")).toBeNull();
    expect(categoryNameError("Men's Care")).toBeNull();
  });

  test("empty, too long or without letters is refused", () => {
    expect(categoryNameError("   ")).toBe("Enter a category name.");
    expect(categoryNameError("a".repeat(51))).toMatch(/under 50/);
    expect(categoryNameError("123")).toMatch(/letters only/);
  });

  test("slugs are made from the name", () => {
    expect(categorySlug("Bath & Body")).toBe("bath-body");
    expect(categorySlug("&&&")).toBe("category");
  });
});

describe("the tree", () => {
  test("lists each category followed by its sub-categories, by name", () => {
    expect(flatTree(tree).map((c) => `${c.depth}:${c.name}`)).toEqual(["0:Body Care", "1:Lotions", "2:Travel size", "1:Oils", "0:Gifts"]);
  });

  test("a category's descendants include every level below it", () => {
    expect([...descendantIds(tree, "body")].sort()).toEqual(["body", "lotions", "oils", "travel"]);
    expect([...descendantIds(tree, "gifts")]).toEqual(["gifts"]);
  });

  test("the label is the full path", () => {
    expect(categoryLabel(tree, "travel")).toBe("Body Care › Lotions › Travel size");
    expect(categoryLabel(tree, "missing")).toBe("");
    expect(pathOf(tree, null)).toEqual([]);
  });

  test("a broken (looping) tree doesn't hang", () => {
    const loop = [cat("a", "A", "b"), cat("b", "B", "a")];
    expect(pathOf(loop, "a").map((c) => c.id)).toEqual(["b", "a"]);
  });
});

describe("where a category can go", () => {
  test("anywhere for a new category", () => {
    expect(placementError(tree, null, null)).toBeNull();
    expect(placementError(tree, null, "travel")).toBeNull();
  });

  test("not inside itself or its own sub-categories", () => {
    expect(placementError(tree, "body", "body")).toMatch(/inside itself/);
    expect(placementError(tree, "body", "travel")).toMatch(/inside itself/);
    expect(placementError(tree, "lotions", "gifts")).toBeNull();
  });

  test("not under a category that no longer exists", () => {
    expect(placementError(tree, null, "gone")).toMatch(/no longer exists/);
  });

  test(`not deeper than ${MAX_CATEGORY_DEPTH} levels, counting what's under it`, () => {
    const deep = Array.from({ length: MAX_CATEGORY_DEPTH }, (_, i) => cat(`l${i}`, `Level ${i}`, i ? `l${i - 1}` : null));
    const last = `l${MAX_CATEGORY_DEPTH - 1}`;
    expect(placementError(deep, null, last)).toMatch(/levels deep/);
    expect(placementError(deep, null, `l${MAX_CATEGORY_DEPTH - 2}`)).toBeNull();
    // Body Care has 3 levels; under level 4 it would reach 7
    expect(placementError([...deep, ...tree], "body", "l3")).toMatch(/levels deep/);
  });
});

describe("product counts", () => {
  test("a category counts its own products and everything below it", () => {
    const counts = productCounts(tree, [{ categoryId: "travel" }, { categoryId: "travel" }, { categoryId: "oils" }, { categoryId: "gifts" }]);
    expect(counts.get("body")).toEqual({ direct: 0, total: 3 });
    expect(counts.get("lotions")).toEqual({ direct: 0, total: 2 });
    expect(counts.get("travel")).toEqual({ direct: 2, total: 2 });
    expect(counts.get("gifts")).toEqual({ direct: 1, total: 1 });
  });
});

describe("search", () => {
  test("finds names containing what was typed", () => {
    expect(matchScore("Sunscreen", "screen")).toBe(0);
    expect(matchScore("Body Care", "body")).toBe(0);
  });

  test("forgives small typos", () => {
    expect(matchScore("Sunscreen", "sunscrenn")).toBe(1);
    expect(matchScore("Sunscreen", "snuscreen")).toBe(1); // swapped letters
    expect(matchScore("Sunscreen", "sunscrn")).toBe(1); // still typing
    expect(matchScore("Body Care", "bdy care")).toBe(1);
  });

  test("doesn't match unrelated or very short near misses", () => {
    expect(matchScore("Sunscreen", "perfume")).toBeNull();
    expect(matchScore("Tip", "lip")).toBeNull();
    expect(matchScore("Lip", "")).toBeNull();
  });
});
