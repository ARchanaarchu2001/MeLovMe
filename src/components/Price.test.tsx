import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import Price from "./Price";

// "Today" is 15 June 2026, India time
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-15T12:00:00+05:30"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const running = { type: "percent" as const, value: 20, startsAt: "2026-06-01T00:00:00+05:30", endsAt: "2026-06-30T23:59:59+05:30" };

describe("Price", () => {
  test("without an offer only the regular price is shown", () => {
    renderWithIntl(<Price product={{ price: 899, offer: null }} />);
    expect(screen.getByText("₹899")).toBeInTheDocument();
    expect(screen.queryByText(/off/i)).toBeNull();
  });

  test("a running 20% offer shows the offer price, the struck-out price and the badge", () => {
    // ₹899 − 20% = ₹719.20 → ₹719
    renderWithIntl(<Price product={{ price: 899, offer: running }} />);
    expect(screen.getByText("₹719")).toBeInTheDocument();
    expect(screen.getByLabelText("Regular price ₹899")).toHaveTextContent("₹899");
    expect(screen.getByText("20% off")).toBeInTheDocument();
  });

  test("with savings it says how much is saved instead of the badge", () => {
    renderWithIntl(<Price product={{ price: 899, offer: running }} savings />);
    expect(screen.getByText("Save ₹180")).toBeInTheDocument();
    expect(screen.queryByText("20% off")).toBeNull();
  });

  test("showBadge false hides the % badge but keeps the struck-out price", () => {
    renderWithIntl(<Price product={{ price: 899, offer: running }} showBadge={false} />);
    expect(screen.queryByText("20% off")).toBeNull();
    expect(screen.getByLabelText("Regular price ₹899")).toBeInTheDocument();
  });

  test("an offer that has ended is ignored", () => {
    renderWithIntl(<Price product={{ price: 899, offer: { ...running, endsAt: "2026-06-10T23:59:59+05:30" } }} />);
    expect(screen.getByText("₹899")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Regular price/)).toBeNull();
  });

  test("a flat ₹200 offer takes ₹200 off", () => {
    renderWithIntl(<Price product={{ price: 1000, offer: { type: "flat", value: 200 } }} savings />);
    expect(screen.getByText("₹800")).toBeInTheDocument();
    expect(screen.getByText("Save ₹200")).toBeInTheDocument();
  });
});
