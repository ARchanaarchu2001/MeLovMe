import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Refund } from "@/lib/order";
import {
  BackLink,
  FulfillmentBadge,
  Pagination,
  PaymentBadge,
  RefundBadge,
  SearchBox,
  Stat,
  StockBadge,
  formatDate,
  formatDateTime,
  paymentLabel,
  searchRegex,
} from "./ui";

// A plain link, so hrefs are checked as written (the real one drops the trailing slash without the app's config)
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
afterEach(cleanup);

const refund = (amount: number, status: Refund["status"]): Refund => ({ id: `rfnd_${amount}`, amount, status, createdAt: new Date() });

describe("badges", () => {
  test("payment badge says paid, cash on delivery or awaiting payment", () => {
    render(
      <>
        <PaymentBadge status="paid" />
        <PaymentBadge status="cod" />
        <PaymentBadge status="awaiting_payment" />
      </>,
    );
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("Cash on delivery")).toBeInTheDocument();
    expect(screen.getByText("Awaiting payment")).toBeInTheDocument();
  });

  test("an order without refunds shows no refund badge", () => {
    const { container } = render(<RefundBadge order={{ total: 1000 }} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("refund badge follows the refunds: initiated, refunded, partly refunded, failed", () => {
    render(
      <>
        <RefundBadge order={{ total: 1000, refunds: [refund(1000, "pending")] }} />
        <RefundBadge order={{ total: 1000, refunds: [refund(1000, "processed")] }} />
        <RefundBadge order={{ total: 1000, refunds: [refund(400, "processed")] }} />
        <RefundBadge order={{ total: 1000, refunds: [refund(1000, "failed")] }} />
      </>,
    );
    for (const label of ["Refund initiated", "Refunded", "Partly refunded", "Refund failed"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  test("delivery status badge shows the status name", () => {
    render(<FulfillmentBadge status="shipped" />);
    expect(screen.getByText("Shipped")).toBeInTheDocument();
  });

  test("stock badge: not set, out of stock, low stock up to 5, in stock above", () => {
    render(
      <>
        <StockBadge stock={null} />
        <StockBadge stock={0} />
        <StockBadge stock={5} />
        <StockBadge stock={6} />
      </>,
    );
    expect(screen.getByText("Stock not set")).toBeInTheDocument();
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
    expect(screen.getByText("Low stock · 5")).toBeInTheDocument();
    expect(screen.getByText("In stock · 6")).toBeInTheDocument();
  });
});

describe("paymentLabel", () => {
  test("names how an order was paid", () => {
    expect(paymentLabel({ method: "upi", app: "PhonePe" })).toBe("PhonePe · UPI");
    expect(paymentLabel({ method: "upi" })).toBe("UPI");
    expect(paymentLabel({ method: "card", card: { network: "Visa", last4: "4242" } })).toBe("Visa card ••4242");
    expect(paymentLabel({ method: "netbanking", bank: "HDFC" })).toBe("Netbanking · HDFC");
    expect(paymentLabel({ method: "wallet", wallet: "paytm" })).toBe("Wallet · paytm");
    expect(paymentLabel({ method: "cod" })).toBe("Cash on delivery");
  });

  test("an unknown method is shown as Razorpay sent it", () => {
    expect(paymentLabel({ method: "crypto" })).toBe("crypto");
  });
});

describe("dates and search", () => {
  test("dates are shown in India time", () => {
    // 20:00 UTC is 1:30 am the next day in India
    const d = new Date("2026-06-15T20:00:00Z");
    expect(formatDate(d)).toBe("16 Jun 2026");
    expect(formatDateTime(d)).toMatch(/16 Jun 2026.*1:30\sam/i);
  });

  test("search text is matched literally, ignoring case", () => {
    const re = searchRegex("a.b (2)");
    expect(re.test("A.B (2) gift")).toBe(true);
    expect(re.test("axb (2)")).toBe(false);
  });
});

describe("Stat", () => {
  test("is a link to the list when it has one", () => {
    render(<Stat label="Orders today" value="12" note="3 to pack" href="/admin/orders/" />);
    expect(screen.getByRole("link", { name: /Orders today/ })).toHaveAttribute("href", "/admin/orders/");
    expect(screen.getByText("3 to pack")).toBeInTheDocument();
  });

  test("is plain text without a link", () => {
    render(<Stat label="Revenue" value="₹1,000" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("₹1,000")).toBeInTheDocument();
  });
});

describe("Pagination", () => {
  const href = (n: number) => `/admin/orders/?page=${n}`;

  test("is hidden when everything fits on one page", () => {
    const { container } = render(<Pagination page={1} pageSize={20} total={20} href={href} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("says which items are shown and links the neighbouring pages", () => {
    render(<Pagination page={2} pageSize={10} total={34} href={href} />);
    expect(screen.getByText("Showing 11–20 of 34")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Previous" })).toHaveAttribute("href", href(1));
    expect(screen.getByRole("link", { name: "Next →" })).toHaveAttribute("href", href(3));
    expect(screen.getByText("2")).toHaveAttribute("aria-current", "page");
  });

  test("first page has no Previous link, last page no Next link", () => {
    const { unmount } = render(<Pagination page={1} pageSize={10} total={34} href={href} />);
    expect(screen.queryByRole("link", { name: "← Previous" })).toBeNull();
    unmount();
    render(<Pagination page={4} pageSize={10} total={34} href={href} />);
    expect(screen.queryByRole("link", { name: "Next →" })).toBeNull();
    expect(screen.getByText("Showing 31–34 of 34")).toBeInTheDocument();
  });

  test("far-away pages are replaced by gaps: 1 … 5 6 7 … 12", () => {
    render(<Pagination page={6} pageSize={10} total={120} href={href} />);
    const pages = screen.getAllByRole("link").map((a) => a.textContent).filter((t) => /^\d+$/.test(t ?? ""));
    expect(pages).toEqual(["1", "5", "7", "12"]);
    expect(screen.getAllByText("…")).toHaveLength(2);
  });
});

describe("SearchBox", () => {
  test("keeps the search and filters in the form, with a Clear link back to the filtered list", () => {
    render(<SearchBox action="/admin/orders/" q="priya" placeholder="Search orders" hidden={{ status: "paid" }} />);
    expect(screen.getByRole("textbox", { name: "Search orders" })).toHaveValue("priya");
    expect(document.querySelector('input[type="hidden"][name="status"]')).toHaveValue("paid");
    expect(screen.getByRole("link", { name: "Clear" })).toHaveAttribute("href", "/admin/orders/?status=paid");
  });

  test("no Clear link without a search", () => {
    render(<SearchBox action="/admin/orders/" q="" placeholder="Search orders" />);
    expect(screen.queryByRole("link", { name: "Clear" })).toBeNull();
  });
});

test("back link points to the list", () => {
  render(<BackLink href="/admin/products/">All products</BackLink>);
  expect(screen.getByRole("link", { name: "← All products" })).toHaveAttribute("href", "/admin/products/");
});
