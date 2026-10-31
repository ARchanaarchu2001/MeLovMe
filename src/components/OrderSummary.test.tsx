import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { renderWithIntl } from "@/test/render";
import OrderSummary from "./OrderSummary";

afterEach(cleanup);

// Each value (<dd>) follows its label (<dt>)
const valueOf = (label: string) => screen.getByText(label).nextElementSibling;

describe("OrderSummary", () => {
  test("shows subtotal, shipping and total in rupees", () => {
    renderWithIntl(<OrderSummary subtotal={2500} shipping={99} total={2599} />);
    expect(valueOf("Subtotal")).toHaveTextContent("₹2,500");
    expect(valueOf("Shipping")).toHaveTextContent("₹99");
    expect(valueOf("Total")).toHaveTextContent("₹2,599");
  });

  test("no shipping charge says Free", () => {
    renderWithIntl(<OrderSummary subtotal={2500} shipping={0} total={2500} />);
    expect(valueOf("Shipping")).toHaveTextContent("Free");
  });
});
