import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { saveTestimonials } from "@/app/actions/admin";
import type { Testimonials } from "@/lib/testimonials";
import { shrink, uploadToCloudinary } from "@/lib/upload";
import TestimonialsForm from "./TestimonialsForm";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/actions/admin", () => ({ saveTestimonials: vi.fn() }));
vi.mock("@/lib/upload", () => ({
  IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"],
  shrink: vi.fn(async (file: File) => file),
  uploadToCloudinary: vi.fn(),
}));
// The real section is tested with the home page; the preview only has to show what it's given
vi.mock("@/components/Testimonials", () => ({
  default: ({ data }: { data: Testimonials }) => <div>Preview of {data.items.length} reviews</div>,
}));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  // Adding a review scrolls to it; jsdom can't scroll
  Element.prototype.scrollIntoView = vi.fn();
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(saveTestimonials).mockResolvedValue({ ok: true });
});
afterEach(cleanup);

const heading = { eyebrow: "Reviews", title: "Loved by our community" };
const data: Testimonials = {
  enabled: true,
  layout: "grid",
  autoScroll: false,
  items: [
    { id: "a", name: "Priya R.", place: "Chennai", message: "The lotion absorbs in seconds.", photo: null },
    { id: "b", name: "Meera K.", place: "", message: "Lovely rose scent.", photo: "https://res.cloudinary.com/demo/meera.webp" },
  ],
};
const form = (t: Partial<Testimonials> = {}) => render(<TestimonialsForm initial={{ ...data, ...t }} heading={heading} />);
const reviews = () => screen.getAllByRole("textbox", { name: "Review" });
const names = () => screen.getAllByRole("textbox", { name: "Name" });
const save = () => screen.getByRole("button", { name: "Save changes" });
const sent = () => vi.mocked(saveTestimonials).mock.calls.at(-1)![0];
const fileInputs = (c: HTMLElement) => c.querySelectorAll<HTMLInputElement>('input[type="file"]');

describe("TestimonialsForm", () => {
  test("the saved reviews and layout are filled in", () => {
    form();
    expect(screen.getByRole("heading", { name: /Reviews \(2\)/ })).toBeInTheDocument();
    expect(reviews().map((r) => (r as HTMLTextAreaElement).value)).toEqual(["The lotion absorbs in seconds.", "Lovely rose scent."]);
    expect(names()[0]).toHaveValue("Priya R.");
    expect(screen.getAllByRole("textbox", { name: /City/ })[0]).toHaveValue("Chennai");
    expect(screen.getByRole("checkbox", { name: "Shown on home page" })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Grid/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Change photo" })).toBeInTheDocument();
  });

  test("Scroll by itself is only offered for the slider", async () => {
    const user = userEvent.setup();
    form();
    expect(screen.queryByRole("checkbox", { name: /Scroll by itself/ })).toBeNull();
    await user.click(screen.getByRole("radio", { name: /Slider/ }));
    await user.click(screen.getByRole("checkbox", { name: /Scroll by itself/ }));
    await user.click(save());
    expect(sent()).toMatchObject({ layout: "slider", autoScroll: true });
  });

  test("saving sends the reviews and says the home page is updated", async () => {
    const user = userEvent.setup();
    form();
    await user.type(names()[1], " Iyer");
    await user.click(save());
    expect(sent().items[1].name).toBe("Meera K. Iyer");
    expect(await screen.findByRole("status")).toHaveTextContent("Saved. The home page is updated.");
    expect(router.refresh).toHaveBeenCalled();
  });

  test("saving a hidden section says customers don't see it", async () => {
    const user = userEvent.setup();
    form();
    await user.click(screen.getByRole("checkbox", { name: "Shown on home page" }));
    await user.click(save());
    expect(await screen.findByRole("status")).toHaveTextContent("Saved. The section is hidden, so customers don't see it.");
  });

  test("a new review needs its text and who wrote it", async () => {
    const user = userEvent.setup();
    form();
    await user.click(screen.getByRole("button", { name: /Add a review/ }));
    expect(reviews()).toHaveLength(3);
    await user.click(save());
    expect(screen.getByRole("alert")).toHaveTextContent("Please fix the highlighted reviews.");
    expect(screen.getByText("Enter the review.")).toBeInTheDocument();
    expect(screen.getByText("Enter who wrote it.")).toBeInTheDocument();
    expect(reviews()[2]).toHaveAttribute("aria-invalid", "true");
    expect(saveTestimonials).not.toHaveBeenCalled();
  });

  test("typing in a field clears its message", async () => {
    const user = userEvent.setup();
    form();
    await user.click(screen.getByRole("button", { name: /Add a review/ }));
    await user.click(save());
    await user.type(reviews()[2], "Great");
    expect(screen.queryByText("Enter the review.")).toBeNull();
    expect(screen.getByText("Enter who wrote it.")).toBeInTheDocument();
  });

  test("a shown section needs at least one review", async () => {
    const user = userEvent.setup();
    form({ items: [] });
    expect(screen.getByText("No reviews yet.")).toBeInTheDocument();
    await user.click(save());
    expect(screen.getByRole("alert")).toHaveTextContent("Add at least one review, or hide the section.");
    expect(saveTestimonials).not.toHaveBeenCalled();
  });

  test("reviews can be moved and deleted, and are saved in that order", async () => {
    const user = userEvent.setup();
    form();
    expect(screen.getByRole("button", { name: "Move review 1 up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move review 2 down" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Move review 2 up" }));
    expect(names()[0]).toHaveValue("Meera K.");
    await user.click(screen.getByRole("button", { name: "Delete review 2" }));
    await user.click(save());
    expect(sent().items.map((r) => r.name)).toEqual(["Meera K."]);
  });

  test("Add a review is disabled at 24 reviews", () => {
    form({ items: Array.from({ length: 24 }, (_, i) => ({ id: `r${i}`, name: "A", place: "", message: "B", photo: null })) });
    expect(screen.getByRole("button", { name: /Up to 24 reviews/ })).toBeDisabled();
  });

  test("a photo is uploaded small and added to the review", async () => {
    const user = userEvent.setup();
    vi.mocked(uploadToCloudinary).mockResolvedValue({ url: "https://res.cloudinary.com/demo/priya.webp", width: 600, height: 600 });
    const { container } = form();
    await user.upload(fileInputs(container)[0], new File(["x"], "priya.jpg", { type: "image/jpeg" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Change photo" })).toHaveLength(2));
    expect(shrink).toHaveBeenCalledWith(expect.any(File), 600);
    expect(uploadToCloudinary).toHaveBeenCalledWith(expect.anything(), "testimonial");
    await user.click(save());
    expect(sent().items[0].photo).toBe("https://res.cloudinary.com/demo/priya.webp");
  });

  test("a photo can be removed", async () => {
    const user = userEvent.setup();
    form();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(save());
    expect(sent().items[1].photo).toBeNull();
  });

  test("a file that isn't a photo is refused", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = form();
    await user.upload(fileInputs(container)[0], new File(["x"], "notes.pdf", { type: "application/pdf" }));
    expect(await screen.findByText("Use a JPG, PNG or WebP photo.")).toBeInTheDocument();
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });

  test("a failed photo upload shows why", async () => {
    const user = userEvent.setup();
    vi.mocked(uploadToCloudinary).mockRejectedValue(new Error("Upload failed"));
    const { container } = form();
    await user.upload(fileInputs(container)[0], new File(["x"], "priya.jpg", { type: "image/jpeg" }));
    expect(await screen.findByText("Upload failed")).toBeInTheDocument();
  });

  test("without a photo, the reviewer's initials are shown", () => {
    form();
    expect(screen.getByText("PR")).toBeInTheDocument();
  });

  test("Preview opens the section as customers see it", async () => {
    const user = userEvent.setup();
    form();
    await user.click(screen.getByRole("button", { name: "Preview" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("open");
    expect(within(dialog).getByText("Preview of 2 reviews")).toBeInTheDocument();
  });

  test("Preview is disabled without reviews", () => {
    form({ items: [] });
    expect(screen.getByRole("button", { name: "Preview" })).toBeDisabled();
  });

  test("the server's message is shown", async () => {
    const user = userEvent.setup();
    vi.mocked(saveTestimonials).mockResolvedValue({ errors: { form: "Up to 24 reviews." } });
    form();
    await user.click(save());
    expect(await screen.findByRole("alert")).toHaveTextContent("Up to 24 reviews.");
  });

  test("shows Saving… while saving", async () => {
    const user = userEvent.setup();
    let finish!: (v: { ok: true }) => void;
    vi.mocked(saveTestimonials).mockReturnValue(new Promise((r) => (finish = r)));
    form();
    await user.click(save());
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    finish({ ok: true });
    await waitFor(() => expect(save()).toBeEnabled());
  });
});
