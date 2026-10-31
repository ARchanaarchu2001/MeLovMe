// @vitest-environment node
import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { OrderDoc } from "./db";
import { markOrderPaid, netOfRefunds, notifyShop, setRefundStatus, syncPendingRefunds } from "./orders";

const { orders, site, afterQueue, adjustStock, fetchPaymentDetails, fetchRefundStatus } = vi.hoisted(() => ({
  orders: { findOneAndUpdate: vi.fn(), updateOne: vi.fn(async () => ({})) },
  site: { orderEndpoint: "" },
  // Work handed to next/server's after(), run by the test when it wants
  afterQueue: [] as (() => Promise<void>)[],
  adjustStock: vi.fn(async () => {}),
  fetchPaymentDetails: vi.fn(),
  fetchRefundStatus: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => void afterQueue.push(fn) }));
vi.mock("@/data/site", () => ({ site }));
vi.mock("./db", () => ({ getDb: async () => ({ orders }) }));
vi.mock("./products", () => ({ adjustStock }));
vi.mock("./razorpay", () => ({ fetchPaymentDetails, fetchRefundStatus }));

const NOW = Date.parse("2026-06-15T12:00:00+05:30");
const fetchMock = vi.fn(async () => ({ ok: true }));
const runAfter = async () => {
  for (const fn of afterQueue.splice(0)) await fn();
};

const order = (change: Partial<OrderDoc> = {}): OrderDoc => ({
  _id: "ML-ABC123",
  userId: new ObjectId("665f1c2e9b1d8a3f4c2e7a10"),
  address: { name: "Anjali" } as OrderDoc["address"],
  items: [{ slug: "signature-body-lotion", name: "Signature Body Lotion", size: "200 ml", qty: 2, price: 1550, total: 3000, comboSaving: 100 }],
  subtotal: 3000,
  shipping: 0,
  total: 3000,
  status: "paid",
  paymentMethod: "razorpay",
  razorpayOrderId: "order_1",
  paymentId: "pay_1",
  createdAt: new Date(NOW),
  ...change,
});

let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  afterQueue.length = 0;
  site.orderEndpoint = "";
  vi.stubGlobal("fetch", fetchMock);
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  errorLog.mockRestore();
});

describe("markOrderPaid", () => {
  test("marks the order waiting for this Razorpay payment as paid and placed", async () => {
    orders.findOneAndUpdate.mockResolvedValue(order());
    await markOrderPaid("order_1", "pay_1");
    expect(orders.findOneAndUpdate).toHaveBeenCalledWith(
      { razorpayOrderId: "order_1", status: "awaiting_payment" },
      { $set: { status: "paid", paymentId: "pay_1", paidAt: new Date(NOW), fulfillment: "placed", stockTaken: true } },
      { returnDocument: "after" },
    );
  });

  test("takes the ordered pieces out of stock", async () => {
    orders.findOneAndUpdate.mockResolvedValue(order());
    await markOrderPaid("order_1", "pay_1");
    expect(adjustStock).toHaveBeenCalledWith(order().items, -1);
  });

  test("an order that was already marked paid (checkout and webhook both reporting) changes nothing", async () => {
    // The filter only matches "awaiting_payment", so a second call finds nothing
    orders.findOneAndUpdate.mockResolvedValue(null);
    await markOrderPaid("order_1", "pay_1");
    expect(adjustStock).not.toHaveBeenCalled();
    expect(afterQueue).toHaveLength(0);
  });

  test("a stock update failure is logged; the order still counts as paid", async () => {
    orders.findOneAndUpdate.mockResolvedValue(order());
    adjustStock.mockRejectedValueOnce(new Error("db down"));
    await expect(markOrderPaid("order_1", "pay_1")).resolves.toBeUndefined();
    expect(errorLog).toHaveBeenCalledWith("Updating stock failed", "ML-ABC123", expect.any(Error));
  });

  test("after responding, saves how the customer paid", async () => {
    orders.findOneAndUpdate.mockResolvedValue(order());
    fetchPaymentDetails.mockResolvedValue({ method: "upi", app: "PhonePe" });
    await markOrderPaid("order_1", "pay_1");
    expect(fetchPaymentDetails).not.toHaveBeenCalled(); // not before the response
    await runAfter();
    expect(fetchPaymentDetails).toHaveBeenCalledWith("pay_1");
    expect(orders.updateOne).toHaveBeenCalledWith({ _id: "ML-ABC123" }, { $set: { payment: { method: "upi", app: "PhonePe" } } });
  });

  test("the shop's notification includes how the customer paid", async () => {
    site.orderEndpoint = "https://forms.example.com/orders";
    orders.findOneAndUpdate.mockResolvedValue(order());
    fetchPaymentDetails.mockResolvedValue({ method: "card" });
    await markOrderPaid("order_1", "pay_1");
    await runAfter();
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.order.payment).toEqual({ method: "card" });
  });

  test("if the payment lookup fails, it's logged and the shop is still notified", async () => {
    site.orderEndpoint = "https://forms.example.com/orders";
    orders.findOneAndUpdate.mockResolvedValue(order());
    fetchPaymentDetails.mockRejectedValue(new Error("Razorpay down"));
    await markOrderPaid("order_1", "pay_1");
    await runAfter();
    expect(orders.updateOne).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith("Saving payment details failed", expect.any(Error));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("notifyShop", () => {
  test("does nothing when no notification address is set", async () => {
    await notifyShop(order());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("posts the order as JSON with a subject naming the order and customer", async () => {
    site.orderEndpoint = "https://forms.example.com/orders";
    await notifyShop(order());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://forms.example.com/orders");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json", Accept: "application/json" });
    const body = JSON.parse(init.body as string);
    expect(body.subject).toBe("New order ML-ABC123 — Anjali");
    expect(body.order._id).toBe("ML-ABC123");
  });

  test("cash on delivery orders say so in the subject", async () => {
    site.orderEndpoint = "https://forms.example.com/orders";
    await notifyShop(order({ status: "cod" }));
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.subject).toBe("New order ML-ABC123 (cash on delivery) — Anjali");
  });

  test("a failed notification is logged, not thrown", async () => {
    site.orderEndpoint = "https://forms.example.com/orders";
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(notifyShop(order())).resolves.toBeUndefined();
    expect(errorLog).toHaveBeenCalledWith("Order notification failed", expect.any(Error));
  });
});

describe("setRefundStatus", () => {
  test("updates that refund's status and time inside its order", async () => {
    await setRefundStatus("rfnd_1", "processed");
    expect(orders.updateOne).toHaveBeenCalledWith(
      { "refunds.id": "rfnd_1" },
      { $set: { "refunds.$.status": "processed", "refunds.$.updatedAt": new Date(NOW) } },
    );
  });
});

describe("syncPendingRefunds", () => {
  const refund = (id: string, status: "pending" | "processed" | "failed", amount = 500) => ({ id, amount, status, createdAt: new Date(NOW) });

  test("only asks Razorpay about refunds that are still pending", async () => {
    fetchRefundStatus.mockResolvedValue("pending");
    await syncPendingRefunds([
      order({ refunds: [refund("r1", "pending"), refund("r2", "processed"), refund("r3", "failed")] }),
      order({ _id: "ML-NOREFUND" }),
    ]);
    expect(fetchRefundStatus.mock.calls).toEqual([["r1"]]);
  });

  test("saves a status that changed and reports it", async () => {
    fetchRefundStatus.mockResolvedValue("processed");
    const result = await syncPendingRefunds([order({ refunds: [refund("r1", "pending", 750)] })]);
    expect(result).toEqual([{ orderId: "ML-ABC123", refundId: "r1", amount: 750, status: "processed" }]);
    expect(orders.updateOne).toHaveBeenCalledWith({ "refunds.id": "r1" }, expect.anything());
  });

  test("a refund that is still pending isn't saved again", async () => {
    fetchRefundStatus.mockResolvedValue("pending");
    const result = await syncPendingRefunds([order({ refunds: [refund("r1", "pending")] })]);
    expect(result[0].status).toBe("pending");
    expect(orders.updateOne).not.toHaveBeenCalled();
  });

  test("when Razorpay can't be reached the status is null and the others are still checked", async () => {
    fetchRefundStatus.mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce("failed");
    const result = await syncPendingRefunds([order({ refunds: [refund("r1", "pending"), refund("r2", "pending")] })]);
    expect(result.map((r) => r.status)).toEqual([null, "failed"]);
    expect(errorLog).toHaveBeenCalledWith("Checking refund failed", "r1", expect.any(Error));
  });

  test("no orders, nothing to check", async () => {
    expect(await syncPendingRefunds([])).toEqual([]);
  });
});

// Works out a MongoDB aggregation expression for one order, for the operators netOfRefunds uses
type Vars = Record<string, unknown>;
function evaluate(expr: unknown, doc: Record<string, unknown>, vars: Vars = {}): unknown {
  if (typeof expr === "string" && expr.startsWith("$$")) {
    const [name, ...path] = expr.slice(2).split(".");
    return path.reduce((v: any, k) => v?.[k], vars[name]); // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  if (typeof expr === "string" && expr.startsWith("$")) return doc[expr.slice(1)];
  if (Array.isArray(expr) || !expr || typeof expr !== "object") return expr;
  const [[op, a]] = Object.entries(expr) as [string, any][]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const ev = (e: unknown, v = vars) => evaluate(e, doc, v);
  switch (op) {
    case "$subtract":
      return (ev(a[0]) as number) - (ev(a[1]) as number);
    case "$sum":
      return (ev(a) as number[]).reduce((s, n) => s + n, 0);
    case "$ifNull":
      return ev(a[0]) ?? ev(a[1]);
    case "$ne":
      return ev(a[0]) !== ev(a[1]);
    case "$filter":
      return (ev(a.input) as unknown[]).filter((x) => ev(a.cond, { ...vars, this: x }));
    case "$map":
      return (ev(a.input) as unknown[]).map((x) => ev(a.in, { ...vars, this: x }));
  }
  throw new Error(`operator not handled in test: ${op}`);
}

describe("netOfRefunds", () => {
  test("an order without refunds counts in full", () => {
    expect(evaluate(netOfRefunds, { total: 3000 })).toBe(3000);
  });

  test("refunds made or on their way are taken off; failed ones aren't", () => {
    // ₹3,000 − ₹500 processed − ₹250 pending = ₹2,250 (the ₹1,000 failed refund doesn't count)
    const refunds = [
      { amount: 500, status: "processed" },
      { amount: 250, status: "pending" },
      { amount: 1000, status: "failed" },
    ];
    expect(evaluate(netOfRefunds, { total: 3000, refunds })).toBe(2250);
  });
});
