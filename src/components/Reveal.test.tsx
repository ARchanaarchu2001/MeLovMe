import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Reveal from "./Reveal";

// A stand-in IntersectionObserver that lets the test say when the element scrolls into view
let callback: IntersectionObserverCallback;
const disconnect = vi.fn();
beforeEach(() => {
  disconnect.mockClear();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: IntersectionObserverCallback) {
        callback = cb;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const scrollIntoView = (isIntersecting: boolean) =>
  act(() => callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver));

describe("Reveal", () => {
  test("shows its children, not yet faded in", () => {
    render(<Reveal delay={200}><p>Hello</p></Reveal>);
    const box = screen.getByText("Hello").parentElement!;
    expect(box).toHaveClass("reveal");
    expect(box).not.toHaveClass("is-visible");
    expect(box.style.getPropertyValue("--delay")).toBe("200ms");
  });

  test("fades in once scrolled into view, and stops watching", () => {
    render(<Reveal><p>Hello</p></Reveal>);
    scrollIntoView(true);
    expect(screen.getByText("Hello").parentElement).toHaveClass("is-visible");
    expect(disconnect).toHaveBeenCalled();
  });

  test("stays hidden while still out of view", () => {
    render(<Reveal><p>Hello</p></Reveal>);
    scrollIntoView(false);
    expect(screen.getByText("Hello").parentElement).not.toHaveClass("is-visible");
  });
});
