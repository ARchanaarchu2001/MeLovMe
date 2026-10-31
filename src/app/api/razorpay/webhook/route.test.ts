// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ markOrderPaid: vi.fn(), setRefundStatus: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/orders", () => ({ markOrderPaid: m.markOrderPaid, setRefundStatus: m.setRefundStatus }));
// The signature check is the real one from @/lib/server/razorpay

import { POST } from "./route";

const SECRET = "test-webhook-secret";
// Razorpay signs the raw body with the webhook secret (HMAC-SHA256, hex)
const sign = (body: string, secret = SECRET) => createHmac("sha256", secret).update(body).digest("hex");

const send = (body: string, signature: string | null = sign(body)) =>
  POST(
    new Request("http://localhost/api/razorpay/webhook/", {
      method: "POST",
      body,
      headers: signature === null ? {} : { "x-razorpay-signature": signature },
    }),
  );
const event = (e: object) => JSON.stringify(e);

const captured = event({
  event: "payment.captured",
  payload: { payment: { entity: { id: "pay_1", order_id: "order_RZP123" } } },
});

beforeEach(() => {
  vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", SECRET);
  m.markOrderPaid.mockResolvedValue(undefined);
  m.setRefundStatus.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("Razorpay webhook: signature", () => {
  test("a request without a signature is rejected with 400", async () => {
    expect((await send(captured, null)).status).toBe(400);
    expect(m.markOrderPaid).not.toHaveBeenCalled();
  });

  test("a signature made with another secret is rejected", async () => {
    const res = await send(captured, sign(captured, "someone-elses-secret"));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Invalid signature");
    expect(m.markOrderPaid).not.toHaveBeenCalled();
  });

  test("a body changed after signing is rejected", async () => {
    const changed = captured.replace("pay_1", "pay_2");
    expect((await send(changed, sign(captured))).status).toBe(400);
    expect(m.markOrderPaid).not.toHaveBeenCalled();
  });

  test("everything is rejected while the webhook secret isn't set", async () => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "");
    // Signed with an empty secret, which must not count as valid
    expect((await send(captured, sign(captured, ""))).status).toBe(400);
    expect(m.markOrderPaid).not.toHaveBeenCalled();
  });

  test("a correctly signed body that isn't JSON is rejected with 400", async () => {
    const res = await send("not json");
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Invalid JSON");
  });
});

describe("Razorpay webhook: payments", () => {
  test("payment.captured marks the order paid and answers 200", async () => {
    const res = await send(captured);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(m.markOrderPaid).toHaveBeenCalledWith("order_RZP123", "pay_1");
  });

  test("order.paid uses the order entity's ID", async () => {
    await send(
      event({
        event: "order.paid",
        payload: { order: { entity: { id: "order_RZP123" } }, payment: { entity: { id: "pay_1", order_id: "order_RZP123" } } },
      }),
    );
    expect(m.markOrderPaid).toHaveBeenCalledWith("order_RZP123", "pay_1");
  });

  test("the same event sent twice answers 200 both times (markOrderPaid itself only acts the first time)", async () => {
    expect((await send(captured)).status).toBe(200);
    expect((await send(captured)).status).toBe(200);
    expect(m.markOrderPaid.mock.calls).toEqual([
      ["order_RZP123", "pay_1"],
      ["order_RZP123", "pay_1"],
    ]);
  });

  test("a payment event without a payment ID changes nothing", async () => {
    await send(event({ event: "payment.captured", payload: { payment: { entity: { order_id: "order_RZP123" } } } }));
    expect(m.markOrderPaid).not.toHaveBeenCalled();
  });

  test("other events are acknowledged and ignored", async () => {
    const res = await send(event({ event: "payment.failed", payload: { payment: { entity: { id: "pay_1", order_id: "order_RZP123" } } } }));
    expect(res.status).toBe(200);
    expect(m.markOrderPaid).not.toHaveBeenCalled();
    expect(m.setRefundStatus).not.toHaveBeenCalled();
  });
});

describe("Razorpay webhook: refunds", () => {
  test("refund.processed records the refund as processed", async () => {
    await send(event({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_1", status: "processed" } } } }));
    expect(m.setRefundStatus).toHaveBeenCalledWith("rfnd_1", "processed");
  });

  test("refund.failed records the refund as failed", async () => {
    await send(event({ event: "refund.failed", payload: { refund: { entity: { id: "rfnd_1", status: "failed" } } } }));
    expect(m.setRefundStatus).toHaveBeenCalledWith("rfnd_1", "failed");
  });

  test("a refund event without a refund ID changes nothing", async () => {
    await send(event({ event: "refund.processed", payload: {} }));
    expect(m.setRefundStatus).not.toHaveBeenCalled();
  });
});
