import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { deleteReview, setReviewHidden } from "@/app/actions/admin";
import ReviewActions from "./ReviewActions";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/actions/admin", () => ({ deleteReview: vi.fn(), setReviewHidden: vi.fn() }));
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
  vi.mocked(setReviewHidden).mockResolvedValue({ ok: true });
  vi.mocked(deleteReview).mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe("ReviewActions", () => {
  test("a shown review offers to hide it, and clicking hides it", async () => {
    const user = userEvent.setup();
    render(<ReviewActions id="r1" hidden={false} editable={false} by="Anjali" />);
    await user.click(screen.getByRole("button", { name: "Shown in the shop. Click to hide it" }));
    expect(setReviewHidden).toHaveBeenCalledWith("r1", true);
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  test("a hidden review offers to show it again", async () => {
    const user = userEvent.setup();
    render(<ReviewActions id="r1" hidden editable={false} by="Anjali" />);
    await user.click(screen.getByRole("button", { name: "Hidden from the shop. Click to show it" }));
    expect(setReviewHidden).toHaveBeenCalledWith("r1", false);
  });

  test("the hide button is disabled while it saves", async () => {
    const user = userEvent.setup();
    let finish!: (v: { ok: true }) => void;
    vi.mocked(setReviewHidden).mockReturnValue(new Promise((r) => (finish = r)));
    render(<ReviewActions id="r1" hidden={false} editable={false} by="Anjali" />);
    const button = screen.getByRole("button", { name: /Click to hide it/ });
    await user.click(button);
    expect(button).toBeDisabled();
    finish({ ok: true });
    await waitFor(() => expect(button).toBeEnabled());
  });

  test("only reviews the shop added can be edited", () => {
    const { unmount } = render(<ReviewActions id="r1" hidden={false} editable={false} by="Anjali" />);
    expect(screen.queryByRole("link", { name: "Edit review" })).toBeNull();
    unmount();
    render(<ReviewActions id="r1" hidden={false} editable by="Anjali" />);
    expect(screen.getByRole("link", { name: "Edit review" })).toHaveAttribute("href", "/admin/reviews/r1/");
  });

  test("delete asks first, naming who wrote it", async () => {
    const user = userEvent.setup();
    render(<ReviewActions id="r1" hidden={false} editable={false} by="Anjali" />);
    await user.click(screen.getByRole("button", { name: "Delete review" }));
    expect(screen.getByRole("dialog", { name: "Delete this review?" })).toHaveTextContent("By Anjali");
    expect(deleteReview).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deleteReview).not.toHaveBeenCalled();
  });

  test("confirming deletes the review, shows Deleting… meanwhile and refreshes the list", async () => {
    const user = userEvent.setup();
    let finish!: (v: { ok: true }) => void;
    vi.mocked(deleteReview).mockReturnValue(new Promise((r) => (finish = r)));
    render(<ReviewActions id="r1" hidden={false} editable={false} by="Anjali" />);
    await user.click(screen.getByRole("button", { name: "Delete review" }));
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(deleteReview).toHaveBeenCalledWith("r1");
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    finish({ ok: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(router.refresh).toHaveBeenCalled();
  });
});
