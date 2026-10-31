import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { saveProduct } from "@/app/actions/admin";
import type { ProductInput } from "@/lib/admin-validation";
import type { Category } from "@/lib/category";
import { uploadToCloudinary } from "@/lib/upload";
import ProductForm from "./ProductForm";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/actions/admin", () => ({ saveProduct: vi.fn(), saveCategory: vi.fn() }));
// Nothing is sent to Cloudinary: shrinking passes the file through, and the upload is faked per test
vi.mock("@/lib/upload", () => ({
  IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"],
  shrink: vi.fn(async (file: File) => file),
  uploadToCloudinary: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
// eslint-disable-next-line @next/next/no-img-element
vi.mock("next/image", () => ({ default: ({ src }: { src: string }) => <img src={src} alt="" /> }));
beforeAll(() => {
  // After a failed Save the form scrolls to the first problem; jsdom can't scroll
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn() as typeof window.scrollTo;
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(saveProduct).mockResolvedValue({ ok: true, slug: "rose-body-mist" });
});
afterEach(cleanup);

const categories: Category[] = [{ id: "body", name: "Body Care", slug: "body-care", parentId: null }];
const product: ProductInput = {
  slug: "rose-body-mist",
  name: "Rose Body Mist",
  categoryId: "body",
  size: "100 ml",
  price: 1000,
  stock: 12,
  shortDescription: "A light rose mist.",
  description: "A light, fresh rose body mist for every day.",
  images: ["/images/rose-1.jpg", "/images/rose-2.jpg"],
  highlights: ["Light", "Fresh"],
  ingredients: ["Rose water"],
  howToUse: "Spray on skin.",
  enabled: true,
  offer: null,
  combos: [{ qty: 2, price: 1800, tag: "popular" }],
};
const blank: ProductInput = {
  slug: "",
  name: "",
  categoryId: "",
  size: "",
  price: 0,
  stock: null,
  shortDescription: "",
  description: "",
  images: [],
  highlights: [],
  ingredients: [],
  howToUse: "",
  enabled: true,
  offer: null,
  combos: [],
};

const edit = (p: Partial<ProductInput> = {}) => render(<ProductForm initial={{ ...product, ...p }} isNew={false} categories={categories} />);
const create = (p: Partial<ProductInput> = {}) => render(<ProductForm initial={{ ...blank, ...p }} isNew categories={categories} />);
const box = (name: string | RegExp) => screen.getByRole("textbox", { name });
const save = () => screen.getByRole("button", { name: "Save changes" });
// What the last Save sent to the server
const sent = () => vi.mocked(saveProduct).mock.calls.at(-1)![0];

describe("ProductForm: editing", () => {
  test("every field is filled in from the product", () => {
    edit();
    expect(box(/^Name/)).toHaveValue("Rose Body Mist");
    expect(box(/^Size/)).toHaveValue("100 ml");
    expect(box(/^Price/)).toHaveValue("1000");
    expect(box(/^Stock/)).toHaveValue("12");
    expect(box(/^Short description/)).toHaveValue("A light rose mist.");
    expect(box(/^Highlights/)).toHaveValue("Light\nFresh");
    expect(box(/^Key ingredients/)).toHaveValue("Rose water");
    expect(screen.getByRole("checkbox", { name: /Show in shop/ })).toBeChecked();
    expect(screen.getByRole("combobox")).toHaveValue("Body Care");
    expect(document.querySelectorAll("img")).toHaveLength(2);
    expect(box("Pieces")).toHaveValue("2");
    expect(box("Total price (₹)")).toHaveValue("1800");
    expect(within(screen.getByRole("group", { name: "Tag for combo 1" })).getByRole("button", { name: "Popular" })).toHaveAttribute("aria-pressed", "true");
  });

  test("an offer with dates is filled in with Set dates chosen", () => {
    edit({ offer: { type: "percent", value: 20, startDate: "2026-06-01", endDate: "2026-06-30" } });
    expect(box("Discount (%)")).toHaveValue("20");
    expect(screen.getByRole("button", { name: "Set dates" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Starts")).toHaveValue("2026-06-01");
    expect(screen.getByLabelText("Ends")).toHaveValue("2026-06-30");
  });

  test("saving sends the product and says the shop is updated", async () => {
    const user = userEvent.setup();
    edit();
    await user.clear(box(/^Price/));
    await user.type(box(/^Price/), "1200");
    await user.click(save());
    expect(sent()).toMatchObject({ slug: "rose-body-mist", price: 1200, highlights: ["Light", "Fresh"], combos: [{ qty: 2, price: 1800, tag: "popular" }] });
    expect(vi.mocked(saveProduct).mock.calls[0][1]).toBe(false);
    expect(await screen.findByRole("status")).toHaveTextContent("Saved. The shop is updated.");
    expect(router.refresh).toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  test("an untouched stock count is sent as null, so orders paid meanwhile aren't undone", async () => {
    const user = userEvent.setup();
    edit();
    await user.click(save());
    expect(sent().stock).toBeNull();
  });

  test("a changed stock count is sent as the number", async () => {
    const user = userEvent.setup();
    edit();
    await user.clear(box(/^Stock/));
    await user.type(box(/^Stock/), "40");
    await user.click(save());
    expect(sent().stock).toBe(40);
  });

  test("price and stock boxes only take digits", async () => {
    const user = userEvent.setup();
    edit();
    await user.clear(box(/^Price/));
    await user.type(box(/^Price/), "1,2.5o0");
    expect(box(/^Price/)).toHaveValue("1250");
    await user.clear(box(/^Stock/));
    await user.type(box(/^Stock/), "-3");
    expect(box(/^Stock/)).toHaveValue("3");
  });

  test("an empty price is refused with a message, and nothing is sent", async () => {
    const user = userEvent.setup();
    edit();
    await user.clear(box(/^Price/));
    await user.click(save());
    expect(screen.getByRole("alert")).toHaveTextContent("Please fix the highlighted fields.");
    expect(screen.getByText("Enter a price in whole rupees (at least ₹1).")).toBeInTheDocument();
    expect(box(/^Price/)).toHaveAttribute("aria-invalid", "true");
    expect(saveProduct).not.toHaveBeenCalled();
  });

  test("editing a field clears its message, the others stay", async () => {
    const user = userEvent.setup();
    edit({ size: "" });
    await user.clear(box(/^Price/));
    await user.click(save());
    await user.type(box(/^Price/), "9");
    expect(screen.queryByText("Enter a price in whole rupees (at least ₹1).")).toBeNull();
    expect(screen.getByText("Enter a size, e.g. 50 ml.")).toBeInTheDocument();
  });

  test("the server's message for a field is shown", async () => {
    const user = userEvent.setup();
    vi.mocked(saveProduct).mockResolvedValue({ errors: { categoryId: "Choose a category without sub-categories." } });
    edit();
    await user.click(save());
    expect(await screen.findByText("Choose a category without sub-categories.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Please fix the highlighted fields.");
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("a URL-name problem from the server is shown at the top", async () => {
    const user = userEvent.setup();
    vi.mocked(saveProduct).mockResolvedValue({ errors: { slug: "This product no longer exists." } });
    edit();
    await user.click(save());
    expect(await screen.findByRole("alert")).toHaveTextContent("This product no longer exists.");
  });

  test("shows Saving… while saving", async () => {
    const user = userEvent.setup();
    let finish!: (v: { ok: true; slug: string }) => void;
    vi.mocked(saveProduct).mockReturnValue(new Promise((r) => (finish = r)));
    edit();
    await user.click(save());
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    finish({ ok: true, slug: "rose-body-mist" });
    await waitFor(() => expect(save()).toBeEnabled());
  });

  test("too-short descriptions are refused", async () => {
    const user = userEvent.setup();
    edit({ shortDescription: "Nice", description: "Very nice mist." });
    await user.click(save());
    expect(screen.getAllByText("Write at least 10 characters.").length).toBeGreaterThan(0);
    expect(screen.getByText("Write at least 20 characters.")).toBeInTheDocument();
    expect(saveProduct).not.toHaveBeenCalled();
  });

  test("the character counter says how many more are needed", async () => {
    const user = userEvent.setup();
    edit({ shortDescription: "" });
    expect(screen.getByText("At least 10 characters")).toBeInTheDocument();
    await user.type(box(/^Short description/), "Rose mist");
    expect(screen.getByText("1 more character needed")).toBeInTheDocument();
  });
});

describe("ProductForm: new product", () => {
  test("an empty form lists everything that's missing", async () => {
    const user = userEvent.setup();
    create();
    await user.click(screen.getByRole("button", { name: "Create product" }));
    for (const message of [
      "Enter a name.",
      "Choose a category.",
      "Enter a size, e.g. 50 ml.",
      "Enter a price in whole rupees (at least ₹1).",
      "Enter how many you have, in whole units (0 if none).",
      "Enter a short description.",
      "Enter a description.",
      "Add at least one image.",
    ]) {
      expect(screen.getByText(message)).toBeInTheDocument();
    }
    expect(saveProduct).not.toHaveBeenCalled();
  });

  test("the URL name is made from the product name, and the list then says it was added", async () => {
    const user = userEvent.setup();
    create({ ...product, slug: "", name: "", stock: null });
    await user.type(box(/^Name/), "Rose Body Mist");
    await user.type(box(/^Stock/), "25");
    await user.click(screen.getByRole("button", { name: "Create product" }));
    expect(sent()).toMatchObject({ slug: "rose-body-mist", name: "Rose Body Mist", stock: 25 });
    expect(vi.mocked(saveProduct).mock.calls[0][1]).toBe(true);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/products/?added=rose-body-mist"));
  });
});

describe("ProductForm: offers", () => {
  test("a % offer shows what customers will pay", async () => {
    const user = userEvent.setup();
    edit();
    await user.click(screen.getByRole("button", { name: "% off" }));
    await user.type(box("Discount (%)"), "20");
    // ₹1,000 − 20% = ₹800
    expect(screen.getByText(/Customers pay/)).toHaveTextContent("Customers pay ₹800 ₹1,000 · 20% off");
  });

  test("a % discount takes at most 2 digits, and over 90% is refused", async () => {
    const user = userEvent.setup();
    edit();
    await user.click(screen.getByRole("button", { name: "% off" }));
    await user.type(box("Discount (%)"), "955");
    expect(box("Discount (%)")).toHaveValue("95");
    await user.click(save());
    expect(screen.getByText("Enter a whole % between 1 and 90.")).toBeInTheDocument();
    expect(saveProduct).not.toHaveBeenCalled();
  });

  test("a ₹ discount must be less than the price", async () => {
    const user = userEvent.setup();
    edit();
    await user.click(screen.getByRole("button", { name: "₹ off" }));
    await user.type(box("Discount (₹)"), "1000");
    await user.click(save());
    expect(screen.getByText("Enter whole rupees, less than the price.")).toBeInTheDocument();
  });

  test("an empty discount is refused", async () => {
    const user = userEvent.setup();
    edit();
    await user.click(screen.getByRole("button", { name: "% off" }));
    await user.click(save());
    expect(screen.getByText("Enter the discount.")).toBeInTheDocument();
  });

  test("an always-on offer is sent without dates", async () => {
    const user = userEvent.setup();
    edit();
    await user.click(screen.getByRole("button", { name: "₹ off" }));
    await user.type(box("Discount (₹)"), "150");
    await user.click(save());
    expect(sent().offer).toEqual({ type: "flat", value: 150, startDate: "", endDate: "" });
  });

  test("an offer with dates needs a last day", async () => {
    const user = userEvent.setup();
    edit();
    await user.click(screen.getByRole("button", { name: "% off" }));
    await user.type(box("Discount (%)"), "10");
    await user.click(screen.getByRole("button", { name: "Set dates" }));
    await user.click(save());
    expect(screen.getByText("Choose the last day of the offer, or pick “Always on”.")).toBeInTheDocument();
    expect(saveProduct).not.toHaveBeenCalled();
  });

  test("an end date before the start date is refused", async () => {
    const user = userEvent.setup();
    edit({ offer: { type: "percent", value: 10, startDate: "2026-06-10", endDate: "2026-06-30" } });
    fireEvent.change(screen.getByLabelText("Ends"), { target: { value: "2026-06-05" } });
    await user.click(save());
    expect(screen.getByText("The end date is before the start date.")).toBeInTheDocument();
    expect(saveProduct).not.toHaveBeenCalled();
  });

  test("offer dates are sent as typed", async () => {
    const user = userEvent.setup();
    edit({ offer: { type: "percent", value: 10, startDate: "", endDate: "2026-06-30" } });
    fireEvent.change(screen.getByLabelText("Starts"), { target: { value: "2026-06-10" } });
    await user.click(save());
    expect(sent().offer).toEqual({ type: "percent", value: 10, startDate: "2026-06-10", endDate: "2026-06-30" });
  });

  test("No offer sends no offer", async () => {
    const user = userEvent.setup();
    edit({ offer: { type: "percent", value: 10, startDate: "", endDate: "" } });
    await user.click(screen.getByRole("button", { name: "No offer" }));
    await user.click(save());
    expect(sent().offer).toBeNull();
  });
});

describe("ProductForm: combos", () => {
  test("shows how much the customer saves on a combo", () => {
    edit();
    // 2 × ₹1,000 = ₹2,000; combo ₹1,800 saves ₹200 (10%)
    expect(screen.getByText("Customer saves ₹200 (10%) vs 2 × ₹1,000")).toBeInTheDocument();
  });

  test("a combo that isn't cheaper is flagged and refused", async () => {
    const user = userEvent.setup();
    edit();
    await user.clear(box("Total price (₹)"));
    await user.type(box("Total price (₹)"), "2000");
    expect(screen.getByText("Must be less than ₹2,000 to be a deal.")).toBeInTheDocument();
    await user.click(save());
    expect(screen.getByText("2 pieces must cost less than ₹2000 (2 × the price), or it isn't a deal.")).toBeInTheDocument();
    expect(saveProduct).not.toHaveBeenCalled();
  });

  test("Add combo adds the next number of pieces", async () => {
    const user = userEvent.setup();
    edit();
    await user.click(screen.getByRole("button", { name: "+ Add combo" }));
    expect(screen.getAllByRole("textbox", { name: "Pieces" }).map((b) => (b as HTMLInputElement).value)).toEqual(["2", "3"]);
  });

  test("two combos for the same number of pieces are refused", async () => {
    const user = userEvent.setup();
    edit();
    await user.click(screen.getByRole("button", { name: "+ Add combo" }));
    const [, pieces] = screen.getAllByRole("textbox", { name: "Pieces" });
    await user.clear(pieces);
    await user.type(pieces, "2");
    await user.type(screen.getAllByRole("textbox", { name: "Total price (₹)" })[1], "1700");
    await user.click(save());
    expect(screen.getByText("There are two combos for 2 pieces. Keep one.")).toBeInTheDocument();
  });

  test("a combo of 1 piece is refused", async () => {
    const user = userEvent.setup();
    edit();
    await user.clear(box("Pieces"));
    await user.type(box("Pieces"), "1");
    await user.click(save());
    expect(screen.getByText("Pieces must be a whole number from 2 to 10.")).toBeInTheDocument();
  });

  test("a combo without a price is refused", async () => {
    const user = userEvent.setup();
    edit();
    await user.click(screen.getByRole("button", { name: "+ Add combo" }));
    await user.click(save());
    expect(screen.getByText("Enter the total price for 3 pieces in whole rupees.")).toBeInTheDocument();
  });

  test("rows left completely empty are ignored", async () => {
    const user = userEvent.setup();
    edit();
    await user.click(screen.getByRole("button", { name: "+ Add combo" }));
    await user.clear(screen.getAllByRole("textbox", { name: "Pieces" })[1]);
    await user.click(save());
    expect(sent().combos).toEqual([{ qty: 2, price: 1800, tag: "popular" }]);
  });

  test("a combo can be removed and its tag changed", async () => {
    const user = userEvent.setup();
    edit({ combos: [{ qty: 2, price: 1800 }, { qty: 3, price: 2500 }] });
    await user.click(screen.getByRole("button", { name: "Remove combo 1" }));
    await user.click(within(screen.getByRole("group", { name: "Tag for combo 1" })).getByRole("button", { name: "Best value" }));
    await user.click(save());
    expect(sent().combos).toEqual([{ qty: 3, price: 2500, tag: "best" }]);
  });

  test("Add combo is gone once there are 4", () => {
    edit({ combos: [2, 3, 4, 5].map((qty) => ({ qty, price: qty * 900 })) });
    expect(screen.queryByRole("button", { name: "+ Add combo" })).toBeNull();
  });
});

describe("ProductForm: images", () => {
  const fileInput = (c: HTMLElement) => c.querySelector<HTMLInputElement>('input[type="file"]')!;
  // The photos have empty alt text (decoration), so they are found by tag
  const srcs = () => [...document.querySelectorAll("img")].map((i) => i.getAttribute("src"));

  test("images can be reordered and removed, and are sent in that order", async () => {
    const user = userEvent.setup();
    edit({ images: ["/images/a.jpg", "/images/b.jpg", "/images/c.jpg"] });
    await user.click(screen.getByRole("button", { name: "Move image 1 right" }));
    expect(srcs()).toEqual(["/images/b.jpg", "/images/a.jpg", "/images/c.jpg"]);
    await user.click(screen.getAllByRole("button", { name: "Set as main" })[1]);
    expect(srcs()).toEqual(["/images/c.jpg", "/images/b.jpg", "/images/a.jpg"]);
    await user.click(screen.getByRole("button", { name: "Remove image 2" }));
    await user.click(save());
    expect(sent().images).toEqual(["/images/c.jpg", "/images/a.jpg"]);
  });

  test("the first image can't move left and the last can't move right", () => {
    edit();
    expect(screen.getByRole("button", { name: "Move image 1 left" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move image 2 right" })).toBeDisabled();
  });

  test("a picked photo is uploaded and added", async () => {
    const user = userEvent.setup();
    vi.mocked(uploadToCloudinary).mockResolvedValue({ url: "https://res.cloudinary.com/demo/rose-3.webp", width: 800, height: 800 });
    const { container } = edit();
    await user.upload(fileInput(container), new File(["x"], "rose.jpg", { type: "image/jpeg" }));
    await waitFor(() => expect(srcs()).toContain("https://res.cloudinary.com/demo/rose-3.webp"));
  });

  test("a file that isn't a photo is refused with its name", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = edit();
    await user.upload(fileInput(container), new File(["x"], "notes.pdf", { type: "application/pdf" }));
    expect(await screen.findByText("notes.pdf is not a JPG, PNG or WebP photo.")).toBeInTheDocument();
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });

  test("a photo over 10 MB is refused", async () => {
    const user = userEvent.setup();
    const big = new File(["x"], "big.jpg", { type: "image/jpeg" });
    Object.defineProperty(big, "size", { value: 12 * 1024 * 1024 });
    const { container } = edit();
    await user.upload(fileInput(container), big);
    expect(await screen.findByText("big.jpg is 12.0 MB. Photos can be up to 10 MB.")).toBeInTheDocument();
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });

  test("a failed upload says which photo and why", async () => {
    const user = userEvent.setup();
    vi.mocked(uploadToCloudinary).mockRejectedValue(new Error("Upload failed"));
    const { container } = edit();
    await user.upload(fileInput(container), new File(["x"], "rose.jpg", { type: "image/jpeg" }));
    expect(await screen.findByText("rose.jpg: Upload failed")).toBeInTheDocument();
  });

  test("Save waits while a photo is uploading", async () => {
    const user = userEvent.setup();
    let finish!: (v: { url: string; width: number; height: number }) => void;
    vi.mocked(uploadToCloudinary).mockReturnValue(new Promise((r) => (finish = r)));
    const { container } = edit();
    await user.upload(fileInput(container), new File(["x"], "rose.jpg", { type: "image/jpeg" }));
    expect(await screen.findByText("Uploading…")).toBeInTheDocument();
    expect(save()).toBeDisabled();
    finish({ url: "https://res.cloudinary.com/demo/rose-3.webp", width: 1, height: 1 });
    await waitFor(() => expect(save()).toBeEnabled());
  });

  test("no Add image button once there are 8 photos", () => {
    edit({ images: Array.from({ length: 8 }, (_, i) => `/images/p${i}.jpg`) });
    expect(screen.queryByRole("button", { name: /Add\s*image/ })).toBeNull();
  });
});
