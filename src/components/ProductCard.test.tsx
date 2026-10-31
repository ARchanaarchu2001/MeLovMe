import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { makeProduct, renderWithIntl, resetStores } from "@/test/render";
import ProductCard from "./ProductCard";

// "Today" is 15 June 2026, India time
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-15T12:00:00+05:30"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetStores(["body-lotion"]);
});

describe("ProductCard", () => {
  test("shows the photo, category, name, size and price, linking to the product page", () => {
    const p = makeProduct();
    renderWithIntl(<ProductCard product={p} />, { products: [p] });
    expect(screen.getByRole("img", { name: "Body Lotion" })).toBeInTheDocument();
    expect(screen.getByText("Body Care")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Body Lotion · 200 ml/ })).toBeInTheDocument();
    expect(screen.getByText("₹1,000")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Details" }).getAttribute("href")).toMatch(/^\/products\/body-lotion\/?$/);
  });

  test("has wishlist, Add to Cart and WhatsApp buttons", () => {
    const p = makeProduct();
    renderWithIntl(<ProductCard product={p} />, { products: [p] });
    expect(screen.getByRole("button", { name: "Add to wishlist" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to Cart" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ask about Body Lotion on WhatsApp" })).toBeInTheDocument();
  });

  test("a running offer shows the badge, the saving and the days left", () => {
    const p = makeProduct({ offer: { type: "percent", value: 20, endsAt: "2026-06-17T23:59:59+05:30" } });
    renderWithIntl(<ProductCard product={p} />, { products: [p] });
    expect(screen.getByText("20% off")).toBeInTheDocument();
    expect(screen.getByText("₹800")).toBeInTheDocument();
    expect(screen.getByText("Save ₹200")).toBeInTheDocument();
    expect(screen.getByText("2 days left")).toBeInTheDocument();
  });

  test("a product with a combo deal says combo offers are available", () => {
    const p = makeProduct({ combos: [{ qty: 2, price: 1800 }] });
    renderWithIntl(<ProductCard product={p} />, { products: [p] });
    expect(screen.getByText("Combo offers available")).toBeInTheDocument();
  });

  test("a combo that saves nothing isn't advertised", () => {
    const p = makeProduct({ combos: [{ qty: 2, price: 2000 }] });
    renderWithIntl(<ProductCard product={p} />, { products: [p] });
    expect(screen.queryByText("Combo offers available")).toBeNull();
  });

  test("an out-of-stock product says so on the photo and can't be added", () => {
    const p = makeProduct({ stock: 0, inStock: false });
    renderWithIntl(<ProductCard product={p} />, { products: [p] });
    expect(screen.getAllByText("Out of Stock")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Out of Stock" })).toBeDisabled();
  });
});
