import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { renderWithIntl } from "@/test/render";
import Footer from "./Footer";

afterEach(cleanup);

const categories = [
  { id: "body", name: "Body Care", slug: "body-care", parentId: null },
  { id: "gifts", name: "Gift Sets & Boxes", slug: "gift-sets", parentId: null },
];

describe("Footer", () => {
  test("links each main category to the products page filtered by it", () => {
    renderWithIntl(<Footer categories={categories} />);
    expect(screen.getByRole("link", { name: "Body Care" }).getAttribute("href")).toMatch(/category=body-care$/);
    expect(screen.getByRole("link", { name: "Gift Sets & Boxes" }).getAttribute("href")).toMatch(/category=gift-sets$/);
  });

  test("has the site's pages and the policy pages", () => {
    renderWithIntl(<Footer categories={[]} />);
    for (const name of ["Home", "Products", "Our Story", "Contact", "Privacy Policy", "Returns, Refunds & Cancellation"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
  });

  test("has email, WhatsApp and social links", () => {
    renderWithIntl(<Footer categories={[]} />);
    expect(screen.getByRole("link", { name: "hello@melovme.com" })).toHaveAttribute("href", "mailto:hello@melovme.com");
    expect(screen.getByRole("link", { name: "+91 99466 58691" }).getAttribute("href")).toMatch(/^https:\/\/wa\.me\/919946658691\?text=/);
    expect(screen.getByRole("link", { name: "Instagram" })).toHaveAttribute("target", "_blank");
  });

  test("the copyright has this year", () => {
    renderWithIntl(<Footer categories={[]} />);
    expect(screen.getByText(`© ${new Date().getFullYear()} MELOVME. All rights reserved.`)).toBeInTheDocument();
  });
});
