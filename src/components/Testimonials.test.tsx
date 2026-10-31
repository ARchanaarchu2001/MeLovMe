import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Testimonials as Data } from "@/lib/testimonials";
import { mockScreen } from "@/test/render";
import Testimonials from "./Testimonials";

// jsdom has none of these; the cards fade in (Reveal) and the rows measure themselves
beforeEach(() => {
  mockScreen(false);
  const Noop = class {
    observe() {}
    disconnect() {}
  };
  vi.stubGlobal("IntersectionObserver", Noop);
  vi.stubGlobal("ResizeObserver", Noop);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const data = (overrides: Partial<Data> = {}): Data => ({
  enabled: true,
  layout: "grid",
  autoScroll: false,
  items: [
    { id: "1", name: "Priya R.", place: "Chennai", message: "Absorbs in seconds.", photo: "https://img/priya.jpg" },
    { id: "2", name: "Arjun M.", place: "", message: "Beautiful packaging.", photo: null },
  ],
  ...overrides,
});

// The phone marquee comes first in the page, then the grid or slider for larger screens
const regions = () => screen.getAllByRole("region", { name: "Customer reviews" });

describe("Testimonials", () => {
  test("shows the heading and each review with its name and place", () => {
    render(<Testimonials data={data()} eyebrow="Kind words" title="Loved by our community" />);
    expect(screen.getByRole("heading", { name: "Loved by our community" })).toBeInTheDocument();
    const [marquee] = regions();
    const first = within(marquee).getAllByRole("figure")[0];
    expect(first).toHaveTextContent("“Absorbs in seconds.”");
    expect(first).toHaveTextContent("Priya R. · Chennai");
  });

  test("a review with a photo shows it; one without a place shows just the name", () => {
    render(<Testimonials data={data()} eyebrow="" title="Reviews" />);
    expect(screen.getAllByRole("img", { name: "Priya R." }).length).toBeGreaterThan(0);
    const arjun = within(regions()[0]).getAllByRole("figure")[1];
    expect(arjun.querySelector("figcaption")).toHaveTextContent(/^Arjun M\.$/);
  });

  test("the phone marquee lists each review once for screen readers (the repeat is hidden)", () => {
    render(<Testimonials data={data()} eyebrow="" title="Reviews" />);
    expect(within(regions()[0]).getAllByRole("figure")).toHaveLength(2);
    expect(within(regions()[0]).getAllByRole("figure", { hidden: true })).toHaveLength(4);
  });

  test("the phone marquee has previous and next buttons", () => {
    render(<Testimonials data={data()} eyebrow="" title="Reviews" />);
    expect(screen.getByRole("button", { name: "Previous reviews" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next reviews" })).toBeInTheDocument();
  });

  test("the slider layout shows the reviews in a scrolling row", () => {
    render(<Testimonials data={data({ layout: "slider" })} eyebrow="" title="Reviews" />);
    expect(regions()).toHaveLength(2);
    expect(within(regions()[1]).getAllByRole("figure")).toHaveLength(2);
  });

  test("the grid layout shows every review", () => {
    render(<Testimonials data={data()} eyebrow="" title="Reviews" />);
    // Marquee (2) + grid (2)
    expect(screen.getAllByRole("figure")).toHaveLength(4);
    expect(regions()).toHaveLength(1);
  });
});
