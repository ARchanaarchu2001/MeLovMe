import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { addToCart, openCartDrawer } from "@/lib/cart";
import { makeProduct, mockDialog, mockScreen, renderWithIntl, resetStores } from "@/test/render";
import CartDrawer from "./CartDrawer";

const nav = vi.hoisted(() => ({ push: vi.fn(), pathname: "/products/" }));
vi.mock("next/navigation", () => ({ useRouter: () => nav, usePathname: () => nav.pathname }));

const lotion = makeProduct();
const scrub = makeProduct({ slug: "scrub", name: "Body Scrub", price: 500 });
const products = [lotion, scrub];

beforeAll(mockDialog);
beforeEach(() => {
  nav.push.mockReset();
  nav.pathname = "/products/";
  mockScreen(true);
});
afterEach(() => {
  cleanup();
  resetStores(["body-lotion", "scrub"]);
});

// The drawer is a <dialog>: hidden from the accessibility tree until opened
const drawer = () => screen.queryByRole("dialog", { name: /Your Cart/ });
const add = (slug: string, notify = true) => act(() => addToCart(slug, 1, { notify }));
const cartQty = (slug: string) => JSON.parse(localStorage.getItem("melovme-cart") ?? "[]").find((i: { slug: string }) => i.slug === slug)?.qty ?? 0;

describe("CartDrawer", () => {
  test("is closed to begin with", () => {
    renderWithIntl(<CartDrawer razorpay />, { products });
    expect(drawer()).toBeNull();
  });

  test("opens from the header's cart icon, showing an empty cart", () => {
    renderWithIntl(<CartDrawer razorpay />, { products });
    act(() => openCartDrawer());
    expect(drawer()).toBeInTheDocument();
    expect(screen.getByText("Your cart is empty.")).toBeInTheDocument();
  });

  test("on a phone, adding a product opens it with the product and the total", () => {
    renderWithIntl(<CartDrawer razorpay />, { products });
    add("scrub");
    expect(drawer()).toHaveTextContent("Your Cart(1)");
    expect(within(drawer()!).getByText("Body Scrub")).toBeInTheDocument();
    expect(screen.getAllByText("Total")[0].nextElementSibling).toHaveTextContent("₹500");
  });

  test("on a computer, adding a product doesn't open it", () => {
    mockScreen(false);
    renderWithIntl(<CartDrawer razorpay />, { products });
    add("scrub");
    expect(drawer()).toBeNull();
  });

  test("on the cart page, adding a product doesn't open it", () => {
    nav.pathname = "/cart/";
    renderWithIntl(<CartDrawer razorpay />, { products });
    add("scrub");
    expect(drawer()).toBeNull();
  });

  test("the close button closes it", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CartDrawer razorpay />, { products });
    add("scrub");
    await user.click(screen.getByRole("button", { name: "Close cart" }));
    expect(drawer()).toBeNull();
  });

  test("the stepper changes the quantity", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CartDrawer razorpay />, { products });
    add("scrub");
    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(cartQty("scrub")).toBe(2);
    expect(screen.getAllByText("Total")[0].nextElementSibling).toHaveTextContent("₹1,000");
  });

  test("unticking every item disables Checkout", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CartDrawer razorpay />, { products });
    add("scrub");
    await user.click(screen.getByRole("checkbox", { name: "Select Body Scrub for checkout" }));
    expect(screen.getByText("Select at least one item to check out.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Checkout/ })).toBeDisabled();
  });

  test("Checkout goes to the checkout page", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CartDrawer razorpay />, { products });
    add("scrub");
    await user.click(screen.getByRole("button", { name: /Checkout/ }));
    expect(nav.push).toHaveBeenCalledWith("/checkout/");
  });

  test("removing an item asks first, then takes it out", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CartDrawer razorpay />, { products });
    add("body-lotion", false);
    add("scrub");
    await user.click(screen.getByRole("button", { name: "Remove Body Scrub" }));
    await user.click(within(screen.getByRole("dialog", { name: "Remove item?" })).getByRole("button", { name: "Remove" }));
    expect(cartQty("scrub")).toBe(0);
    expect(cartQty("body-lotion")).toBe(1);
  });

  test("moving to another page closes it", () => {
    const { rerender } = renderWithIntl(<CartDrawer razorpay />, { products });
    add("scrub");
    nav.pathname = "/checkout/";
    rerender(<CartDrawer razorpay />);
    expect(drawer()).toBeNull();
  });
});
