import { act, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { addToCart, onOpenCartDrawer } from "@/lib/cart";
import { addToWishlist } from "@/lib/wishlist";
import { makeProduct, mockScreen, renderWithIntl, resetStores } from "@/test/render";
import Header from "./Header";

const nav = vi.hoisted(() => ({ pathname: "/products/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname, useRouter: () => ({ push: vi.fn() }) }));

const lotion = makeProduct();
const scrub = makeProduct({ slug: "scrub", name: "Body Scrub" });
const products = [lotion, scrub];
const fetchMock = vi.fn();

beforeEach(() => {
  nav.pathname = "/products/";
  mockScreen(false);
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ admin: false }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetStores(["body-lotion", "scrub"]);
});

describe("Header", () => {
  test("marks the current page in the menu", () => {
    renderWithIntl(<Header />, { products });
    const [products_] = screen.getAllByRole("link", { name: "Products" });
    expect(products_).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link", { name: "Home" })[0]).not.toHaveAttribute("aria-current");
  });

  test("the cart and wishlist icons show how many items they hold", () => {
    act(() => {
      addToCart("body-lotion", 2, { notify: false });
      addToCart("scrub", 1, { notify: false });
      addToWishlist("scrub");
    });
    renderWithIntl(<Header />, { products });
    expect(screen.getByRole("link", { name: "Cart, 3 items" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wishlist, 1 item" })).toBeInTheDocument();
  });

  test("empty cart and wishlist icons have plain labels", () => {
    renderWithIntl(<Header />, { products });
    expect(screen.getByRole("link", { name: "Cart" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wishlist" })).toBeInTheDocument();
  });

  test("there's no cart icon when no payment method is on", () => {
    renderWithIntl(<Header />, { products, canBuy: false });
    expect(screen.queryByRole("link", { name: /^Cart/ })).toBeNull();
  });

  test("admins get an Admin link", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ admin: true }) });
    renderWithIntl(<Header />, { products });
    await waitFor(() => expect(screen.getAllByRole("link", { name: "Admin" }).length).toBeGreaterThan(0));
    expect(fetchMock).toHaveBeenCalledWith("/api/me/");
  });

  test("customers get no Admin link", async () => {
    renderWithIntl(<Header />, { products });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
  });

  test("the menu button opens and closes the phone menu; Escape closes it too", async () => {
    const user = userEvent.setup();
    renderWithIntl(<Header />, { products });
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
  });

  test("on a phone the cart icon opens the slide-in cart instead of the cart page", async () => {
    mockScreen(true);
    const opened = vi.fn();
    const stop = onOpenCartDrawer(opened);
    const user = userEvent.setup();
    renderWithIntl(<Header />, { products });
    await user.click(screen.getByRole("link", { name: "Cart" }));
    expect(opened).toHaveBeenCalled();
    stop();
  });

  test("on the cart page the cart icon doesn't open the slide-in cart", async () => {
    mockScreen(true);
    nav.pathname = "/cart/";
    const opened = vi.fn();
    const stop = onOpenCartDrawer(opened);
    const user = userEvent.setup();
    renderWithIntl(<Header />, { products });
    await user.click(screen.getByRole("link", { name: "Cart" }));
    expect(opened).not.toHaveBeenCalled();
    stop();
  });
});
