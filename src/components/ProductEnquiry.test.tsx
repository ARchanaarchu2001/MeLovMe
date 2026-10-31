import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { renderWithIntl } from "@/test/render";
import ProductEnquiry from "./ProductEnquiry";

afterEach(cleanup);
const product = { slug: "body-lotion", name: "Body Lotion", size: "200 ml" };

describe("ProductEnquiry", () => {
  test("opens WhatsApp to the shop with the product's name, size and link typed in", () => {
    renderWithIntl(<ProductEnquiry product={product} />);
    const link = screen.getByRole("link", { name: "Enquire on WhatsApp" });
    const url = new URL(link.getAttribute("href")!);
    expect(url.origin + url.pathname).toBe("https://wa.me/919946658691");
    expect(url.searchParams.get("text")).toMatch(/^Hi MELOVME! I'd like to enquire about \/ buy Body Lotion \(200 ml\)\.\n.*\/p\/body-lotion\/$/);
    expect(link).toHaveAttribute("target", "_blank");
  });

  test("the full button has the chat note; as the only way to order it says so", () => {
    const { rerender } = renderWithIntl(<ProductEnquiry product={product} />);
    expect(screen.getByText("Questions, or want to order? Chat with us.")).toBeInTheDocument();
    rerender(<ProductEnquiry product={product} primary />);
    expect(screen.getByText("Order or ask about this product on WhatsApp.")).toBeInTheDocument();
  });

  test("the compact icon button is labelled with the product", () => {
    renderWithIntl(<ProductEnquiry product={product} compact />);
    expect(screen.getByRole("link", { name: "Ask about Body Lotion on WhatsApp" })).toBeInTheDocument();
    expect(screen.queryByText(/Chat with us/)).toBeNull();
  });
});
