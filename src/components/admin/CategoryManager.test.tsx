import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { deleteCategory, moveCategoryProducts, saveCategory } from "@/app/actions/admin";
import type { Category } from "@/lib/category";
import CategoryManager, { type CategoryProduct } from "./CategoryManager";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/actions/admin", () => ({ saveCategory: vi.fn(), deleteCategory: vi.fn(), moveCategoryProducts: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(deleteCategory).mockResolvedValue({ ok: true });
  vi.mocked(moveCategoryProducts).mockResolvedValue({ ok: true, moved: 1 });
});
afterEach(cleanup);

const categories: Category[] = [
  { id: "body", name: "Body Care", slug: "body-care", parentId: null },
  { id: "face", name: "Face", slug: "face", parentId: "body" },
  { id: "gifts", name: "Gift Collection", slug: "gift-collection", parentId: null },
  { id: "travel", name: "Travel", slug: "travel", parentId: null },
];
const products: CategoryProduct[] = [
  { slug: "rose-mist", name: "Rose Mist", categoryId: "body", enabled: true },
  { slug: "shea-lotion", name: "Shea Lotion", categoryId: "body", enabled: false },
  { slug: "face-cream", name: "Face Cream", categoryId: "face", enabled: true },
];
const manager = (c = categories, p = products) => render(<CategoryManager categories={c} products={p} />);
const row = (name: string) => screen.getByText(name, { selector: "li p" }).closest("li")!;
const dialog = () => screen.getByRole("dialog");
const nameBox = () => within(dialog()).getByRole("textbox", { name: "Name" });

describe("CategoryManager: the tree", () => {
  test("with no categories it asks for the first one", () => {
    manager([], []);
    expect(screen.getByText("No categories yet. Add your first one, e.g. Body Care.")).toBeInTheDocument();
  });

  test("lists categories with sub-categories under them and their product counts", () => {
    manager();
    expect(screen.getByText(/4 categories · 3 products/)).toBeInTheDocument();
    // Body Care holds 2 products itself and 1 in Face
    expect(row("Body Care")).toHaveTextContent("3 products (2 directly in it) · 1 sub-category");
    expect(row("Face")).toHaveTextContent("1 product");
    expect(row("Travel")).toHaveTextContent("0 products");
  });

  test("sub-categories can be hidden and shown again", async () => {
    const user = userEvent.setup();
    manager();
    await user.click(screen.getByRole("button", { name: "Hide the sub-categories of Body Care" }));
    expect(screen.queryByText("Face", { selector: "li p" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show the sub-categories of Body Care" }));
    expect(row("Face")).toBeInTheDocument();
  });
});

describe("CategoryManager: adding and editing", () => {
  test("adding a main category saves it and shows a toast", async () => {
    const user = userEvent.setup();
    vi.mocked(saveCategory).mockResolvedValue({ ok: true, category: { id: "hair", name: "Hair Care", slug: "hair-care", parentId: null } });
    manager();
    await user.click(screen.getByRole("button", { name: "+ Add category" }));
    expect(dialog()).toHaveAccessibleName("Add a category");
    expect(within(dialog()).getByRole("radio", { name: "Nothing — a main category" })).toBeChecked();
    await user.type(nameBox(), "Hair Care");
    await user.click(within(dialog()).getByRole("button", { name: "Add category" }));
    expect(saveCategory).toHaveBeenCalledWith(null, { name: "Hair Care", parentId: null });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("status")).toHaveTextContent("Category added");
    expect(screen.getByRole("status")).toHaveTextContent("Hair Care");
    expect(router.refresh).toHaveBeenCalled();
  });

  test("an empty name is refused without asking the server", async () => {
    const user = userEvent.setup();
    manager();
    await user.click(screen.getByRole("button", { name: "+ Add category" }));
    await user.click(within(dialog()).getByRole("button", { name: "Add category" }));
    expect(within(dialog()).getByRole("alert")).toHaveTextContent("Enter a category name.");
    expect(nameBox()).toHaveAttribute("aria-invalid", "true");
    expect(saveCategory).not.toHaveBeenCalled();
  });

  test("a name with digits is refused, and typing clears the message", async () => {
    const user = userEvent.setup();
    manager();
    await user.click(screen.getByRole("button", { name: "+ Add category" }));
    await user.type(nameBox(), "Sale 2026");
    await user.click(within(dialog()).getByRole("button", { name: "Add category" }));
    expect(within(dialog()).getByRole("alert")).toHaveTextContent("Use letters only, e.g. Body Care.");
    await user.type(nameBox(), "x");
    expect(within(dialog()).queryByRole("alert")).toBeNull();
  });

  test("the server's message stays in the dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(saveCategory).mockResolvedValue({ error: "There is already a main category called “Body Care”." });
    manager();
    await user.click(screen.getByRole("button", { name: "+ Add category" }));
    await user.type(nameBox(), "Body Care");
    await user.click(within(dialog()).getByRole("button", { name: "Add category" }));
    expect(await within(dialog()).findByRole("alert")).toHaveTextContent("There is already a main category called “Body Care”.");
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("adding a sub-category puts it under the chosen category", async () => {
    const user = userEvent.setup();
    vi.mocked(saveCategory).mockResolvedValue({ ok: true, category: { id: "lips", name: "Lips", slug: "lips", parentId: "body" } });
    manager();
    await user.click(screen.getByRole("button", { name: "Add a sub-category to Body Care" }));
    expect(dialog()).toHaveAccessibleName("Add a sub-category");
    expect(dialog()).toHaveTextContent("Under Body Care");
    expect(within(dialog()).getByRole("radio", { name: "Body Care" })).toBeChecked();
    await user.type(nameBox(), "Lips");
    await user.click(within(dialog()).getByRole("button", { name: "Add category" }));
    expect(saveCategory).toHaveBeenCalledWith(null, { name: "Lips", parentId: "body" });
    expect(await screen.findByRole("status")).toHaveTextContent("Body Care › Lips");
  });

  test("editing starts with the name, and it can't be moved inside itself", async () => {
    const user = userEvent.setup();
    manager();
    await user.click(screen.getByRole("button", { name: "Edit Body Care" }));
    expect(dialog()).toHaveAccessibleName("Edit category");
    expect(nameBox()).toHaveValue("Body Care");
    expect(within(dialog()).getByRole("radio", { name: /Body Care.*this one/ })).toBeDisabled();
    expect(within(dialog()).getByRole("radio", { name: /Face.*inside it/ })).toBeDisabled();
    expect(within(dialog()).getByRole("radio", { name: "Gift Collection" })).toBeEnabled();
  });

  test("renaming and moving sends the category's id", async () => {
    const user = userEvent.setup();
    vi.mocked(saveCategory).mockResolvedValue({ ok: true, category: { id: "face", name: "Face Care", slug: "face-care", parentId: "gifts" } });
    manager();
    await user.click(screen.getByRole("button", { name: "Edit Face" }));
    await user.clear(nameBox());
    await user.type(nameBox(), "Face Care");
    await user.click(within(dialog()).getByRole("radio", { name: "Gift Collection" }));
    await user.click(within(dialog()).getByRole("button", { name: "Save" }));
    expect(saveCategory).toHaveBeenCalledWith("face", { name: "Face Care", parentId: "gifts" });
    expect(await screen.findByRole("status")).toHaveTextContent("Category saved");
    expect(screen.getByRole("status")).toHaveTextContent("Gift Collection › Face Care");
  });

  test("shows Saving… while saving", async () => {
    const user = userEvent.setup();
    let finish!: (v: { error: string }) => void;
    vi.mocked(saveCategory).mockReturnValue(new Promise((r) => (finish = r)));
    manager();
    await user.click(screen.getByRole("button", { name: "+ Add category" }));
    await user.type(nameBox(), "Hair");
    await user.click(within(dialog()).getByRole("button", { name: "Add category" }));
    expect(within(dialog()).getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(within(dialog()).getByRole("button", { name: "Close" })).toBeDisabled();
    finish({ error: "Try again" });
    expect(await within(dialog()).findByRole("alert")).toHaveTextContent("Try again");
  });

  test("the × closes the dialog without saving", async () => {
    const user = userEvent.setup();
    manager();
    await user.click(screen.getByRole("button", { name: "+ Add category" }));
    await user.click(within(dialog()).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(saveCategory).not.toHaveBeenCalled();
  });
});

describe("CategoryManager: deleting", () => {
  test("an empty category asks first, then is deleted with a toast", async () => {
    const user = userEvent.setup();
    manager();
    await user.click(screen.getByRole("button", { name: "Delete Travel" }));
    expect(dialog()).toHaveAccessibleName("Delete this category?");
    expect(deleteCategory).not.toHaveBeenCalled();
    await user.click(within(dialog()).getByRole("button", { name: "Yes, delete" }));
    expect(deleteCategory).toHaveBeenCalledWith("travel");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("status")).toHaveTextContent("Category deleted");
    expect(screen.getByRole("status")).toHaveTextContent("Travel");
  });

  test("Cancel keeps the category", async () => {
    const user = userEvent.setup();
    manager();
    await user.click(screen.getByRole("button", { name: "Delete Travel" }));
    await user.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deleteCategory).not.toHaveBeenCalled();
  });

  test("the server's reason for not deleting is shown", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteCategory).mockResolvedValue({ error: "Something was just added to “Travel”. Reload the page and try again." });
    manager();
    await user.click(screen.getByRole("button", { name: "Delete Travel" }));
    await user.click(within(dialog()).getByRole("button", { name: "Yes, delete" }));
    expect(await within(dialog()).findByRole("alert")).toHaveTextContent("Something was just added to “Travel”.");
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("a category with only sub-categories can't be deleted yet, and says why", async () => {
    const user = userEvent.setup();
    manager(categories, products.filter((p) => p.categoryId !== "body"));
    await user.click(screen.getByRole("button", { name: "Delete Body Care" }));
    expect(dialog()).toHaveAccessibleName("Can't delete this yet");
    expect(dialog()).toHaveTextContent("“Body Care” has 1 sub-category, Face.");
    expect(within(dialog()).queryByRole("button", { name: "Yes, delete" })).toBeNull();
    await user.click(within(dialog()).getByRole("button", { name: "OK" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("a category with products lists them, all ticked, and offers to move them", async () => {
    const user = userEvent.setup();
    manager();
    await user.click(screen.getByRole("button", { name: "Delete Body Care" }));
    expect(dialog()).toHaveAccessibleName("Can't delete this yet");
    expect(dialog()).toHaveTextContent("There are 2 products in “Body Care”.");
    expect(within(dialog()).getByRole("checkbox", { name: "Rose Mist" })).toBeChecked();
    // A product hidden from the shop says so
    expect(within(dialog()).getByRole("checkbox", { name: /Shea Lotion/ }).closest("label")).toHaveTextContent(/hidden$/);
    expect(within(dialog()).getByRole("link", { name: "Edit Rose Mist" })).toHaveAttribute("href", "/admin/products/rose-mist/");
    // Nowhere chosen yet
    expect(within(dialog()).getByRole("button", { name: "Move all 2" })).toBeDisabled();
    expect(within(dialog()).getAllByRole("radio").find((r) => r.textContent?.includes("this one"))).toBeDisabled();
    await user.click(within(dialog()).getByRole("radio", { name: "Gift Collection" }));
    expect(within(dialog()).getByRole("button", { name: "Move all 2" })).toBeEnabled();
  });

  test("moving the ticked products sends only those and says where they went", async () => {
    const user = userEvent.setup();
    manager();
    await user.click(screen.getByRole("button", { name: "Delete Body Care" }));
    await user.click(within(dialog()).getByRole("checkbox", { name: /Shea Lotion/ }));
    await user.click(within(dialog()).getByRole("radio", { name: "Gift Collection" }));
    await user.click(within(dialog()).getByRole("button", { name: "Move 1 of 2" }));
    expect(moveCategoryProducts).toHaveBeenCalledWith("body", "gifts", ["rose-mist"]);
    expect(await within(dialog()).findByRole("status")).toHaveTextContent("Moved 1 product to “Gift Collection”.");
    expect(router.refresh).toHaveBeenCalled();
  });

  test("Clear all unticks every product, and nothing can be moved", async () => {
    const user = userEvent.setup();
    manager();
    await user.click(screen.getByRole("button", { name: "Delete Body Care" }));
    await user.click(within(dialog()).getByRole("button", { name: "Clear all" }));
    expect(within(dialog()).getByRole("checkbox", { name: "Rose Mist" })).not.toBeChecked();
    expect(within(dialog()).getByRole("button", { name: "Tick products to move" })).toBeDisabled();
    await user.click(within(dialog()).getByRole("button", { name: "Select all" }));
    expect(within(dialog()).getByRole("checkbox", { name: "Rose Mist" })).toBeChecked();
  });

  test("a failed move shows the server's message", async () => {
    const user = userEvent.setup();
    vi.mocked(moveCategoryProducts).mockResolvedValue({ error: "Choose a different category." });
    manager();
    await user.click(screen.getByRole("button", { name: "Delete Face" }));
    await user.click(within(dialog()).getByRole("radio", { name: "Travel" }));
    await user.click(within(dialog()).getByRole("button", { name: "Move it" }));
    expect(await within(dialog()).findByRole("alert")).toHaveTextContent("Choose a different category.");
  });
});
