import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Offer } from "@/lib/product";
import { renderWithIntl } from "@/test/render";
import OfferSticker, { OfferBadge, OfferCountdown, OfferTimer } from "./OfferSticker";

// "Today" is 15 June 2026, midday India time
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-15T12:00:00+05:30"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const endsOn = (day: string): Offer => ({ type: "percent", value: 20, startsAt: "2026-06-01T00:00:00+05:30", endsAt: `${day}T23:59:59+05:30` });

describe("OfferSticker", () => {
  test("a running offer with no end date shows just the discount", () => {
    const { container } = renderWithIntl(<OfferSticker product={{ offer: { type: "percent", value: 20 } }} />);
    expect(screen.getByText("20% off")).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/left|Last day/);
  });

  test("a flat offer shows the rupees off", () => {
    renderWithIntl(<OfferSticker product={{ offer: { type: "flat", value: 200 } }} />);
    expect(screen.getByText("₹200 off")).toBeInTheDocument();
  });

  test("ending in 2 days says 2 days left", () => {
    renderWithIntl(<OfferSticker product={{ offer: endsOn("2026-06-17") }} />);
    expect(screen.getByText("2 days left")).toBeInTheDocument();
  });

  test("ending tomorrow says 1 day left", () => {
    renderWithIntl(<OfferSticker product={{ offer: endsOn("2026-06-16") }} />);
    expect(screen.getByText("1 day left")).toBeInTheDocument();
  });

  test("ending today says Last day", () => {
    renderWithIntl(<OfferSticker product={{ offer: endsOn("2026-06-15") }} />);
    expect(screen.getByText("Last day")).toBeInTheDocument();
  });

  test("an offer that hasn't started yet shows nothing", () => {
    const { container } = renderWithIntl(<OfferSticker product={{ offer: { type: "percent", value: 20, startsAt: "2026-06-20T00:00:00+05:30" } }} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("an offer that has ended shows nothing", () => {
    const { container } = renderWithIntl(<OfferSticker product={{ offer: endsOn("2026-06-14") }} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("no offer, or a 0% offer, shows nothing", () => {
    const { container } = renderWithIntl(
      <>
        <OfferSticker product={{ offer: null }} />
        <OfferSticker product={{ offer: { type: "percent", value: 0 } }} />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("OfferBadge", () => {
  test("shows the discount while the offer runs", () => {
    renderWithIntl(<OfferBadge product={{ offer: endsOn("2026-06-17") }} />);
    expect(screen.getByText("20% off")).toBeInTheDocument();
  });

  test("shows nothing after the offer ends", () => {
    const { container } = renderWithIntl(<OfferBadge product={{ offer: endsOn("2026-06-14") }} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("OfferTimer", () => {
  test("shows the days left when the offer has an end date", () => {
    renderWithIntl(<OfferTimer product={{ offer: endsOn("2026-06-18") }} />);
    expect(screen.getByText("3 days left")).toBeInTheDocument();
  });

  test("shows nothing for an offer without an end date", () => {
    const { container } = renderWithIntl(<OfferTimer product={{ offer: { type: "percent", value: 20 } }} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("OfferCountdown", () => {
  test("ending in 3 days gives the days and the last date", () => {
    renderWithIntl(<OfferCountdown product={{ offer: endsOn("2026-06-18") }} />);
    expect(screen.getByText("Offer ends in 3 days")).toBeInTheDocument();
    expect(screen.getByText("Valid till Jun 18, 2026")).toBeInTheDocument();
  });

  test("ending today and tomorrow say so", () => {
    const { rerender } = renderWithIntl(<OfferCountdown product={{ offer: endsOn("2026-06-15") }} />);
    expect(screen.getByText("Offer ends today")).toBeInTheDocument();
    rerender(<OfferCountdown product={{ offer: endsOn("2026-06-16") }} />);
    expect(screen.getByText("Offer ends tomorrow")).toBeInTheDocument();
  });

  test("without an end date it's a limited-time offer with no date", () => {
    renderWithIntl(<OfferCountdown product={{ offer: { type: "percent", value: 20 } }} />);
    expect(screen.getByText("Limited-time offer")).toBeInTheDocument();
    expect(screen.queryByText(/Valid till/)).toBeNull();
  });
});
