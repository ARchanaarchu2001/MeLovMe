import { act, renderHook } from "@testing-library/react";
import { createElement, type ComponentProps, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Product } from "./product";

// The shop's real settings ship free for now; use a ₹99 fee, free from ₹2,000, to test the totals
vi.mock("@/data/site", () => ({ site: { shipping: { fee: 99, freeAbove: 2000 } } }));

// A fixed "today" for offer prices
const NOW = Date.parse("2026-06-15T12:00:00+05:30");

const product = (slug: string, change: Partial<Product> = {}): Product => ({
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
  ...change,
});

// ₹1,550 a piece, 2 for ₹3,000, 3 for ₹4,350
const lotion = product("lotion", {
  price: 1550,
  combos: [
    { qty: 2, price: 3000 },
    { qty: 3, price: 4350 },
  ],
});
const mist = product("mist"); // ₹500
const soap = product("soap", { price: 200, stock: 2 }); // only 2 left
const scrub = product("scrub", { stock: 0, inStock: false });
const serum = product("serum", { price: 1000, offer: { type: "percent", value: 20 } }); // ₹800 today

// The cart keeps its list in memory once read, so each test loads a fresh copy of the module
let cart: typeof import("./cart");
let Catalog: typeof import("@/components/CatalogProvider");
beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  cart = await import("./cart");
  Catalog = await import("@/components/CatalogProvider"); // the same copy the cart reads from
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const savedCart = () => JSON.parse(localStorage.getItem("melovme-cart") ?? "[]");
const savedUnselected = () => JSON.parse(localStorage.getItem("melovme-cart-unselected") ?? "[]");

describe("adding to the cart: addToCart", () => {
  test("adds one piece of a new product", () => {
    cart.addToCart("mist");
    expect(savedCart()).toEqual([{ slug: "mist", qty: 1 }]);
  });

  test("adding a product again adds to the quantity already in the cart", () => {
    cart.addToCart("mist", 2);
    cart.addToCart("mist", 3);
    expect(savedCart()).toEqual([{ slug: "mist", qty: 5 }]);
  });

  test("never holds more than 10 of a product", () => {
    cart.addToCart("mist", 8);
    cart.addToCart("mist", 5);
    expect(savedCart()).toEqual([{ slug: "mist", qty: 10 }]);
  });

  test("a new product added with too many pieces is capped at 10", () => {
    cart.addToCart("mist", 12);
    expect(savedCart()).toEqual([{ slug: "mist", qty: 10 }]);
  });

  test("picking a combo sets the exact quantity instead of adding to it", () => {
    cart.addToCart("lotion", 3);
    cart.addToCart("lotion", 2, { exact: true });
    expect(savedCart()).toEqual([{ slug: "lotion", qty: 2 }]);
  });

  test("tells the 'added to cart' pop-up which product was added", () => {
    const listener = vi.fn();
    cart.onAddedToCart(listener);
    cart.addToCart("mist");
    expect(listener).toHaveBeenCalledWith("mist");
  });

  test("can add quietly, without the pop-up", () => {
    const listener = vi.fn();
    cart.onAddedToCart(listener);
    cart.addToCart("mist", 1, { notify: false });
    expect(listener).not.toHaveBeenCalled();
  });

  test("a pop-up that stopped listening isn't told", () => {
    const listener = vi.fn();
    const stop = cart.onAddedToCart(listener);
    stop();
    cart.addToCart("mist");
    expect(listener).not.toHaveBeenCalled();
  });

  test("adding an unticked product again ticks it again", () => {
    cart.addToCart("mist");
    cart.setSelected(["mist"], false);
    cart.addToCart("mist");
    expect(savedUnselected()).toEqual([]);
  });
});

describe("changing quantities: setQty", () => {
  test("sets the quantity of a product in the cart", () => {
    cart.addToCart("mist", 4);
    cart.setQty("mist", 2);
    expect(savedCart()).toEqual([{ slug: "mist", qty: 2 }]);
  });

  test("a quantity above 10 is capped at 10", () => {
    cart.addToCart("mist");
    cart.setQty("mist", 15);
    expect(savedCart()).toEqual([{ slug: "mist", qty: 10 }]);
  });

  test("a quantity of 0 takes the product out of the cart", () => {
    cart.addToCart("mist");
    cart.addToCart("lotion");
    cart.setQty("mist", 0);
    expect(savedCart()).toEqual([{ slug: "lotion", qty: 1 }]);
  });

  test("a product taken out isn't remembered as unticked", () => {
    cart.addToCart("mist");
    cart.setSelected(["mist"], false);
    cart.setQty("mist", 0);
    expect(savedUnselected()).toEqual([]);
  });

  test("setting the quantity of a product not in the cart doesn't add it", () => {
    cart.setQty("mist", 3);
    expect(savedCart()).toEqual([]);
  });
});

describe("after an order: removeFromCart", () => {
  test("takes out the ordered products and leaves the rest", () => {
    cart.addToCart("mist");
    cart.addToCart("lotion", 2);
    cart.addToCart("soap");
    cart.removeFromCart(["mist", "soap"]);
    expect(savedCart()).toEqual([{ slug: "lotion", qty: 2 }]);
  });
});

describe("ticking cart lines: setSelected", () => {
  test("unticking remembers the products left out", () => {
    cart.setSelected(["mist", "soap"], false);
    expect(savedUnselected()).toEqual(["mist", "soap"]);
  });

  test("ticking again forgets them", () => {
    cart.setSelected(["mist", "soap"], false);
    cart.setSelected(["mist"], true);
    expect(savedUnselected()).toEqual(["soap"]);
  });

  test("unticking the same product twice lists it once", () => {
    cart.setSelected(["mist"], false);
    cart.setSelected(["mist"], false);
    expect(savedUnselected()).toEqual(["mist"]);
  });
});

describe("saved cart data", () => {
  test("keeps only well-formed items and caps quantities at 10", () => {
    localStorage.setItem(
      "melovme-cart",
      JSON.stringify([
        { slug: "mist", qty: 2 },
        { slug: 5, qty: 1 }, // slug isn't text
        { slug: "soap", qty: 0 }, // nothing to buy
        { slug: "serum", qty: 1.5 }, // not a whole number
        { slug: "lotion", qty: 50 }, // too many
        null,
      ]),
    );
    cart.addToCart("scrub", 1, { notify: false });
    expect(savedCart()).toEqual([
      { slug: "mist", qty: 2 },
      { slug: "lotion", qty: 10 },
      { slug: "scrub", qty: 1 },
    ]);
  });

  test("a damaged saved cart starts again empty", () => {
    localStorage.setItem("melovme-cart", "not json");
    cart.addToCart("mist");
    expect(savedCart()).toEqual([{ slug: "mist", qty: 1 }]);
  });
});

describe("slide-in cart", () => {
  test("opening the cart tells the slide-in cart to open", () => {
    const open = vi.fn();
    cart.onOpenCartDrawer(open);
    cart.openCartDrawer();
    expect(open).toHaveBeenCalledOnce();
  });

  test("a slide-in cart that stopped listening isn't opened", () => {
    const open = vi.fn();
    const stop = cart.onOpenCartDrawer(open);
    stop();
    cart.openCartDrawer();
    expect(open).not.toHaveBeenCalled();
  });

  test("phones (narrower than 768px) use the slide-in cart", () => {
    const matchMedia = vi.fn((query: string) => ({ matches: query === "(max-width: 767px)" }));
    vi.stubGlobal("matchMedia", matchMedia);
    expect(cart.isMobileView()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
  });

  test("larger screens don't", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(cart.isMobileView()).toBe(false);
  });
});

describe("what the cart shows: useCart", () => {
  const catalog = [lotion, mist, soap, scrub, serum];
  const wrapper = ({ children }: { children: ReactNode }) => createElement(Catalog.CatalogProvider, { products: catalog, canBuy: true } as ComponentProps<typeof Catalog.CatalogProvider>, children);
  const renderCart = () => renderHook(() => cart.useCart(), { wrapper }).result;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  test("an empty cart has no lines and no subtotal", () => {
    const result = renderCart();
    expect(result.current).toMatchObject({ ready: true, lines: [], count: 0, subtotal: 0 });
  });

  // Suspected bug: with nothing selected the delivery fee is still added (total ₹99 for nothing)
  test.todo("an empty cart, or one with every line unticked, charges no delivery fee");

  test("a cart line uses combo prices and shows what they saved", () => {
    cart.addToCart("lotion", 3);
    const [line] = renderCart().current.lines;
    // 3 for ₹4,350 instead of 3 × ₹1,550 = ₹4,650
    expect(line).toMatchObject({ qty: 3, price: 1550, mrp: 1550, total: 4350, comboSaving: 300, selected: true });
  });

  test("a cart line shows the offer price and the regular price", () => {
    cart.addToCart("serum");
    const [line] = renderCart().current.lines;
    expect(line).toMatchObject({ price: 800, mrp: 1000, total: 800 });
  });

  test("small orders pay the delivery fee", () => {
    cart.addToCart("lotion"); // ₹1,550, below ₹2,000
    expect(renderCart().current).toMatchObject({ subtotal: 1550, shipping: 99, total: 1649 });
  });

  test("bigger orders ship free", () => {
    cart.addToCart("lotion"); // ₹1,550
    cart.addToCart("mist"); // + ₹500 = ₹2,050
    expect(renderCart().current).toMatchObject({ subtotal: 2050, shipping: 0, total: 2050 });
  });

  test("unticked lines stay in the cart but aren't charged", () => {
    cart.addToCart("lotion");
    cart.addToCart("mist");
    cart.setSelected(["mist"], false);
    const result = renderCart();
    expect(result.current.lines).toHaveLength(2);
    expect(result.current.selected.map((l) => l.product.slug)).toEqual(["lotion"]);
    // only the lotion: ₹1,550 + ₹99 delivery
    expect(result.current).toMatchObject({ subtotal: 1550, shipping: 99, total: 1649 });
  });

  test("the item count includes unticked lines", () => {
    cart.addToCart("lotion", 2);
    cart.addToCart("mist", 3);
    cart.setSelected(["mist"], false);
    expect(renderCart().current.count).toBe(5);
  });

  test("products no longer in the shop are skipped", () => {
    cart.addToCart("discontinued");
    cart.addToCart("mist");
    expect(renderCart().current.lines.map((l) => l.product.slug)).toEqual(["mist"]);
  });

  test("out-of-stock products are listed separately and not charged", () => {
    cart.addToCart("scrub");
    cart.addToCart("mist");
    const result = renderCart();
    expect(result.current.outOfStock.map((p) => p.slug)).toEqual(["scrub"]);
    expect(result.current.lines.map((l) => l.product.slug)).toEqual(["mist"]);
    expect(result.current.subtotal).toBe(500);
  });

  test("never charges for more pieces than are in stock", () => {
    cart.addToCart("soap", 5); // only 2 left
    const [line] = renderCart().current.lines;
    expect(line).toMatchObject({ qty: 2, total: 400 });
  });

  test("updates as soon as something is added", () => {
    const result = renderCart();
    act(() => cart.addToCart("mist", 2));
    expect(result.current).toMatchObject({ count: 2, subtotal: 1000 });
  });
});
