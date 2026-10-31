import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getMyReview, saveMyReview } from "@/app/actions/reviews";
import { renderWithIntl } from "@/test/render";
import ReviewForm from "./ReviewForm";

const nav = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav, usePathname: () => "/products/body-lotion/" }));
vi.mock("@/app/actions/reviews", () => ({ getMyReview: vi.fn(), saveMyReview: vi.fn() }));

beforeEach(() => {
  vi.mocked(getMyReview).mockReset();
  vi.mocked(saveMyReview).mockReset();
  nav.refresh.mockReset();
});
afterEach(cleanup);

const loggedIn = (review: Parameters<typeof saveMyReview>[1] | null = null) =>
  vi.mocked(getMyReview).mockResolvedValue({ loggedIn: true, name: "Priya S", review });
const earlier = { name: "Priya", rating: 4, title: "Lovely", text: "Soft and light." };

describe("ReviewForm", () => {
  test("a visitor who isn't logged in is sent to log in and back to the reviews", async () => {
    vi.mocked(getMyReview).mockResolvedValue({ loggedIn: false });
    renderWithIntl(<ReviewForm slug="body-lotion" />);
    const link = await screen.findByRole("link", { name: "Log in to write a review" });
    expect(decodeURIComponent(link.getAttribute("href")!)).toContain("next=/products/body-lotion/#reviews");
    expect(getMyReview).toHaveBeenCalledWith("body-lotion");
  });

  test("if checking the login fails it's treated as logged out", async () => {
    vi.mocked(getMyReview).mockRejectedValue(new Error("offline"));
    renderWithIntl(<ReviewForm slug="body-lotion" />);
    expect(await screen.findByRole("link", { name: "Log in to write a review" })).toBeInTheDocument();
  });

  test("a logged-in customer can open the form, with their name filled in", async () => {
    loggedIn();
    const user = userEvent.setup();
    renderWithIntl(<ReviewForm slug="body-lotion" />);
    await user.click(await screen.findByRole("button", { name: "Write a Review" }));
    expect(screen.getByRole("textbox", { name: "Name shown with your review" })).toHaveValue("Priya S");
    expect(screen.getByRole("button", { name: "Post Review" })).toBeInTheDocument();
  });

  test("picking stars and writing a review posts it, then thanks them", async () => {
    loggedIn();
    vi.mocked(saveMyReview).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderWithIntl(<ReviewForm slug="body-lotion" />);
    await user.click(await screen.findByRole("button", { name: "Write a Review" }));
    await user.click(screen.getByRole("button", { name: "5 stars" }));
    expect(screen.getByRole("button", { name: "5 stars" })).toHaveAttribute("aria-pressed", "true");
    await user.type(screen.getByRole("textbox", { name: "Title (optional)" }), "Love it");
    await user.type(screen.getByRole("textbox", { name: "Your review" }), "Smells amazing.");
    await user.click(screen.getByRole("button", { name: "Post Review" }));
    expect(saveMyReview).toHaveBeenCalledWith("body-lotion", { name: "Priya S", rating: 5, title: "Love it", text: "Smells amazing." });
    expect(await screen.findByRole("status")).toHaveTextContent("Thank you! Your review is posted.");
    expect(nav.refresh).toHaveBeenCalled();
    // Now they can edit it
    expect(screen.getByRole("button", { name: "Edit Your Review" })).toBeInTheDocument();
  });

  test("a problem with a field is shown under it and the form stays open", async () => {
    loggedIn();
    vi.mocked(saveMyReview).mockResolvedValue({ error: "Please choose a star rating.", field: "rating" });
    const user = userEvent.setup();
    renderWithIntl(<ReviewForm slug="body-lotion" />);
    await user.click(await screen.findByRole("button", { name: "Write a Review" }));
    await user.click(screen.getByRole("button", { name: "Post Review" }));
    expect(await screen.findByText("Please choose a star rating.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post Review" })).toBeInTheDocument();
    expect(nav.refresh).not.toHaveBeenCalled();
  });

  test("a general problem is shown under the form", async () => {
    loggedIn();
    vi.mocked(saveMyReview).mockResolvedValue({ error: "Something went wrong. Please try again." });
    const user = userEvent.setup();
    renderWithIntl(<ReviewForm slug="body-lotion" />);
    await user.click(await screen.findByRole("button", { name: "Write a Review" }));
    await user.click(screen.getByRole("button", { name: "Post Review" }));
    expect(await screen.findByText("Something went wrong. Please try again.")).toBeInTheDocument();
  });

  test("a customer who already reviewed it edits their review", async () => {
    loggedIn(earlier);
    vi.mocked(saveMyReview).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderWithIntl(<ReviewForm slug="body-lotion" />);
    await user.click(await screen.findByRole("button", { name: "Edit Your Review" }));
    expect(screen.getByRole("textbox", { name: "Your review" })).toHaveValue("Soft and light.");
    expect(screen.getByRole("button", { name: "4 stars" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Update Review" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Your review is updated.");
  });

  test("Cancel closes the form without saving", async () => {
    loggedIn();
    const user = userEvent.setup();
    renderWithIntl(<ReviewForm slug="body-lotion" />);
    await user.click(await screen.findByRole("button", { name: "Write a Review" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Write a Review" })).toBeInTheDocument();
    expect(saveMyReview).not.toHaveBeenCalled();
  });
});
