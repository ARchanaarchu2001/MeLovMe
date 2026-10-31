import { act, renderHook } from "@testing-library/react";
import { createElement, type ComponentProps, type ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Product } from "./product";

const product = (slug: string): Product => ({
  slug,
  name: slug,
  categoryId: "body",
  category: "Body Care",
  size: "200 ml",
  price: 500,
  shortDescription: "",
  description: "",
  images: [],
  highlights: [],
  ingredients: [],
  howToUse: "",
  enabled: true,
  stock: null,
  inStock: true,
  offer: null,
  combos: [],
});

// The wishlist and cart keep their lists in memory once read, so each test loads fresh copies
let wishlist: typeof import("./wishlist");
let cart: typeof import("./cart");
let Catalog: typeof import("@/components/CatalogProvider");
beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  wishlist = await import("./wishlist");
  cart = await import("./cart");
  Catalog = await import("@/components/CatalogProvider"); // the same copy the wishlist reads from
});

const savedWishlist = () => JSON.parse(localStorage.getItem("melovme-wishlist") ?? "[]");
const savedCart = () => JSON.parse(localStorage.getItem("melovme-cart") ?? "[]");

describe("saving products: addToWishlist / removeFromWishlist", () => {
  test("adds a product to the wishlist", () => {
    wishlist.addToWishlist("mist");
    expect(savedWishlist()).toEqual(["mist"]);
  });

  test("a product is only saved once", () => {
    wishlist.addToWishlist("mist");
    wishlist.addToWishlist("mist");
    expect(savedWishlist()).toEqual(["mist"]);
  });

  test("removes a product and keeps the rest", () => {
    wishlist.addToWishlist("mist");
    wishlist.addToWishlist("lotion");
    wishlist.removeFromWishlist("mist");
    expect(savedWishlist()).toEqual(["lotion"]);
  });
});

describe("the heart button: toggleWishlist", () => {
  test("saves a product that isn't saved", () => {
    wishlist.toggleWishlist("mist");
    expect(savedWishlist()).toEqual(["mist"]);
  });

  test("unsaves a product that is saved", () => {
    wishlist.addToWishlist("mist");
    wishlist.toggleWishlist("mist");
    expect(savedWishlist()).toEqual([]);
  });
});

describe("moving between cart and wishlist", () => {
  test("save for later takes the product out of the cart and into the wishlist", () => {
    cart.addToCart("mist", 2);
    cart.addToCart("lotion");
    wishlist.moveToWishlist("mist");
    expect(savedWishlist()).toEqual(["mist"]);
    expect(savedCart()).toEqual([{ slug: "lotion", qty: 1 }]);
  });

  test("move to cart puts one piece in the cart and takes it off the wishlist", () => {
    wishlist.addToWishlist("mist");
    wishlist.moveToCart("mist");
    expect(savedCart()).toEqual([{ slug: "mist", qty: 1 }]);
    expect(savedWishlist()).toEqual([]);
  });

  test("move to cart adds to a product already in the cart", () => {
    cart.addToCart("mist", 2);
    wishlist.addToWishlist("mist");
    wishlist.moveToCart("mist");
    expect(savedCart()).toEqual([{ slug: "mist", qty: 3 }]);
  });
});

describe("saved wishlist data", () => {
  test("keeps only product names, once each", () => {
    localStorage.setItem("melovme-wishlist", JSON.stringify(["mist", 5, null, "mist", "lotion"]));
    wishlist.addToWishlist("soap");
    expect(savedWishlist()).toEqual(["mist", "lotion", "soap"]);
  });

  test("a damaged saved wishlist starts again empty", () => {
    localStorage.setItem("melovme-wishlist", "{broken");
    wishlist.addToWishlist("mist");
    expect(savedWishlist()).toEqual(["mist"]);
  });
});

describe("what the wishlist shows: useWishlist", () => {
  const catalog = [product("mist"), product("lotion")];
  const wrapper = ({ children }: { children: ReactNode }) => createElement(Catalog.CatalogProvider, { products: catalog, canBuy: true } as ComponentProps<typeof Catalog.CatalogProvider>, children);
  const renderWishlist = () => renderHook(() => wishlist.useWishlist(), { wrapper }).result;

  test("an empty wishlist shows nothing", () => {
    expect(renderWishlist().current).toMatchObject({ ready: true, products: [], count: 0 });
  });

  test("shows saved products in the order they were saved", () => {
    wishlist.addToWishlist("lotion");
    wishlist.addToWishlist("mist");
    expect(renderWishlist().current.products.map((p) => p.slug)).toEqual(["lotion", "mist"]);
  });

  test("products no longer in the shop are skipped and not counted", () => {
    wishlist.addToWishlist("discontinued");
    wishlist.addToWishlist("mist");
    const result = renderWishlist();
    expect(result.current.products.map((p) => p.slug)).toEqual(["mist"]);
    expect(result.current.count).toBe(1);
  });

  test("says whether a product is saved", () => {
    wishlist.addToWishlist("mist");
    const result = renderWishlist();
    expect(result.current.has("mist")).toBe(true);
    expect(result.current.has("lotion")).toBe(false);
  });

  test("updates as soon as a product is saved", () => {
    const result = renderWishlist();
    act(() => wishlist.addToWishlist("lotion"));
    expect(result.current.count).toBe(1);
  });
});
