import { act, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { addToWishlist } from "@/lib/wishlist";
import { makeProduct, renderWithIntl, resetStores } from "@/test/render";
import WishlistView from "./WishlistView";

const lotion = makeProduct();
const scrub = makeProduct({ slug: "scrub", name: "Body Scrub", price: 500, stock: 0, inStock: false });
const products = [lotion, scrub];

afterEach(() => {
  cleanup();
  resetStores(["body-lotion", "scrub", "gone"]);
});

const save = (...slugs: string[]) => act(() => slugs.forEach(addToWishlist));
const stored = (key: string) => JSON.parse(localStorage.getItem(key) ?? "[]");

describe("WishlistView", () => {
  test("an empty wishlist says so and links to the shop", () => {
    renderWithIntl(<WishlistView />, { products });
    expect(screen.getByText("Your wishlist is empty.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Shop Products" })).toBeInTheDocument();
  });

  test("lists saved products with their size and price", () => {
    save("body-lotion");
    renderWithIntl(<WishlistView />, { products });
    // The photo and the name both link to the product page
    expect(screen.getAllByRole("link", { name: "Body Lotion" })[1].getAttribute("href")).toMatch(/^\/products\/body-lotion\/?$/);
    expect(screen.getByText("200 ml")).toBeInTheDocument();
    expect(screen.getByText("₹1,000")).toBeInTheDocument();
  });

  test("Move to Cart puts it in the cart and takes it off the wishlist", async () => {
    save("body-lotion");
    const user = userEvent.setup();
    renderWithIntl(<WishlistView />, { products });
    await user.click(screen.getByRole("button", { name: "Move to Cart" }));
    expect(stored("melovme-cart")).toEqual([{ slug: "body-lotion", qty: 1 }]);
    expect(stored("melovme-wishlist")).toEqual([]);
    expect(screen.getByText("Your wishlist is empty.")).toBeInTheDocument();
  });

  test("an out-of-stock product can't be moved to the cart", () => {
    save("scrub");
    renderWithIntl(<WishlistView />, { products });
    expect(screen.getByRole("button", { name: "Out of Stock" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Move to Cart" })).toBeNull();
  });

  test("the bin takes it off the wishlist", async () => {
    save("body-lotion", "scrub");
    const user = userEvent.setup();
    renderWithIntl(<WishlistView />, { products });
    await user.click(screen.getByRole("button", { name: "Remove Body Lotion from wishlist" }));
    expect(stored("melovme-wishlist")).toEqual(["scrub"]);
    expect(screen.queryByText("Body Lotion")).toBeNull();
  });

  test("a product that's no longer sold isn't shown", () => {
    save("gone");
    renderWithIntl(<WishlistView />, { products });
    expect(screen.getByText("Your wishlist is empty.")).toBeInTheDocument();
  });
});
