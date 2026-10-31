import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { makeProduct, renderWithIntl, resetStores } from "@/test/render";
import CartButton from "./CartButton";

const lotion = makeProduct();
afterEach(() => {
  cleanup();
  resetStores([lotion.slug]);
});

const cartQty = () => JSON.parse(localStorage.getItem("melovme-cart") ?? "[]").find((i: { slug: string }) => i.slug === lotion.slug)?.qty ?? 0;

describe("CartButton", () => {
  test("Add to Cart puts one in the cart and turns into a stepper", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CartButton slug={lotion.slug} />, { products: [lotion] });
    await user.click(screen.getByRole("button", { name: "Add to Cart" }));
    expect(cartQty()).toBe(1);
    expect(screen.queryByRole("button", { name: "Add to Cart" })).toBeNull();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  test("the stepper changes the quantity in the cart", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CartButton slug={lotion.slug} />, { products: [lotion] });
    await user.click(screen.getByRole("button", { name: "Add to Cart" }));
    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(cartQty()).toBe(2);
  });

  test("going down to 0 takes it out of the cart and brings back Add to Cart", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CartButton slug={lotion.slug} />, { products: [lotion] });
    await user.click(screen.getByRole("button", { name: "Add to Cart" }));
    await user.click(screen.getByRole("button", { name: "Decrease quantity" }));
    expect(cartQty()).toBe(0);
    expect(screen.getByRole("button", { name: "Add to Cart" })).toBeInTheDocument();
  });

  test("with 2 in stock, plus stops at 2", async () => {
    const user = userEvent.setup();
    const low = makeProduct({ stock: 2 });
    renderWithIntl(<CartButton slug={low.slug} />, { products: [low] });
    await user.click(screen.getByRole("button", { name: "Add to Cart" }));
    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
  });

  test("an out-of-stock product gets a disabled Out of Stock button", () => {
    const gone = makeProduct({ stock: 0, inStock: false });
    renderWithIntl(<CartButton slug={gone.slug} />, { products: [gone] });
    expect(screen.getByRole("button", { name: "Out of Stock" })).toBeDisabled();
  });

  test("nothing is shown when no payment method is on", () => {
    const { container } = renderWithIntl(<CartButton slug={lotion.slug} />, { products: [lotion], canBuy: false });
    expect(container).toBeEmptyDOMElement();
  });
});
