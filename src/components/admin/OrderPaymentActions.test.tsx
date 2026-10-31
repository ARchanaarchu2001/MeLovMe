import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { markCodPaid, refundOrder } from "@/app/actions/admin";
import type { Refund } from "@/lib/order";
import { MarkCodPaid, RefundPanel } from "./OrderPaymentActions";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/actions/admin", () => ({ markCodPaid: vi.fn(), refundOrder: vi.fn(), checkRefundStatus: vi.fn() }));
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
  vi.mocked(markCodPaid).mockResolvedValue({ ok: true });
  vi.mocked(refundOrder).mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe("MarkCodPaid", () => {
  test("says how much cash to collect", () => {
    render(<MarkCodPaid orderId="ML-1001" total={1550} />);
    expect(screen.getByText("Cash on delivery: collect ₹1,550 when it's delivered.")).toBeInTheDocument();
  });

  test("asks to confirm the cash before marking it paid", async () => {
    const user = userEvent.setup();
    render(<MarkCodPaid orderId="ML-1001" total={1550} />);
    await user.click(screen.getByRole("button", { name: "Mark cash received" }));
    expect(screen.getByText("Cash of ₹1,550 received?")).toBeInTheDocument();
    expect(markCodPaid).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Mark cash received" })).toBeInTheDocument();
    expect(markCodPaid).not.toHaveBeenCalled();
  });

  test("confirming marks the order paid and refreshes the page", async () => {
    const user = userEvent.setup();
    render(<MarkCodPaid orderId="ML-1001" total={1550} />);
    await user.click(screen.getByRole("button", { name: "Mark cash received" }));
    await user.click(screen.getByRole("button", { name: "Yes, mark paid" }));
    expect(markCodPaid).toHaveBeenCalledWith("ML-1001");
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  test("buttons are disabled while it saves", async () => {
    const user = userEvent.setup();
    let finish!: (v: { ok: true }) => void;
    vi.mocked(markCodPaid).mockReturnValue(new Promise((r) => (finish = r)));
    render(<MarkCodPaid orderId="ML-1001" total={1550} />);
    await user.click(screen.getByRole("button", { name: "Mark cash received" }));
    await user.click(screen.getByRole("button", { name: "Yes, mark paid" }));
    expect(screen.getByRole("button", { name: "Yes, mark paid" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    finish({ ok: true });
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  test("an error from the server is shown", async () => {
    const user = userEvent.setup();
    vi.mocked(markCodPaid).mockResolvedValue({ error: "This order isn't waiting for cash on delivery." });
    render(<MarkCodPaid orderId="ML-1001" total={1550} />);
    await user.click(screen.getByRole("button", { name: "Mark cash received" }));
    await user.click(screen.getByRole("button", { name: "Yes, mark paid" }));
    expect(await screen.findByText("This order isn't waiting for cash on delivery.")).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe("RefundPanel", () => {
  const refund = (id: string, amount: number, status: Refund["status"]): Refund => ({ id, amount, status, createdAt: new Date() });
  const amountBox = () => screen.getByRole("textbox", { name: /Amount/ });
  const panel = (props: Partial<Parameters<typeof RefundPanel>[0]> = {}) =>
    render(<RefundPanel orderId="ML-1001" refunds={[]} refundable={1550} total={1550} delivered={false} {...props} />);

  test("the amount starts at what's left to refund", () => {
    panel({ refundable: 1000 });
    expect(amountBox()).toHaveValue("1000");
    expect(screen.getByText("Amount (₹), up to ₹1,000")).toBeInTheDocument();
  });

  test("only digits can be typed in the amount", async () => {
    const user = userEvent.setup();
    panel();
    await user.clear(amountBox());
    await user.type(amountBox(), "5.5x0");
    expect(amountBox()).toHaveValue("550");
  });

  test("an empty or zero amount is refused", async () => {
    const user = userEvent.setup();
    panel();
    await user.clear(amountBox());
    await user.click(screen.getByRole("button", { name: "Refund" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter the amount to refund.");
    await user.type(amountBox(), "0");
    await user.click(screen.getByRole("button", { name: "Refund" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter the amount to refund.");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("more than what's left is refused", async () => {
    const user = userEvent.setup();
    panel({ refundable: 1000 });
    await user.clear(amountBox());
    await user.type(amountBox(), "1001");
    await user.click(screen.getByRole("button", { name: "Refund" }));
    expect(screen.getByRole("alert")).toHaveTextContent("You can refund up to ₹1,000.");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("typing clears the message", async () => {
    const user = userEvent.setup();
    panel();
    await user.clear(amountBox());
    await user.click(screen.getByRole("button", { name: "Refund" }));
    await user.type(amountBox(), "5");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("a full refund asks first, saying it's the full amount", async () => {
    const user = userEvent.setup();
    panel();
    await user.click(screen.getByRole("button", { name: "Refund" }));
    const dialog = screen.getByRole("dialog", { name: "Refund ₹1,550?" });
    expect(dialog).toHaveTextContent("Order ML-1001 · full amount");
    expect(refundOrder).not.toHaveBeenCalled();
  });

  test("a part refund says how much of the total it is", async () => {
    const user = userEvent.setup();
    panel();
    await user.clear(amountBox());
    await user.type(amountBox(), "500");
    await user.click(screen.getByRole("button", { name: "Refund" }));
    expect(screen.getByRole("dialog", { name: "Refund ₹500?" })).toHaveTextContent("Order ML-1001 · of ₹1,550");
  });

  test("cancelling the question doesn't refund", async () => {
    const user = userEvent.setup();
    panel();
    await user.click(screen.getByRole("button", { name: "Refund" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(refundOrder).not.toHaveBeenCalled();
  });

  test("confirming refunds the amount through Razorpay and refreshes", async () => {
    const user = userEvent.setup();
    let finish!: (v: { ok: true }) => void;
    vi.mocked(refundOrder).mockReturnValue(new Promise((r) => (finish = r)));
    panel();
    await user.clear(amountBox());
    await user.type(amountBox(), "500");
    await user.click(screen.getByRole("button", { name: "Refund" }));
    await user.click(screen.getByRole("button", { name: "Yes, refund" }));
    expect(refundOrder).toHaveBeenCalledWith("ML-1001", 500);
    expect(screen.getByRole("button", { name: "Refunding…" })).toBeDisabled();
    finish({ ok: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(router.refresh).toHaveBeenCalled();
  });

  test("Razorpay's error is shown after the question closes", async () => {
    const user = userEvent.setup();
    vi.mocked(refundOrder).mockResolvedValue({ error: "Razorpay couldn't make the refund: insufficient balance" });
    panel();
    await user.click(screen.getByRole("button", { name: "Refund" }));
    await user.click(screen.getByRole("button", { name: "Yes, refund" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Razorpay couldn't make the refund: insufficient balance");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  test("lists past refunds with their status, and offers to check the pending ones", () => {
    panel({ refunds: [refund("rfnd_A", 500, "processed"), refund("rfnd_B", 300, "pending")], refundable: 750 });
    expect(screen.getByText("rfnd_A").closest("li")).toHaveTextContent("₹500");
    expect(screen.getByText("rfnd_A").closest("li")).toHaveTextContent("Refunded");
    expect(screen.getByText("rfnd_B").closest("li")).toHaveTextContent("Refund initiated");
    expect(screen.getByRole("button", { name: /Check refund status/ })).toHaveTextContent("1");
  });

  test("no refund box once everything is refunded", () => {
    panel({ refunds: [refund("rfnd_A", 1550, "processed")], refundable: 0 });
    expect(screen.getByText("The full ₹1,550 has been refunded.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refund" })).toBeNull();
  });

  test("no refund box once the order is delivered", () => {
    panel({ delivered: true });
    expect(screen.getByText("Refunds aren't available once an order is delivered.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
