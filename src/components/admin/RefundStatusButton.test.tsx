import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { checkRefundStatus } from "@/app/actions/admin";
import RefundStatusButton from "./RefundStatusButton";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/actions/admin", () => ({ checkRefundStatus: vi.fn() }));
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
  vi.mocked(checkRefundStatus).mockResolvedValue([]);
});
afterEach(cleanup);

const button = () => screen.getByRole("button", { name: /Check refund status/ });

describe("RefundStatusButton", () => {
  test("with nothing pending it's greyed out and says so", () => {
    render(<RefundStatusButton pending={0} />);
    expect(button()).toBeDisabled();
    expect(screen.getByText("No refunds waiting for Razorpay.")).toBeInTheDocument();
  });

  test("shows how many refunds are pending", () => {
    render(<RefundStatusButton pending={3} />);
    expect(button()).toBeEnabled();
    expect(button()).toHaveTextContent("3");
  });

  test("asks first and doesn't contact Razorpay until confirmed", async () => {
    const user = userEvent.setup();
    render(<RefundStatusButton orderId="ML-1001" pending={1} />);
    await user.click(button());
    expect(screen.getByRole("dialog", { name: "Check refund status?" })).toHaveTextContent("Order ML-1001 · 1 refund");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(checkRefundStatus).not.toHaveBeenCalled();
  });

  test("for all orders, the question counts the refunds in progress", async () => {
    const user = userEvent.setup();
    render(<RefundStatusButton pending={2} />);
    await user.click(button());
    expect(screen.getByRole("dialog")).toHaveTextContent("2 refunds in progress");
  });

  test("confirming asks Razorpay for this order, then lists what it said and refreshes", async () => {
    const user = userEvent.setup();
    vi.mocked(checkRefundStatus).mockResolvedValue([
      { orderId: "ML-1001", refundId: "rfnd_1", amount: 500, status: "processed" },
      { orderId: "ML-1001", refundId: "rfnd_2", amount: 300, status: "pending" },
      { orderId: "ML-1001", refundId: "rfnd_3", amount: 200, status: "failed" },
      { orderId: "ML-1001", refundId: "rfnd_4", amount: 100, status: null },
    ]);
    render(<RefundStatusButton orderId="ML-1001" pending={4} />);
    await user.click(button());
    await user.click(screen.getByRole("button", { name: "Yes, check now" }));
    expect(checkRefundStatus).toHaveBeenCalledWith("ML-1001");
    const said = await screen.findByRole("status");
    const items = within(said).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("₹500");
    expect(items[0]).toHaveTextContent("Refunded · money sent back");
    expect(items[1]).toHaveTextContent("Refund initiated · still in progress");
    expect(items[2]).toHaveTextContent("Refund failed");
    expect(items[3]).toHaveTextContent("Couldn't reach Razorpay, try again");
    // One order: its number isn't repeated on every line
    expect(said).not.toHaveTextContent("ML-1001");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.refresh).toHaveBeenCalled();
  });

  test("for all orders, each line names its order", async () => {
    const user = userEvent.setup();
    vi.mocked(checkRefundStatus).mockResolvedValue([{ orderId: "ML-1002", refundId: "rfnd_1", amount: 500, status: "processed" }]);
    render(<RefundStatusButton pending={1} />);
    await user.click(button());
    await user.click(screen.getByRole("button", { name: "Yes, check now" }));
    expect(checkRefundStatus).toHaveBeenCalledWith(undefined);
    expect(await screen.findByRole("status")).toHaveTextContent("ML-1002");
  });

  test("when nothing was waiting it says so", async () => {
    const user = userEvent.setup();
    render(<RefundStatusButton pending={1} />);
    await user.click(button());
    await user.click(screen.getByRole("button", { name: "Yes, check now" }));
    expect(await screen.findByText("No refunds were waiting.")).toBeInTheDocument();
  });

  test("shows Checking with Razorpay… while it waits", async () => {
    const user = userEvent.setup();
    let finish!: (v: []) => void;
    vi.mocked(checkRefundStatus).mockReturnValue(new Promise((r) => (finish = r)));
    render(<RefundStatusButton pending={1} />);
    await user.click(button());
    await user.click(screen.getByRole("button", { name: "Yes, check now" }));
    expect(screen.getByRole("button", { name: "Checking with Razorpay…" })).toBeDisabled();
    finish([]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
