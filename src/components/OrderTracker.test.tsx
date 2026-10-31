import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { renderWithIntl } from "@/test/render";
import OrderTracker from "./OrderTracker";

afterEach(cleanup);

const placedAt = new Date("2026-06-15T10:30:00+05:30");
const packedAt = new Date("2026-06-16T09:00:00+05:30");
const shippedAt = new Date("2026-06-17T18:15:00+05:30");
const steps = () => screen.getAllByRole("listitem");

describe("OrderTracker", () => {
  test("a new order is at Order placed, with the other steps still to come", () => {
    renderWithIntl(<OrderTracker status="placed" placedAt={placedAt} history={[]} />);
    expect(screen.getByText("We've received your order and will pack it soon")).toBeInTheDocument();
    expect(steps()[0]).toHaveTextContent("Order placed: current step");
    expect(steps()[0]).toHaveTextContent("15 Jun");
    expect(steps()[1]).toHaveTextContent("Packed: coming up");
    expect(steps()[3]).toHaveTextContent("Delivered: coming up");
  });

  test("a shipped order shows the earlier steps done with their dates, and the tracking number", () => {
    renderWithIntl(
      <OrderTracker
        status="shipped"
        placedAt={placedAt}
        history={[{ status: "packed", at: packedAt }, { status: "shipped", at: shippedAt }]}
        courier="Delhivery"
        trackingNumber="DL123"
      />,
    );
    expect(screen.getByText("Your order is on its way")).toBeInTheDocument();
    expect(steps()[0]).toHaveTextContent("Order placed: done");
    expect(steps()[1]).toHaveTextContent("Packed: done");
    expect(steps()[1]).toHaveTextContent("16 Jun");
    expect(steps()[2]).toHaveTextContent("Shipped: current step");
    expect(steps()[2]).toHaveTextContent("Delhivery · Tracking: DL123");
    expect(steps()[3]).toHaveTextContent("Delivered: coming up");
  });

  test("the tracking number isn't shown before the order ships", () => {
    renderWithIntl(<OrderTracker status="packed" placedAt={placedAt} history={[{ status: "packed", at: packedAt }]} trackingNumber="DL123" />);
    expect(screen.queryByText(/DL123/)).toBeNull();
  });

  test("the latest date is used when a step was set more than once", () => {
    const again = new Date("2026-06-18T12:00:00+05:30");
    renderWithIntl(<OrderTracker status="packed" placedAt={placedAt} history={[{ status: "packed", at: packedAt }, { status: "packed", at: again }]} />);
    expect(steps()[1]).toHaveTextContent("18 Jun");
  });

  test("a cancelled order gets a notice instead of the steps", () => {
    const cancelledAt = new Date("2026-06-16T11:00:00+05:30");
    renderWithIntl(<OrderTracker status="cancelled" placedAt={placedAt} history={[{ status: "cancelled", at: cancelledAt }]} />);
    expect(screen.getByText("This order was cancelled")).toBeInTheDocument();
    expect(screen.getByText(/16 Jun/)).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
