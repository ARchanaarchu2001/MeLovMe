import { describe, expect, test, vi } from "vitest";
import {
  MAX_QTY,
  customerCancellable,
  fulfillmentLabels,
  fulfillments,
  isPlaced,
  paymentMethods,
  refundState,
  shippingFor,
  validateAddress,
  type Address,
  type Refund,
} from "./order";

// The shop's real settings ship free for now; use a ₹99 fee, free from ₹999, to test the rule
vi.mock("@/data/site", () => ({ site: { shipping: { fee: 99, freeAbove: 999 } } }));

const home: Address = {
  name: "Anjali R",
  phone: "9876543210",
  address: "12, MG Road",
  city: "Chennai",
  state: "Tamil Nadu",
  pincode: "600001",
};
const check = (change: Partial<Address>) => validateAddress({ ...home, ...change });

describe("delivery address: validateAddress", () => {
  test("a complete address has no errors", () => {
    expect(check({})).toEqual({});
  });

  test("every field is required", () => {
    expect(validateAddress({ name: "", phone: "", address: "", city: "", state: "", pincode: "" })).toEqual({
      name: "required",
      phone: "required",
      address: "required",
      city: "required",
      state: "required",
      pincode: "required",
    });
  });

  test("a field with only spaces counts as empty", () => {
    expect(check({ city: "   " })).toEqual({ city: "required" });
  });

  test("a missing field (e.g. from an old saved address) counts as empty", () => {
    const noState = { ...home, state: undefined } as unknown as Address;
    expect(validateAddress(noState)).toEqual({ state: "required" });
  });

  test("takes 10-digit Indian mobile numbers starting with 6 to 9", () => {
    for (const phone of ["6000000000", "7012345678", "8123456789", "9876543210"]) expect(check({ phone })).toEqual({});
  });

  test("refuses phone numbers that aren't 10-digit Indian mobiles", () => {
    for (const phone of ["987654321", "98765432101", "5876543210", "+919876543210", "98765 43210", "98765-43210"]) {
      expect(check({ phone }).phone).toBe("invalidPhone");
    }
  });

  test("takes 6-digit PIN codes", () => {
    expect(check({ pincode: "110001" })).toEqual({});
  });

  test("refuses PIN codes that are the wrong length, start with 0 or have letters", () => {
    for (const pincode of ["60001", "6000011", "060001", "6000a1", "600 001"]) {
      expect(check({ pincode }).pincode).toBe("invalidPincode");
    }
  });

  test("reports every bad field at once", () => {
    expect(check({ name: "", phone: "12345", pincode: "1" })).toEqual({
      name: "required",
      phone: "invalidPhone",
      pincode: "invalidPincode",
    });
  });
});

describe("shipping fee: shippingFor", () => {
  test("orders below the free-shipping amount pay the delivery fee", () => {
    expect(shippingFor(998)).toBe(99);
  });

  test("orders of exactly the free-shipping amount ship free", () => {
    expect(shippingFor(999)).toBe(0);
  });

  test("orders above the free-shipping amount ship free", () => {
    expect(shippingFor(4350)).toBe(0);
  });
});

describe("refunds: refundState (more cases)", () => {
  const refund = (amount: number, status: Refund["status"]): Refund => ({ id: `rfnd_${amount}${status}`, amount, status, createdAt: new Date() });

  test("a refund made again after a failed one counts, and the order shows as refunded", () => {
    const state = refundState({ total: 899, refunds: [refund(899, "failed"), refund(899, "processed")] });
    expect(state).toMatchObject({ refunded: 899, refundable: 0, label: "Refunded" });
  });

  test("while any refund is still on its way the order shows refund initiated", () => {
    const state = refundState({ total: 3000, refunds: [refund(1000, "processed"), refund(500, "pending")] });
    expect(state).toMatchObject({ refunded: 1500, pending: true, refundable: 1500, label: "Refund initiated" });
  });

  test("what's left to refund never goes below ₹0", () => {
    expect(refundState({ total: 899, refunds: [refund(1000, "processed")] }).refundable).toBe(0);
  });

  test("an empty refund list is the same as no refunds", () => {
    expect(refundState({ total: 899, refunds: [] }).label).toBeNull();
  });
});

describe("order status and fulfilment", () => {
  test("only paid and cash on delivery orders count as placed", () => {
    expect([isPlaced("paid"), isPlaced("cod"), isPlaced("awaiting_payment")]).toEqual([true, true, false]);
  });

  test("customers can cancel an order until it ships", () => {
    expect(customerCancellable(undefined)).toBe(true); // older orders without a status are just placed
    expect(customerCancellable("placed")).toBe(true);
    expect(customerCancellable("packed")).toBe(true);
  });

  test("customers can't cancel an order once shipped, delivered or already cancelled", () => {
    expect(customerCancellable("shipped")).toBe(false);
    expect(customerCancellable("delivered")).toBe(false);
    expect(customerCancellable("cancelled")).toBe(false);
  });

  test("every fulfilment status has a label to show", () => {
    for (const f of fulfillments) expect(fulfillmentLabels[f]).toBeTruthy();
  });

  test("customers can pay online or cash on delivery", () => {
    expect(paymentMethods).toEqual(["razorpay", "cod"]);
  });

  test("one order can have up to 10 of a product", () => {
    expect(MAX_QTY).toBe(10);
  });
});
