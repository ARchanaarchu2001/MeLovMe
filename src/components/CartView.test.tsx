import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { addToCart } from "@/lib/cart";
import { makeProduct, mockDialog, renderWithIntl, resetStores } from "@/test/render";
import CartView from "./CartView";

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav, usePathname: () => "/cart/" }));

// ₹1,000 lotion (2 for ₹1,800) and a ₹500 scrub
const lotion = makeProduct({ combos: [{ qty: 2, price: 1800 }] });
const scrub = makeProduct({ slug: "scrub", name: "Body Scrub", price: 500 });
const products = [lotion, scrub];

beforeAll(mockDialog);
beforeEach(() => nav.push.mockReset());
afterEach(() => {
  cleanup();
  resetStores(["body-lotion", "scrub", "gone"]);
});

const fill = (items: [string, number][]) => act(() => items.forEach(([slug, qty]) => addToCart(slug, qty, { notify: false })));
const cartQty = (slug: string) => JSON.parse(localStorage.getItem("melovme-cart") ?? "[]").find((i: { slug: string }) => i.slug === slug)?.qty ?? 0;
// The order summary's Total (the pinned phone bar repeats it)
const total = () => screen.getAllByText("Total")[0].nextElementSibling;
const checkoutButtons = () => screen.getAllByRole("button", { name: /Checkout/ });

describe("CartView", () => {
  test("an empty cart says so and links to the shop", () => {
    renderWithIntl(<CartView razorpay />, { products });
    expect(screen.getByText("Your cart is empty.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Shop Products" })).toBeInTheDocument();
  });

  test("lists each product with its line total and adds up the order", () => {
    fill([["body-lotion", 1], ["scrub", 3]]);
    renderWithIntl(<CartView razorpay />, { products });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    // ₹1,000 + 3 × ₹500 = ₹2,500
    expect(screen.getByText("₹1,500")).toBeInTheDocument();
    expect(total()).toHaveTextContent("₹2,500");
    expect(screen.getByText("2 of 2 selected", { selector: "span" })).toBeInTheDocument();
  });

  test("a combo quantity shows the combo price and what it saves", () => {
    fill([["body-lotion", 2]]);
    renderWithIntl(<CartView razorpay />, { products });
    expect(screen.getByText("Combo offer: you save ₹200")).toBeInTheDocument();
    expect(total()).toHaveTextContent("₹1,800");
    // Something on offer: the Checkout button carries the "Limited Offer" tag
    expect(checkoutButtons()[0]).toHaveTextContent("Limited Offer");
  });

  test("the stepper changes the quantity and the totals", async () => {
    const user = userEvent.setup();
    fill([["scrub", 1]]);
    renderWithIntl(<CartView razorpay />, { products });
    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(cartQty("scrub")).toBe(2);
    expect(total()).toHaveTextContent("₹1,000");
  });

  test("the stepper stops at the stock left", () => {
    const low = makeProduct({ slug: "scrub", name: "Body Scrub", price: 500, stock: 2 });
    fill([["scrub", 2]]);
    renderWithIntl(<CartView razorpay />, { products: [lotion, low] });
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
  });

  test("unticking an item leaves it out of the totals; none ticked disables Checkout", async () => {
    const user = userEvent.setup();
    fill([["body-lotion", 1], ["scrub", 1]]);
    renderWithIntl(<CartView razorpay />, { products });
    await user.click(screen.getByRole("checkbox", { name: "Select Body Lotion for checkout" }));
    expect(total()).toHaveTextContent("₹500");
    expect(screen.getByRole("checkbox", { name: "Select all" })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Select Body Scrub for checkout" }));
    expect(screen.getByText("Select at least one item to check out.")).toBeInTheDocument();
    checkoutButtons().forEach((b) => expect(b).toBeDisabled());
  });

  test("Select all ticks everything again", async () => {
    const user = userEvent.setup();
    fill([["body-lotion", 1], ["scrub", 1]]);
    renderWithIntl(<CartView razorpay />, { products });
    await user.click(screen.getByRole("checkbox", { name: "Select Body Lotion for checkout" }));
    await user.click(screen.getByRole("checkbox", { name: "Select all" }));
    expect(screen.getByRole("checkbox", { name: "Select Body Lotion for checkout" })).toBeChecked();
    expect(total()).toHaveTextContent("₹1,500");
  });

  test("Checkout goes to the checkout page", async () => {
    const user = userEvent.setup();
    fill([["scrub", 1]]);
    renderWithIntl(<CartView razorpay />, { products });
    await user.click(checkoutButtons()[0]);
    expect(nav.push).toHaveBeenCalledWith("/checkout/");
  });

  test("the bin asks first; Remove takes the item out", async () => {
    const user = userEvent.setup();
    fill([["body-lotion", 1], ["scrub", 1]]);
    renderWithIntl(<CartView razorpay />, { products });
    await user.click(screen.getByRole("button", { name: "Remove Body Scrub" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove" }));
    expect(cartQty("scrub")).toBe(0);
    expect(screen.queryByText("Body Scrub")).toBeNull();
  });

  test("Move to Wishlist takes it out of the cart and saves it", async () => {
    const user = userEvent.setup();
    fill([["scrub", 1]]);
    renderWithIntl(<CartView razorpay />, { products });
    await user.click(screen.getByRole("button", { name: "Remove Body Scrub" }));
    await user.click(screen.getByRole("button", { name: "Move to Wishlist" }));
    expect(cartQty("scrub")).toBe(0);
    expect(JSON.parse(localStorage.getItem("melovme-wishlist")!)).toEqual(["scrub"]);
    expect(screen.getByText("Your cart is empty.")).toBeInTheDocument();
  });

  test("an out-of-stock item is listed but left out of the order", () => {
    const gone = makeProduct({ slug: "gone", name: "Old Mist", stock: 0, inStock: false });
    fill([["scrub", 1], ["gone", 1]]);
    renderWithIntl(<CartView razorpay />, { products: [...products, gone] });
    expect(screen.getByText("Old Mist")).toBeInTheDocument();
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
    expect(screen.getByText("Out-of-stock items aren't included in your order.")).toBeInTheDocument();
    expect(total()).toHaveTextContent("₹500");
  });

  test("a product that's no longer sold isn't shown", () => {
    fill([["scrub", 1], ["gone", 1]]);
    renderWithIntl(<CartView razorpay />, { products });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});
