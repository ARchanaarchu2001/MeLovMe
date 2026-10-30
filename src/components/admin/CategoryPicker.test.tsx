import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Category } from "@/lib/category";
import CategoryPicker from "./CategoryPicker";

vi.mock("@/app/actions/admin", () => ({ saveCategory: vi.fn() }));
// Clicks right after a choice are ignored (so the menu can't pop straight back up); wait that out
const pause = () => new Promise((r) => setTimeout(r, 450));
afterEach(cleanup);

const categories: Category[] = [
  { id: "body", name: "Body Care", slug: "body-care", parentId: null },
  { id: "face", name: "Face", slug: "face", parentId: "body" },
  { id: "lip", name: "Lip", slug: "lip", parentId: "face" },
  { id: "sun", name: "sunscreen", slug: "sunscreen", parentId: "lip" },
  { id: "gifts", name: "Gift Collection", slug: "gift-collection", parentId: null },
];

function Form() {
  const [value, setValue] = useState("gifts");
  return (
    <>
      {/* As in the product form, where each field is inside a <label> */}
      <label>
        Category
        <CategoryPicker categories={categories} value={value} onChange={setValue} onCreated={() => {}} className="" />
      </label>
      <button type="button">Elsewhere</button>
    </>
  );
}

describe("CategoryPicker", () => {
  test("choosing a search result closes the menu and shows the chosen category", async () => {
    const user = userEvent.setup();
    render(<Form />);
    const box = screen.getByRole("combobox");
    await user.click(box);
    await user.type(box, "sunscre");
    await user.click(screen.getByRole("option", { name: /sunscreen/ }));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(box).toHaveValue("Body Care › Face › Lip › sunscreen");
  });

  test("reopening shows the path to the chosen category, and it stays open while moving in", async () => {
    const user = userEvent.setup();
    render(<Form />);
    const box = screen.getByRole("combobox");
    await user.click(box);
    await user.type(box, "sunscre");
    await user.click(screen.getByRole("option", { name: /sunscreen/ }));
    await pause();
    await user.click(box);
    // The box still shows the choice (not an empty search), and the menu is open down to it
    expect(box).toHaveValue("Body Care › Face › Lip › sunscreen");
    expect(screen.getByRole("option", { name: "sunscreen" })).toBeInTheDocument();
    await user.hover(screen.getByRole("option", { name: /Body Care/ }));
    expect(screen.getByRole("option", { name: "sunscreen" })).toBeInTheDocument();
  });

  test("a click on the box right after choosing doesn't reopen the menu", async () => {
    const user = userEvent.setup();
    render(<Form />);
    const box = screen.getByRole("combobox");
    await user.click(box);
    await user.type(box, "sunscre");
    await user.click(screen.getByRole("option", { name: /sunscreen/ }));
    await user.click(box);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  test("typing replaces the chosen category and searches", async () => {
    const user = userEvent.setup();
    render(<Form />);
    const box = screen.getByRole("combobox");
    await user.click(box);
    expect(box).toHaveValue("Gift Collection");
    await user.keyboard("lip");
    expect(box).toHaveValue("lip");
    expect(screen.getByRole("option", { name: /Lip/ })).toBeInTheDocument();
  });

  test("Enter picks the best match, even with Add options listed", async () => {
    const user = userEvent.setup();
    render(<Form />);
    const box = screen.getByRole("combobox");
    await user.click(box);
    await user.type(box, "sunscrenn{Enter}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(box).toHaveValue("Body Care › Face › Lip › sunscreen");
  });
});
