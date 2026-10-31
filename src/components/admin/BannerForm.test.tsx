import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { saveBanner } from "@/app/actions/admin";
import type { Banner, LinkGroup } from "@/lib/banner";
import { shrink, uploadToCloudinary } from "@/lib/upload";
import BannerForm from "./BannerForm";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/actions/admin", () => ({ saveBanner: vi.fn() }));
vi.mock("@/lib/upload", () => ({
  IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"],
  shrink: vi.fn(async (file: File) => file),
  uploadToCloudinary: vi.fn(),
}));
// The real banner is tested with the home page; here it only has to show which view is previewed
vi.mock("@/components/HeroBanner", () => ({ default: ({ view }: { view: string }) => <div>Banner preview: {view}</div> }));
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
  vi.mocked(saveBanner).mockResolvedValue({ ok: true });
});
afterEach(cleanup);

const labels = { heading: "Welcome", explore: "Explore Products", ourStory: "Our Story" };
const picture = { url: "https://res.cloudinary.com/demo/banner.webp", width: 1920, height: 800 };
const banner: Banner = {
  enabled: true,
  image: picture,
  mobileImage: null,
  alt: "Rose body lotion on a table",
  showButtons: true,
  buttonPosition: "bottom-center",
  buttonStyle: "dark",
  primaryButton: { label: "", link: "/products/" },
  secondaryButton: { label: "", link: "/about/" },
};
const links: LinkGroup[] = [
  { name: "Pages", options: [{ href: "/products/", name: "All products" }, { href: "/about/", name: "Our story" }, { href: "/contact/", name: "Contact" }] },
  { name: "Categories", options: [{ href: "/products/?category=gift-sets", name: "Gift Sets" }] },
  { name: "Products", options: [{ href: "/products/rose-mist/", name: "Rose Mist" }] },
];
const form = (b: Partial<Banner> = {}) => render(<BannerForm initial={{ ...banner, ...b }} labels={labels} links={links} />);
const mainButton = () => within(screen.getByRole("group", { name: /Main button/ }));
const secondButton = () => within(screen.getByRole("group", { name: /Second button/ }));
const save = () => screen.getByRole("button", { name: "Save changes" });
const sent = () => vi.mocked(saveBanner).mock.calls.at(-1)![0];
const fileInputs = (c: HTMLElement) => c.querySelectorAll<HTMLInputElement>('input[type="file"]');
const onOff = () => screen.getByRole("checkbox", { name: /home page/ });

describe("BannerForm", () => {
  test("the saved banner is filled in", () => {
    form();
    expect(onOff()).toBeChecked();
    expect(screen.getByText("Shown on home page")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace the computer picture" })).toBeInTheDocument();
    expect(screen.getByText("1920 × 800 px")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload the phone (optional) picture" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Picture description/ })).toHaveValue("Rose body lotion on a table");
    expect(screen.getByRole("radio", { name: /Bottom centre/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Dark buttons/ })).toBeChecked();
  });

  test("saving sends the banner and says the home page shows it", async () => {
    const user = userEvent.setup();
    form();
    await user.click(screen.getByRole("radio", { name: /Bottom right/ }));
    await user.click(screen.getByRole("radio", { name: /Light buttons/ }));
    await user.click(save());
    expect(sent()).toEqual({
      ...banner,
      buttonPosition: "bottom-right",
      buttonStyle: "light",
      primaryButton: { label: "Explore Products", link: "/products/" },
      secondaryButton: { label: "Our Story", link: "/about/" },
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Saved. The home page now shows the banner.");
    expect(router.refresh).toHaveBeenCalled();
  });

  test("saving a hidden banner says customers don't see it", async () => {
    const user = userEvent.setup();
    form();
    await user.click(onOff());
    expect(screen.getByText("Hidden from home page")).toBeInTheDocument();
    await user.click(save());
    expect(sent().enabled).toBe(false);
    expect(await screen.findByRole("status")).toHaveTextContent("Saved. The banner is hidden, so customers don't see it.");
  });

  test("No buttons hides the button colours and is saved as no buttons", async () => {
    const user = userEvent.setup();
    form();
    await user.click(screen.getByRole("radio", { name: /No buttons/ }));
    expect(screen.queryByRole("radiogroup", { name: "Button colour" })).toBeNull();
    await user.click(save());
    expect(sent().showButtons).toBe(false);
  });

  test("a switched-on banner needs a picture", async () => {
    const user = userEvent.setup();
    form({ image: null });
    await user.click(save());
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Upload a banner picture, or switch the banner off.");
    expect(saveBanner).not.toHaveBeenCalled();
  });

  test("switching the banner off clears the 'needs a picture' message, and it can then be saved", async () => {
    const user = userEvent.setup();
    form({ image: null });
    await user.click(save());
    await user.click(onOff());
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(save());
    expect(saveBanner).toHaveBeenCalled();
  });

  test("a saved picture without its size asks for it to be uploaded again", async () => {
    const user = userEvent.setup();
    form({ image: { ...picture, width: 0 } });
    await user.click(save());
    expect(screen.getAllByText("Upload this picture again.").length).toBeGreaterThan(0);
    expect(saveBanner).not.toHaveBeenCalled();
  });

  test("Preview is disabled until there's a computer picture", () => {
    form({ image: null });
    expect(screen.getByRole("button", { name: "Preview" })).toBeDisabled();
  });

  test("Preview opens the banner on a computer, and can switch to a phone", async () => {
    const user = userEvent.setup();
    form();
    await user.click(screen.getByRole("button", { name: "Preview" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("open");
    expect(within(dialog).getByText("Banner preview: desktop")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Phone" }));
    expect(within(dialog).getByText("Banner preview: mobile")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Close preview" }));
    expect(dialog).not.toHaveAttribute("open");
  });

  test("uploading the first picture switches the banner on", async () => {
    const user = userEvent.setup();
    vi.mocked(uploadToCloudinary).mockResolvedValue(picture);
    const { container } = form({ enabled: false, image: null });
    await user.upload(fileInputs(container)[0], new File(["x"], "banner.jpg", { type: "image/jpeg" }));
    await waitFor(() => expect(onOff()).toBeChecked());
    expect(uploadToCloudinary).toHaveBeenCalledWith(expect.anything(), "banner");
    // Banners keep more pixels than product photos
    expect(shrink).toHaveBeenCalledWith(expect.any(File), 2400);
    expect(screen.getByText("1920 × 800 px")).toBeInTheDocument();
  });

  test("a phone picture is saved separately", async () => {
    const user = userEvent.setup();
    const tall = { url: "https://res.cloudinary.com/demo/tall.webp", width: 1080, height: 1350 };
    vi.mocked(uploadToCloudinary).mockResolvedValue(tall);
    const { container } = form();
    await user.upload(fileInputs(container)[1], new File(["x"], "tall.jpg", { type: "image/jpeg" }));
    await screen.findByText("1080 × 1350 px");
    await user.click(save());
    expect(sent()).toMatchObject({ image: picture, mobileImage: tall });
  });

  test("Remove takes the picture off", async () => {
    const user = userEvent.setup();
    form();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("button", { name: "Upload the computer picture" })).toBeInTheDocument();
  });

  test("a file that isn't a picture is refused", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = form();
    await user.upload(fileInputs(container)[0], new File(["x"], "notes.pdf", { type: "application/pdf" }));
    expect(await screen.findByText("notes.pdf is not a JPG, PNG or WebP picture.")).toBeInTheDocument();
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });

  test("a picture over 10 MB is refused", async () => {
    const user = userEvent.setup();
    const big = new File(["x"], "big.jpg", { type: "image/jpeg" });
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    const { container } = form();
    await user.upload(fileInputs(container)[0], big);
    expect(await screen.findByText("big.jpg is 11.0 MB. Pictures can be up to 10 MB.")).toBeInTheDocument();
  });

  test("a failed upload shows why", async () => {
    const user = userEvent.setup();
    vi.mocked(uploadToCloudinary).mockRejectedValue(new Error("Upload failed"));
    const { container } = form();
    await user.upload(fileInputs(container)[0], new File(["x"], "banner.jpg", { type: "image/jpeg" }));
    expect(await screen.findByText("Upload failed")).toBeInTheDocument();
  });

  test("the server's message is shown", async () => {
    const user = userEvent.setup();
    vi.mocked(saveBanner).mockResolvedValue({ errors: { alt: "Keep it under 150 characters." } });
    form();
    await user.click(save());
    expect(await screen.findByRole("alert")).toHaveTextContent("Keep it under 150 characters.");
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("shows Saving… while saving", async () => {
    const user = userEvent.setup();
    let finish!: (v: { ok: true }) => void;
    vi.mocked(saveBanner).mockReturnValue(new Promise((r) => (finish = r)));
    form();
    await user.click(save());
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    finish({ ok: true });
    await waitFor(() => expect(save()).toBeEnabled());
  });
});

describe("BannerForm: button text and links", () => {
  test("each button starts with the usual wording filled in and its saved link chosen", () => {
    form();
    expect(mainButton().getByRole("textbox", { name: "Button text" })).toHaveValue("Explore Products");
    expect(secondButton().getByRole("textbox", { name: "Button text" })).toHaveValue("Our Story");
    expect(mainButton().getByRole("combobox", { name: "Goes to" })).toHaveValue("/products/");
    expect(secondButton().getByRole("combobox", { name: "Goes to" })).toHaveValue("/about/");
  });

  test("the link list shows every page, category and product, plus another link", () => {
    form();
    const picker = mainButton().getByRole("combobox", { name: "Goes to" });
    const names = within(picker).getAllByRole("option").map((o) => o.textContent);
    expect(names).toEqual(["Choose a page…", "All products", "Our story", "Contact", "Gift Sets", "Rose Mist", "Another link…"]);
    expect(within(picker).getByRole("group", { name: "Categories" })).toBeInTheDocument();
    expect(within(picker).getByRole("group", { name: "Products" })).toBeInTheDocument();
  });

  test("the chosen text and links are saved", async () => {
    const user = userEvent.setup();
    form();
    const text = mainButton().getByRole("textbox", { name: "Button text" });
    await user.clear(text);
    await user.type(text, "Shop gift sets");
    await user.selectOptions(mainButton().getByRole("combobox", { name: "Goes to" }), "Gift Sets");
    await user.selectOptions(secondButton().getByRole("combobox", { name: "Goes to" }), "Rose Mist");
    await user.click(save());
    expect(sent()).toMatchObject({
      primaryButton: { label: "Shop gift sets", link: "/products/?category=gift-sets" },
      secondaryButton: { label: "Our Story", link: "/products/rose-mist/" },
    });
  });

  test("text the admin saved before is shown instead of the usual wording", () => {
    form({ primaryButton: { label: "Shop the sale", link: "/products/" } });
    expect(mainButton().getByRole("textbox", { name: "Button text" })).toHaveValue("Shop the sale");
  });

  test("the new text shows in the button choices straight away", async () => {
    const user = userEvent.setup();
    form();
    const text = secondButton().getByRole("textbox", { name: "Button text" });
    await user.clear(text);
    await user.type(text, "Follow us");
    expect(screen.getByText(/Where should “Explore Products” and “Follow us” sit/)).toBeInTheDocument();
  });

  test("Another link lets the admin type any address", async () => {
    const user = userEvent.setup();
    form();
    await user.selectOptions(secondButton().getByRole("combobox", { name: "Goes to" }), "Another link…");
    const address = secondButton().getByRole("textbox", { name: "Link address" });
    await user.clear(address);
    await user.type(address, "https://instagram.com/melovme");
    await user.click(save());
    expect(sent().secondaryButton).toEqual({ label: "Our Story", link: "https://instagram.com/melovme" });
  });

  test("a saved link that isn't in the list opens as a typed link", () => {
    form({ primaryButton: { label: "Instagram", link: "https://instagram.com/melovme" } });
    expect(mainButton().getByRole("combobox", { name: "Goes to" })).toHaveValue("custom");
    expect(mainButton().getByRole("textbox", { name: "Link address" })).toHaveValue("https://instagram.com/melovme");
  });

  test("a bad typed link is refused before saving, and fixing it clears the message", async () => {
    const user = userEvent.setup();
    form();
    await user.selectOptions(mainButton().getByRole("combobox", { name: "Goes to" }), "Another link…");
    const address = mainButton().getByRole("textbox", { name: "Link address" });
    await user.clear(address);
    await user.type(address, "javascript:alert(1)");
    await user.click(save());
    expect(saveBanner).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Please fix the button text and links below.");
    expect(mainButton().getByText("Start with / (a shop page) or https://")).toBeInTheDocument();
    await user.clear(address);
    await user.type(address, "/contact/");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("with No buttons, the text and link boxes are hidden", async () => {
    const user = userEvent.setup();
    form();
    await user.click(screen.getByRole("radio", { name: /No buttons/ }));
    expect(screen.queryByRole("group", { name: /Main button/ })).toBeNull();
  });
});
