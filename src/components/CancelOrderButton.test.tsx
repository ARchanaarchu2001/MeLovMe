import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { cancelOrder } from "@/app/actions/orders";
import { mockDialog, renderWithIntl } from "@/test/render";
import CancelOrderButton from "./CancelOrderButton";

const nav = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav, usePathname: () => "/orders/MLV-1/" }));
vi.mock("@/app/actions/orders", () => ({ cancelOrder: vi.fn() }));

beforeAll(mockDialog);
beforeEach(() => {
  vi.mocked(cancelOrder).mockReset();
  nav.refresh.mockReset();
});
afterEach(cleanup);

describe("CancelOrderButton", () => {
  test("asks for confirmation before cancelling", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CancelOrderButton orderId="MLV-1" paidOnline={false} />);
    await user.click(screen.getByRole("button", { name: "Cancel order" }));
    expect(screen.getByRole("dialog", { name: "Cancel this order?" })).toBeInTheDocument();
    expect(screen.getByText(/you won't need to pay anything/)).toBeInTheDocument();
    expect(cancelOrder).not.toHaveBeenCalled();
  });

  test("for an order paid online it promises a refund", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CancelOrderButton orderId="MLV-1" paidOnline />);
    await user.click(screen.getByRole("button", { name: "Cancel order" }));
    expect(screen.getByText(/we'll refund your payment/)).toBeInTheDocument();
  });

  test("confirming cancels that order and refreshes the page", async () => {
    vi.mocked(cancelOrder).mockResolvedValue({ ok: true } as never);
    const user = userEvent.setup();
    renderWithIntl(<CancelOrderButton orderId="MLV-1" paidOnline={false} />);
    await user.click(screen.getByRole("button", { name: "Cancel order" }));
    await user.click(screen.getByRole("button", { name: "Yes, cancel order" }));
    expect(cancelOrder).toHaveBeenCalledWith("MLV-1");
    expect(nav.refresh).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("Keep my order closes the dialog without cancelling", async () => {
    const user = userEvent.setup();
    renderWithIntl(<CancelOrderButton orderId="MLV-1" paidOnline={false} />);
    await user.click(screen.getByRole("button", { name: "Cancel order" }));
    await user.click(screen.getByRole("button", { name: "Keep my order" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(cancelOrder).not.toHaveBeenCalled();
  });

  test("an error from the shop is shown and the page isn't refreshed", async () => {
    vi.mocked(cancelOrder).mockResolvedValue({ error: "This order has already shipped." } as never);
    const user = userEvent.setup();
    renderWithIntl(<CancelOrderButton orderId="MLV-1" paidOnline={false} />);
    await user.click(screen.getByRole("button", { name: "Cancel order" }));
    await user.click(screen.getByRole("button", { name: "Yes, cancel order" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This order has already shipped.");
    expect(nav.refresh).not.toHaveBeenCalled();
  });
});
