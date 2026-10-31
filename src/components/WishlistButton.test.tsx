import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { makeProduct, renderWithIntl, resetStores } from "@/test/render";
import WishlistButton from "./WishlistButton";

const lotion = makeProduct();
afterEach(() => {
  cleanup();
  resetStores([lotion.slug]);
});

describe("WishlistButton", () => {
  test("a product not saved yet offers Add to wishlist", () => {
    renderWithIntl(<WishlistButton slug={lotion.slug} />, { products: [lotion] });
    expect(screen.getByRole("button", { name: "Add to wishlist" })).toHaveAttribute("aria-pressed", "false");
  });

  test("clicking saves it, and clicking again takes it out", async () => {
    const user = userEvent.setup();
    renderWithIntl(<WishlistButton slug={lotion.slug} />, { products: [lotion] });
    await user.click(screen.getByRole("button", { name: "Add to wishlist" }));
    const saved = screen.getByRole("button", { name: "Remove from wishlist" });
    expect(saved).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(localStorage.getItem("melovme-wishlist")!)).toEqual([lotion.slug]);
    await user.click(saved);
    expect(screen.getByRole("button", { name: "Add to wishlist" })).toBeInTheDocument();
  });
});
