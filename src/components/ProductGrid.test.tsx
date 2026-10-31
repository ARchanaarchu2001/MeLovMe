import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { renderWithIntl } from "@/test/render";
import ProductGrid from "./ProductGrid";

afterEach(cleanup);

// The phone switcher (1–2) comes first, then the computer one (2–4)
const switchers = () => screen.getAllByRole("group", { name: "Products per row" });

describe("ProductGrid", () => {
  test("says how many products there are", () => {
    const { rerender } = renderWithIntl(<ProductGrid count={1}><div /></ProductGrid>);
    expect(screen.getByText("1 product")).toBeInTheDocument();
    rerender(<ProductGrid count={12}><div /></ProductGrid>);
    expect(screen.getByText("12 products")).toBeInTheDocument();
  });

  test("shows its children in the grid", () => {
    renderWithIntl(<ProductGrid count={2}><p>Card A</p><p>Card B</p></ProductGrid>);
    expect(screen.getByText("Card A")).toBeInTheDocument();
    expect(screen.getByText("Card B")).toBeInTheDocument();
  });

  test("by default phones show 2 per row and computers 3", () => {
    renderWithIntl(<ProductGrid count={2}><p>Card</p></ProductGrid>);
    const [phone, desktop] = switchers();
    expect(within(phone).getByRole("button", { name: "2 per row" })).toHaveAttribute("aria-pressed", "true");
    expect(within(desktop).getByRole("button", { name: "3 per row" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Card").parentElement).toHaveClass("grid-cols-2", "md:grid-cols-3");
  });

  test("picking 4 per row changes the grid and is remembered", async () => {
    const user = userEvent.setup();
    renderWithIntl(<ProductGrid count={2}><p>Card</p></ProductGrid>);
    await user.click(within(switchers()[1]).getByRole("button", { name: "4 per row" }));
    expect(within(switchers()[1]).getByRole("button", { name: "4 per row" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Card").parentElement).toHaveClass("md:grid-cols-4");
    expect(JSON.parse(localStorage.getItem("melovme-grid")!)).toEqual([2, 4]);
  });
});
