import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { getMyReview } from "@/app/actions/reviews";
import type { Review, ReviewSummary } from "@/lib/review";
import { renderWithIntl } from "@/test/render";
import ProductReviews from "./ProductReviews";

// A Server Component: its text comes from next-intl/server, here read straight from en.json
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const en = (await import("@/i18n/messages/en.json")).default;
  return { getTranslations: async (namespace: string) => createTranslator({ locale: "en", messages: en, namespace: namespace as never }) };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/products/body-lotion/" }));
vi.mock("@/app/actions/reviews", () => ({ getMyReview: vi.fn(), saveMyReview: vi.fn() }));
vi.mocked(getMyReview).mockResolvedValue({ loggedIn: false });

afterEach(cleanup);

const none: ReviewSummary = { average: 0, count: 0, byStars: [0, 0, 0, 0, 0] };
const summary: ReviewSummary = { average: 4.5, count: 4, byStars: [3, 0, 1, 0, 0] };
const reviews: Review[] = [
  { id: "r1", name: "Priya", rating: 5, title: "Love it", text: "So soft.", verified: true, createdAt: "2026-06-10T10:00:00+05:30" },
  { id: "r2", name: "Arjun", rating: 3, title: "", text: "Okay.", verified: false, createdAt: "2026-06-12T10:00:00+05:30" },
];

const show = async (s: ReviewSummary, r: Review[]) => renderWithIntl(await ProductReviews({ slug: "body-lotion", summary: s, reviews: r }));

describe("ProductReviews", () => {
  test("with no reviews it invites the first one", async () => {
    await show(none, []);
    expect(screen.getByText("No reviews yet. Be the first to share how it feels.")).toBeInTheDocument();
    expect(screen.queryByText(/out of 5/)).toBeNull();
    expect(await screen.findByRole("link", { name: "Log in to write a review" })).toBeInTheDocument();
  });

  test("shows the average, the count and how many gave each number of stars", async () => {
    await show(summary, reviews);
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "4.5 out of 5 stars" })).toBeInTheDocument();
    expect(screen.getByText("4 reviews")).toBeInTheDocument();
    expect(screen.getByLabelText("5 stars: 3")).toBeInTheDocument();
    expect(screen.getByLabelText("3 stars: 1")).toBeInTheDocument();
  });

  test("lists each review with its stars, date, title, text and name", async () => {
    await show(summary, reviews);
    const [first, second] = within(screen.getAllByRole("list").at(-1)!).getAllByRole("listitem");
    expect(within(first).getByRole("img", { name: "5 out of 5 stars" })).toBeInTheDocument();
    expect(within(first).getByRole("heading", { name: "Love it" })).toBeInTheDocument();
    expect(first).toHaveTextContent("10 June 2026");
    expect(first).toHaveTextContent("So soft.");
    expect(first).toHaveTextContent("Priya");
    // A review without a title has no heading
    expect(within(second).queryByRole("heading")).toBeNull();
  });

  test("only reviews from buyers are marked Verified buyer", async () => {
    await show(summary, reviews);
    expect(screen.getAllByText("Verified buyer")).toHaveLength(1);
  });
});
