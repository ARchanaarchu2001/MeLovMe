// @vitest-environment node
import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ requireUser: vi.fn(), getDb: vi.fn(), adjustStock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn(async () => (key: string) => key) }));
vi.mock("@/lib/server/session", () => ({ requireUser: m.requireUser }));
vi.mock("@/lib/server/db", () => ({ getDb: m.getDb }));
vi.mock("@/lib/server/products", () => ({ adjustStock: m.adjustStock }));

import { cancelOrder } from "./orders";

const NOW = new Date("2026-06-15T12:00:00+05:30");
const user = { _id: new ObjectId(), name: "Anjali" };
const items = [{ slug: "rose-mist", qty: 2 }];
let orders: { findOneAndUpdate: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  orders = { findOneAndUpdate: vi.fn(async () => null) };
  m.requireUser.mockResolvedValue(user);
  m.getDb.mockResolvedValue({ orders });
  m.adjustStock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("cancelOrder", () => {
  test("a guest is sent to log in, back to their orders", async () => {
    m.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(cancelOrder("ML-ABC")).rejects.toThrow("NEXT_REDIRECT");
    expect(m.requireUser).toHaveBeenCalledWith("/orders/");
    expect(orders.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("only the customer's own placed order, not yet shipped, can be cancelled", async () => {
    await cancelOrder("ML-ABC");
    const [filter] = orders.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({
      _id: "ML-ABC",
      userId: user._id,
      // paid online or cash on delivery; never one still awaiting payment
      status: { $in: ["paid", "cod"] },
      // Order placed or Packed (older orders have no delivery status yet)
      $or: [{ fulfillment: { $in: ["placed", "packed"] } }, { fulfillment: { $exists: false } }],
    });
  });

  test("marks the order cancelled by the customer and records when", async () => {
    await cancelOrder("ML-ABC");
    const [, update, options] = orders.findOneAndUpdate.mock.calls[0];
    expect(update).toEqual({
      $set: { fulfillment: "cancelled", cancelledBy: "customer", updatedAt: NOW },
      $push: { statusHistory: { status: "cancelled", at: NOW } },
    });
    expect(options).toEqual({ returnDocument: "before" });
  });

  test("an order that has shipped, isn't theirs or doesn't exist can't be cancelled", async () => {
    // The database finds no order matching the rules above
    expect(await cancelOrder("ML-ABC")).toEqual({ error: "cantCancel" });
    expect(m.adjustStock).not.toHaveBeenCalled();
  });

  test("a cancelled order's items go back in stock", async () => {
    orders.findOneAndUpdate.mockResolvedValue({ _id: "ML-ABC", items, stockTaken: true });
    expect(await cancelOrder("ML-ABC")).toEqual({ ok: true });
    expect(m.adjustStock).toHaveBeenCalledWith(items, 1);
  });

  test("an order whose items never left stock doesn't add stock back", async () => {
    orders.findOneAndUpdate.mockResolvedValue({ _id: "ML-ABC", items });
    expect(await cancelOrder("ML-ABC")).toEqual({ ok: true });
    expect(m.adjustStock).not.toHaveBeenCalled();
  });

  test("the order stays cancelled even if restocking fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    orders.findOneAndUpdate.mockResolvedValue({ _id: "ML-ABC", items, stockTaken: true });
    m.adjustStock.mockRejectedValue(new Error("db down"));
    expect(await cancelOrder("ML-ABC")).toEqual({ ok: true });
  });
});
