import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { saveAdminReview } from "@/app/actions/admin";
import AdminReviewForm from "./AdminReviewForm";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/actions/admin", () => ({ saveAdminReview: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(saveAdminReview).mockResolvedValue({ ok: true });
});
afterEach(cleanup);

const products = [
  { slug: "rose-mist", name: "Rose Body Mist" },
  { slug: "lip-balm", name: "Lip Balm" },
];
const empty = { productSlug: "", rating: 0, name: "", title: "", text: "" };
const existing = { productSlug: "lip-balm", rating: 4, name: "Anjali R.", title: "Lovely", text: "Keeps my lips soft all day." };

const nameBox = () => screen.getByRole("textbox", { name: /Reviewer name/ });
const titleBox = () => screen.getByRole("textbox", { name: /Title/ });
const textBox = () => screen.getByRole("textbox", { name: /^Review(?!er)/ });

async function fillIn(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Choose a product" }));
  await user.click(screen.getByRole("option", { name: /Rose Body Mist/ }));
  await user.click(screen.getByRole("button", { name: "5 stars" }));
  await user.type(nameBox(), "Priya S.");
  await user.type(textBox(), "Smells like real roses.");
}

describe("AdminReviewForm", () => {
  test("editing: the review's product, stars and text are filled in", () => {
    render(<AdminReviewForm id="r1" products={products} initial={existing} />);
    expect(screen.getByRole("button", { name: "Lip Balm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4 stars" })).toHaveAttribute("aria-pressed", "true");
    expect(nameBox()).toHaveValue("Anjali R.");
    expect(titleBox()).toHaveValue("Lovely");
    expect(textBox()).toHaveValue("Keeps my lips soft all day.");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  test("an empty form shows what's missing and isn't sent", async () => {
    const user = userEvent.setup();
    render(<AdminReviewForm id={null} products={products} initial={empty} />);
    await user.click(screen.getByRole("button", { name: "Add review" }));
    expect(screen.getByText("Choose a product.")).toBeInTheDocument();
    expect(screen.getByText("Choose a rating from 1 to 5 stars.")).toBeInTheDocument();
    expect(screen.getByText("Enter the name to show with the review.")).toBeInTheDocument();
    expect(screen.getByText("Write the review.")).toBeInTheDocument();
    expect(nameBox()).toHaveAttribute("aria-invalid", "true");
    expect(saveAdminReview).not.toHaveBeenCalled();
  });

  test("a name with digits and a too-short review are refused", async () => {
    const user = userEvent.setup();
    render(<AdminReviewForm id="r1" products={products} initial={{ ...existing, name: "Anjali 99", text: "Good" }} />);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("Use letters only, e.g. Anjali R.")).toBeInTheDocument();
    expect(screen.getByText("Write at least 5 characters.")).toBeInTheDocument();
    expect(saveAdminReview).not.toHaveBeenCalled();
  });

  test("typing in a field clears its message", async () => {
    const user = userEvent.setup();
    render(<AdminReviewForm id={null} products={products} initial={empty} />);
    await user.click(screen.getByRole("button", { name: "Add review" }));
    await user.type(nameBox(), "P");
    expect(screen.queryByText("Enter the name to show with the review.")).toBeNull();
    expect(screen.getByText("Write the review.")).toBeInTheDocument();
  });

  test("a new review is sent with its product and goes back to the shop's reviews", async () => {
    const user = userEvent.setup();
    render(<AdminReviewForm id={null} products={products} initial={empty} />);
    await fillIn(user);
    await user.click(screen.getByRole("button", { name: "Add review" }));
    expect(saveAdminReview).toHaveBeenCalledWith(null, "rose-mist", {
      rating: 5,
      name: "Priya S.",
      title: "",
      text: "Smells like real roses.",
    });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/reviews/?view=admin"));
  });

  test("editing sends the review's id", async () => {
    const user = userEvent.setup();
    render(<AdminReviewForm id="r1" products={products} initial={existing} />);
    await user.click(screen.getByRole("button", { name: "2 stars" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(saveAdminReview).toHaveBeenCalledWith("r1", "lip-balm", expect.objectContaining({ rating: 2 }));
  });

  test("the server's messages are shown and the page stays", async () => {
    const user = userEvent.setup();
    vi.mocked(saveAdminReview).mockResolvedValue({ errors: { text: "This review no longer exists, or was written by a customer." } });
    render(<AdminReviewForm id="r1" products={products} initial={existing} />);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("This review no longer exists, or was written by a customer.")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  test("shows Saving… while saving", async () => {
    const user = userEvent.setup();
    let finish!: (v: { ok: true }) => void;
    vi.mocked(saveAdminReview).mockReturnValue(new Promise((r) => (finish = r)));
    render(<AdminReviewForm id="r1" products={products} initial={existing} />);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    finish({ ok: true });
    await waitFor(() => expect(router.push).toHaveBeenCalled());
  });
});
