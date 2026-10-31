import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { Category } from "@/lib/category";
import { getPaymentSettings } from "@/lib/server/payments";
import { makeProduct, mockDialog, mockScreen, renderWithIntl } from "@/test/render";
import ShopChrome from "./ShopChrome";

// A Server Component: the catalogue and settings it loads are faked
const categories: Category[] = [
  { id: "body", name: "Body Care", slug: "body-care", parentId: null },
  { id: "hair", name: "Hair Care", slug: "hair-care", parentId: null },
];
vi.mock("@/lib/server/products", () => ({
  getCatalog: async () => [makeProduct({ categoryId: "body" })],
  getCategories: async () => categories,
}));
vi.mock("@/lib/server/announcement", () => ({
  getAnnouncement: async () => ({ enabled: true, messages: [{ text: "Free shipping" }], background: "#000000", textColor: "#ffffff", speed: "normal" }),
}));
vi.mock("@/lib/server/payments", () => ({ getPaymentSettings: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }) }));

beforeAll(mockDialog);
beforeEach(() => {
  mockScreen(false);
  vi.mocked(getPaymentSettings).mockResolvedValue({ razorpay: true, cod: false });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const show = async () => renderWithIntl(await ShopChrome({ children: <p>Page content</p> }));

describe("ShopChrome", () => {
  test("puts the announcement bar, header and footer around the page", async () => {
    await show();
    expect(screen.getByRole("region", { name: "Announcements" })).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Page content");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  test("the footer lists only main categories that have products", async () => {
    await show();
    expect(screen.getByRole("link", { name: "Body Care" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Hair Care" })).toBeNull();
  });

  test("with a payment method on there's a cart", async () => {
    const { container } = await show();
    expect(screen.getByRole("link", { name: "Cart" })).toBeInTheDocument();
    expect(container.querySelector("dialog")).not.toBeNull();
  });

  test("with no payment method on there's no cart at all", async () => {
    vi.mocked(getPaymentSettings).mockResolvedValue({ razorpay: false, cod: false });
    const { container } = await show();
    expect(screen.queryByRole("link", { name: "Cart" })).toBeNull();
    expect(container.querySelector("dialog")).toBeNull();
  });
});
