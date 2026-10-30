import { describe, expect, test } from "vitest";
import { isPlaced, refundState, type Refund } from "./order";

const refund = (amount: number, status: Refund["status"]): Refund => ({ id: `rfnd_${amount}${status}`, amount, status, createdAt: new Date() });

describe("refunds: refundState", () => {
  test("an order without refunds has the full total left to refund", () => {
    expect(refundState({ total: 1499 })).toEqual({ refunded: 0, pending: false, refundable: 1499, label: null });
  });

  test("a refund on its way shows as initiated and counts as refunded", () => {
    expect(refundState({ total: 1499, refunds: [refund(1499, "pending")] })).toMatchObject({
      refunded: 1499,
      refundable: 0,
      label: "Refund initiated",
    });
  });

  test("part refunds add up, leaving the rest to refund", () => {
    const state = refundState({ total: 3000, refunds: [refund(1000, "processed"), refund(500, "processed")] });
    expect(state).toMatchObject({ refunded: 1500, refundable: 1500, label: "Partly refunded" });
  });

  test("the full amount processed is refunded", () => {
    expect(refundState({ total: 899, refunds: [refund(899, "processed")] }).label).toBe("Refunded");
  });

  test("failed refunds don't count, so the amount can be refunded again", () => {
    const state = refundState({ total: 899, refunds: [refund(899, "failed")] });
    expect(state).toMatchObject({ refunded: 0, refundable: 899, label: "Refund failed" });
  });
});

describe("order status: isPlaced", () => {
  test("paid and cash on delivery orders are real orders; unfinished online payments aren't", () => {
    expect(isPlaced("paid")).toBe(true);
    expect(isPlaced("cod")).toBe(true);
    expect(isPlaced("awaiting_payment")).toBe(false);
  });
});
