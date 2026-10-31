import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { updateOrder } from "@/app/actions/admin";
import type { Fulfillment } from "@/lib/order";
import OrderUpdateForm from "./OrderUpdateForm";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/actions/admin", () => ({ updateOrder: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(updateOrder).mockResolvedValue({ ok: true });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const saved = (fulfillment: Fulfillment = "packed") => ({ fulfillment, courier: "Delhivery", trackingNumber: "DL12345", adminNote: "Gift wrap" });
const form = (fulfillment?: Fulfillment, paidOnline = true) => render(<OrderUpdateForm orderId="ML-1001" initial={saved(fulfillment)} paidOnline={paidOnline} />);
const statusBox = () => screen.getByRole("combobox", { name: "Change status to" });
const courier = () => screen.getByRole("textbox", { name: "Courier" });
const tracking = () => screen.getByRole("textbox", { name: "Tracking number" });

async function pick(user: ReturnType<typeof userEvent.setup>, status: string) {
  await user.click(statusBox());
  await user.click(screen.getByRole("option", { name: new RegExp(`^${status}`) }));
}

describe("OrderUpdateForm", () => {
  test("shows the saved status, courier, tracking number and note", () => {
    form();
    expect(screen.getByRole("list", { name: "Delivery progress" }).querySelector('[aria-current="step"]')).toHaveTextContent("Packed");
    expect(statusBox()).toHaveTextContent("Packed");
    expect(courier()).toHaveValue("Delhivery");
    expect(tracking()).toHaveValue("DL12345");
    expect(screen.getByRole("textbox", { name: "Private note" })).toHaveValue("Gift wrap");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  test("a cancelled order shows Cancelled instead of the progress track", () => {
    form("cancelled");
    expect(screen.queryByRole("list", { name: "Delivery progress" })).toBeNull();
    expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0);
  });

  test("picking a new status says what saving will do and names it on the button", async () => {
    const user = userEvent.setup();
    form();
    await pick(user, "Shipped");
    expect(screen.getByText(/when you save/)).toHaveTextContent("Packed → Shipped when you save.");
    expect(screen.getByRole("button", { name: "Save as Shipped" })).toBeInTheDocument();
  });

  test("moving back a step is pointed out", async () => {
    const user = userEvent.setup();
    form("shipped");
    await pick(user, "Packed");
    expect(screen.getByText(/when you save/)).toHaveTextContent("This moves the order back a step.");
  });

  test("choosing Cancelled warns that items go back in stock and money isn't refunded by itself", async () => {
    const user = userEvent.setup();
    form("packed", true);
    await pick(user, "Cancelled");
    expect(screen.getByText(/Saving cancels the order/)).toHaveTextContent("The money isn't refunded automatically");
  });

  test("the status list works with the keyboard", async () => {
    const user = userEvent.setup();
    form("placed");
    statusBox().focus();
    await user.keyboard("{Enter}");
    expect(statusBox()).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(statusBox()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Save as Shipped" })).toBeInTheDocument();
  });

  test("saving sends every field and says Saved", async () => {
    const user = userEvent.setup();
    form();
    await pick(user, "Shipped");
    await user.clear(tracking());
    await user.type(tracking(), "DL-99887");
    await user.click(screen.getByRole("button", { name: "Save as Shipped" }));
    expect(updateOrder).toHaveBeenCalledWith("ML-1001", { fulfillment: "shipped", courier: "Delhivery", trackingNumber: "DL-99887", adminNote: "Gift wrap" });
    expect(await screen.findByRole("status")).toHaveTextContent("Saved.");
    expect(router.refresh).toHaveBeenCalled();
  });

  test("a tracking number without a courier is refused", async () => {
    const user = userEvent.setup();
    form();
    await user.clear(courier());
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("Enter the courier for this tracking number.")).toBeInTheDocument();
    expect(courier()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Please fix the highlighted fields.");
    expect(updateOrder).not.toHaveBeenCalled();
  });

  test("a bad tracking number or courier name is refused", async () => {
    const user = userEvent.setup();
    form();
    await user.clear(tracking());
    await user.type(tracking(), "AB 1");
    await user.clear(courier());
    await user.type(courier(), "@Fast!");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("Use letters, numbers and dashes, at least 4.")).toBeInTheDocument();
    expect(screen.getByText("Use letters and numbers only, e.g. Delhivery.")).toBeInTheDocument();
    expect(updateOrder).not.toHaveBeenCalled();
  });

  test("editing the tracking number clears the courier's 'enter the courier' message too", async () => {
    const user = userEvent.setup();
    form();
    await user.clear(courier());
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await user.type(tracking(), "9");
    expect(screen.queryByText("Enter the courier for this tracking number.")).toBeNull();
  });

  test("cancelling an order asks first, and nothing is saved if the admin says no", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    form("packed", true);
    await pick(user, "Cancelled");
    await user.click(screen.getByRole("button", { name: "Save as Cancelled" }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Cancel this order? Its items go back in stock."));
    expect(confirm.mock.calls[0][0]).toContain("Refund the customer from the Payment section afterwards.");
    expect(updateOrder).not.toHaveBeenCalled();
  });

  test("cancelling a cash order doesn't mention a refund, and saves once confirmed", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    form("placed", false);
    await pick(user, "Cancelled");
    await user.click(screen.getByRole("button", { name: "Save as Cancelled" }));
    expect(confirm.mock.calls[0][0]).not.toContain("Refund");
    expect(updateOrder).toHaveBeenCalledWith("ML-1001", expect.objectContaining({ fulfillment: "cancelled" }));
  });

  test("saving an already cancelled order doesn't ask again", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm");
    form("cancelled");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(updateOrder).toHaveBeenCalled();
  });

  test("the server's error is shown", async () => {
    const user = userEvent.setup();
    vi.mocked(updateOrder).mockResolvedValue({ error: "Only placed orders can be updated." });
    form();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Only placed orders can be updated.");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  test("shows Saving… while saving", async () => {
    const user = userEvent.setup();
    let finish!: (v: { ok: true }) => void;
    vi.mocked(updateOrder).mockReturnValue(new Promise((r) => (finish = r)));
    form();
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    finish({ ok: true });
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });
});
