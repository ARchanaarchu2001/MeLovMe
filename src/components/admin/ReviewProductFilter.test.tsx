import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import ReviewProductFilter from "./ReviewProductFilter";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const products = [
  { slug: "rose-mist", name: "Rose Body Mist" },
  { slug: "lip-balm", name: "Lip Balm" },
];
// The list URL the filter opened, as search params
const pushed = () => new URL(router.push.mock.calls[0][0], "https://shop.test").searchParams;

describe("ReviewProductFilter", () => {
  test("starts on All products when no product is chosen", () => {
    render(<ReviewProductFilter products={products} value="" view="all" q="" />);
    expect(screen.getByRole("button", { name: "All products" })).toBeInTheDocument();
  });

  test("picking a product reloads the list for it, keeping the tab and search", async () => {
    const user = userEvent.setup();
    render(<ReviewProductFilter products={products} value="" view="hidden" q="smell" />);
    await user.click(screen.getByRole("button", { name: "All products" }));
    await user.click(screen.getByRole("option", { name: /Lip Balm/ }));
    expect(router.push.mock.calls[0][0]).toMatch(/^\/admin\/reviews\/\?/);
    expect(Object.fromEntries(pushed())).toEqual({ view: "hidden", q: "smell", product: "lip-balm" });
  });

  test("without a search, no empty q is added", async () => {
    const user = userEvent.setup();
    render(<ReviewProductFilter products={products} value="" view="all" q="" />);
    await user.click(screen.getByRole("button", { name: "All products" }));
    await user.click(screen.getByRole("option", { name: /Rose Body Mist/ }));
    expect(Object.fromEntries(pushed())).toEqual({ view: "all", product: "rose-mist" });
  });

  test("going back to All products drops the product from the URL", async () => {
    const user = userEvent.setup();
    render(<ReviewProductFilter products={products} value="lip-balm" view="all" q="" />);
    await user.click(screen.getByRole("button", { name: "Lip Balm" }));
    await user.click(screen.getByRole("option", { name: "All products" }));
    expect(Object.fromEntries(pushed())).toEqual({ view: "all" });
  });
});
