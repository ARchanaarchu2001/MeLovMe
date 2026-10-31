import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type { Announcement } from "@/lib/announcement";
import AnnouncementBar from "./AnnouncementBar";

afterEach(cleanup);

const bar = (overrides: Partial<Announcement> = {}): Announcement => ({
  enabled: true,
  messages: [{ text: "Free shipping" }, { text: "New collection", link: "/products/" }, { text: "Instagram", link: "https://instagram.com/x" }],
  background: "#2e1a11",
  textColor: "#c9a36a",
  speed: "normal",
  ...overrides,
});

describe("AnnouncementBar", () => {
  test("shows the messages in the shop's colours", () => {
    render(<AnnouncementBar announcement={bar()} />);
    const region = screen.getByRole("region", { name: "Announcements" });
    expect(region).toHaveStyle({ backgroundColor: "#2e1a11", color: "#c9a36a" });
    expect(within(region).getAllByText("Free shipping").length).toBeGreaterThan(0);
  });

  test("a message with a shop page link goes there; a full link opens in a new tab", () => {
    render(<AnnouncementBar announcement={bar()} />);
    const [shop] = screen.getAllByRole("link", { name: /New collection/ });
    // (next/link drops the trailing slash outside the real app)
    expect(shop.getAttribute("href")).toMatch(/^\/products\/?$/);
    const [insta] = screen.getAllByRole("link", { name: /Instagram/ });
    expect(insta).toHaveAttribute("href", "https://instagram.com/x");
    expect(insta).toHaveAttribute("target", "_blank");
  });

  test("only the first copy of each link can be reached with Tab", () => {
    render(<AnnouncementBar announcement={bar()} />);
    const links = screen.getAllByRole("link", { hidden: true });
    expect(links.filter((l) => l.getAttribute("tabindex") !== "-1")).toHaveLength(2);
  });

  test("short lists repeat so the strip fills the screen, and scroll at 6 s a message", () => {
    // 3 messages repeated 3 times = 9 per half; 9 × 6 s = 54 s
    const { container } = render(<AnnouncementBar announcement={bar()} />);
    expect((container.querySelector(".announcement-track") as HTMLElement).style.animationDuration).toBe("54s");
  });

  test("nothing is shown when switched off", () => {
    const { container } = render(<AnnouncementBar announcement={bar({ enabled: false })} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("nothing is shown when every message is blank", () => {
    const { container } = render(<AnnouncementBar announcement={bar({ messages: [{ text: "  " }] })} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("the admin preview shows even when switched off, without links", () => {
    render(<AnnouncementBar announcement={bar({ enabled: false })} preview />);
    expect(screen.getByRole("region", { name: "Announcements" })).toBeInTheDocument();
    expect(screen.queryAllByRole("link", { hidden: true })).toHaveLength(0);
  });
});
