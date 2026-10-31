import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Product } from "@/lib/product";
import { makeProduct, renderWithIntl, resetStores } from "@/test/render";
import AddToCart from "./AddToCart";

const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav, usePathname: () => "/products/body-lotion/" }));

beforeEach(() => nav.push.mockReset());
afterEach(() => {
  cleanup();
  resetStores(["body-lotion"]);
});

const cartQty = () => JSON.parse(localStorage.getItem("melovme-cart") ?? "[]").find((i: { slug: string }) => i.slug === "body-lotion")?.qty ?? 0;

// ₹1,000 each; 2 for ₹1,800, 3 for ₹2,550
const withCombos = (overrides: Partial<Product> = {}) =>
  makeProduct({ combos: [{ qty: 2, price: 1800, tag: "popular" }, { qty: 3, price: 2550, tag: "best" }], ...overrides });

function show(product: Product, { canBuy = true } = {}) {
  return renderWithIntl(<AddToCart slug={product.slug} inStock={product.inStock} stock={product.stock} razorpay />, { products: [product], canBuy });
}

describe("AddToCart", () => {
  test("a product in stock says In stock and has Add to Cart and Buy Now", () => {
    show(makeProduct({ stock: 50 }));
    expect(screen.getByText("In stock")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to Cart" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Buy Now/ })).toBeInTheDocument();
  });

  test("with 5 or fewer left it says how many", () => {
    show(makeProduct({ stock: 3 }));
    expect(screen.getByText("Only 3 left — order soon")).toBeInTheDocument();
  });

  test("an out-of-stock product has no buttons, just the message", () => {
    show(makeProduct({ stock: 0, inStock: false }));
    expect(screen.getByText("Out of Stock")).toBeInTheDocument();
    expect(screen.getByText(/currently out of stock/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("with no payment method on only the stock line is shown", () => {
    show(makeProduct(), { canBuy: false });
    expect(screen.getByText("In stock")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("Buy Now puts one in the cart and goes to checkout", async () => {
    const user = userEvent.setup();
    show(makeProduct());
    await user.click(screen.getByRole("button", { name: /Buy Now/ }));
    expect(cartQty()).toBe(1);
    expect(nav.push).toHaveBeenCalledWith("/checkout/");
  });

  test("Buy Now doesn't add another one when it's already in the cart", async () => {
    const user = userEvent.setup();
    show(makeProduct());
    await user.click(screen.getByRole("button", { name: "Add to Cart" }));
    await user.click(screen.getByRole("button", { name: /Buy Now/ }));
    expect(cartQty()).toBe(1);
  });

  test("once in the cart there's a stepper and Go to Cart", async () => {
    const user = userEvent.setup();
    show(makeProduct());
    await user.click(screen.getByRole("button", { name: "Add to Cart" }));
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to Cart/ })).toBeInTheDocument();
  });

  test("the stepper stops at the stock left", async () => {
    const user = userEvent.setup();
    show(makeProduct({ stock: 2 }));
    await user.click(screen.getByRole("button", { name: "Add to Cart" }));
    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
    expect(cartQty()).toBe(2);
  });
});

describe("AddToCart with combo offers", () => {
  test("lists 1, 2 and 3 pieces with their prices and savings", () => {
    show(withCombos());
    expect(screen.getByRole("group", { name: "Combo offers" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /1 Piece.*Standard price.*₹1,000/ })).toBeChecked();
    // 2 × ₹1,000 = ₹2,000 → ₹1,800 saves ₹200 (10%)
    expect(screen.getByRole("radio", { name: /2 Pieces.*Save ₹200.*You save 10%.*₹1,800.*₹2,000.*Most popular/ })).toBeInTheDocument();
    // 3 × ₹1,000 = ₹3,000 → ₹2,550 saves ₹450 (15%)
    expect(screen.getByRole("radio", { name: /3 Pieces.*Save ₹450.*You save 15%.*₹2,550.*Best value/ })).toBeInTheDocument();
  });

  test("Add to Cart puts exactly the picked number of pieces in the cart", async () => {
    const user = userEvent.setup();
    show(withCombos());
    await user.click(screen.getByRole("radio", { name: /2 Pieces/ }));
    await user.click(screen.getByRole("button", { name: "Add to Cart" }));
    expect(cartQty()).toBe(2);
    expect(screen.getByText(/2 pieces in your cart/)).toBeInTheDocument();
  });

  test("picking a different number once in the cart offers to update the cart to it", async () => {
    const user = userEvent.setup();
    show(withCombos());
    await user.click(screen.getByRole("radio", { name: /2 Pieces/ }));
    await user.click(screen.getByRole("button", { name: "Add to Cart" }));
    await user.click(screen.getByRole("radio", { name: /3 Pieces/ }));
    await user.click(screen.getByRole("button", { name: "Update cart to 3" }));
    expect(cartQty()).toBe(3);
  });

  test("Buy Now buys the picked number of pieces", async () => {
    const user = userEvent.setup();
    show(withCombos());
    await user.click(screen.getByRole("radio", { name: /3 Pieces/ }));
    await user.click(screen.getByRole("button", { name: /Buy Now/ }));
    expect(cartQty()).toBe(3);
    expect(nav.push).toHaveBeenCalledWith("/checkout/");
  });

  test("combos needing more pieces than are in stock aren't offered", () => {
    show(withCombos({ stock: 2 }));
    expect(screen.getByRole("radio", { name: /2 Pieces/ })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /3 Pieces/ })).toBeNull();
  });

  test("with only 1 in stock there's no combo picker at all", () => {
    show(withCombos({ stock: 1 }));
    expect(screen.queryByRole("group", { name: "Combo offers" })).toBeNull();
  });
});
