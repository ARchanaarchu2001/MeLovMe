import { act, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { addToCart } from "@/lib/cart";
import { makeProduct, mockScreen, renderWithIntl, resetStores } from "@/test/render";
import CartToast from "./CartToast";

const nav = vi.hoisted(() => ({ pathname: "/products/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname, useRouter: () => ({ push: vi.fn() }) }));

const lotion = makeProduct();
beforeEach(() => {
  nav.pathname = "/products/";
  mockScreen(false);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetStores([lotion.slug]);
});

const add = () => act(() => addToCart(lotion.slug));

describe("CartToast", () => {
  test("nothing is shown until something is added", () => {
    renderWithIntl(<CartToast />, { products: [lotion] });
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("adding a product shows it with a View Cart link", () => {
    renderWithIntl(<CartToast />, { products: [lotion] });
    add();
    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("Added to cart");
    expect(toast).toHaveTextContent("Body Lotion");
    expect(screen.getByRole("link", { name: "View Cart" }).getAttribute("href")).toMatch(/^\/cart\/?$/);
  });

  test("the close button hides it", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CartToast />, { products: [lotion] });
    add();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("it hides by itself after 4 seconds", () => {
    vi.useFakeTimers();
    renderWithIntl(<CartToast />, { products: [lotion] });
    add();
    act(() => vi.advanceTimersByTime(3900));
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("on phones it isn't shown (the slide-in cart opens instead)", () => {
    mockScreen(true);
    renderWithIntl(<CartToast />, { products: [lotion] });
    add();
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("it isn't shown on the cart page", () => {
    nav.pathname = "/cart/";
    renderWithIntl(<CartToast />, { products: [lotion] });
    add();
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("moving to another page closes it", () => {
    const { rerender } = renderWithIntl(<CartToast />, { products: [lotion] });
    add();
    nav.pathname = "/about/";
    rerender(<CartToast />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
