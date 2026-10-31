import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import PolicyPage from "./PolicyPage";

afterEach(cleanup);

const props = {
  eyebrow: "Policies",
  title: "Returns & Refunds",
  intro: "We want you to love it.",
  updated: new Date("2026-06-15T12:00:00+05:30"),
  updatedLabel: (date: string) => `Last updated ${date}`,
  sections: [
    { id: "returns", title: "Returns", points: ["Return unopened items within 7 days.", "Track it in <orders>My Orders</orders>."], icon: <path d="" /> },
    { id: "refunds", title: "Refunds", points: ["Refunds take 5–7 days."], icon: <path d="" /> },
  ],
  contact: { title: "Need help?", text: "We're here.", email: "Email us", whatsapp: "WhatsApp us", whatsappMessage: "Hi, about a return", orders: "My Orders" },
};

describe("PolicyPage", () => {
  test("shows the title, intro and last-updated date", () => {
    render(<PolicyPage {...props} />);
    expect(screen.getByRole("heading", { level: 1, name: "Returns & Refunds" })).toBeInTheDocument();
    expect(screen.getByText("We want you to love it.")).toBeInTheDocument();
    expect(screen.getByText("Last updated 15 June 2026")).toBeInTheDocument();
  });

  test("has numbered jump links to each section", () => {
    render(<PolicyPage {...props} />);
    const nav = screen.getByRole("navigation", { name: "Returns & Refunds" });
    expect(within(nav).getByRole("link", { name: "1. Returns" })).toHaveAttribute("href", "#returns");
    expect(within(nav).getByRole("link", { name: "2. Refunds" })).toHaveAttribute("href", "#refunds");
  });

  test("each section lists its points, with <orders> turned into a link to My Orders", () => {
    render(<PolicyPage {...props} />);
    expect(screen.getByText("Return unopened items within 7 days.")).toBeInTheDocument();
    const link = screen.getAllByRole("link", { name: "My Orders" })[0];
    expect(link.getAttribute("href")).toMatch(/^\/orders\/?$/);
    expect(link.parentElement).toHaveTextContent("Track it in My Orders.");
  });

  test("the help box links to email and WhatsApp", () => {
    render(<PolicyPage {...props} />);
    expect(screen.getByRole("link", { name: "Email us" })).toHaveAttribute("href", "mailto:hello@melovme.com");
    const whatsapp = screen.getByRole("link", { name: "WhatsApp us" });
    expect(new URL(whatsapp.getAttribute("href")!).searchParams.get("text")).toBe("Hi, about a return");
  });
});
