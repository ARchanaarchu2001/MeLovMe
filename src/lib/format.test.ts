import { describe, expect, test } from "vitest";
import { formatPrice } from "./format";

describe("prices: formatPrice", () => {
  test("shows rupees with the ₹ sign and a thousands comma", () => {
    expect(formatPrice(1499)).toBe("₹1,499");
  });

  test("groups large amounts the Indian way (lakhs)", () => {
    expect(formatPrice(150000)).toBe("₹1,50,000");
  });

  test("shows small amounts without a comma", () => {
    expect(formatPrice(99)).toBe("₹99");
  });

  test("shows zero as ₹0 (e.g. free shipping)", () => {
    expect(formatPrice(0)).toBe("₹0");
  });

  test("shows whole rupees, rounding any paise", () => {
    expect(formatPrice(1499.5)).toBe("₹1,500");
  });
});
