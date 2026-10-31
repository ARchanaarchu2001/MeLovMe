// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getPaymentSettings, refreshPaymentSettings } from "./payments";

const { settings, revalidateTag } = vi.hoisted(() => ({
  settings: { findOne: vi.fn() },
  revalidateTag: vi.fn(),
}));

vi.mock("server-only", () => ({}));
// No caching in tests: the function runs every time
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag }));
vi.mock("./db", () => ({ getDb: async () => ({ settings }) }));

beforeEach(() => {
  settings.findOne.mockReset();
  revalidateTag.mockReset();
});

describe("getPaymentSettings", () => {
  test("looks up the payments settings document", async () => {
    settings.findOne.mockResolvedValue(null);
    await getPaymentSettings();
    expect(settings.findOne).toHaveBeenCalledWith({ _id: "payments" });
  });

  test("until an admin saves them, only Razorpay is on", async () => {
    settings.findOne.mockResolvedValue(null);
    expect(await getPaymentSettings()).toEqual({ razorpay: true, cod: false });
  });

  test("returns what the admin saved, without the database fields", async () => {
    settings.findOne.mockResolvedValue({ _id: "payments", razorpay: false, cod: true, updatedAt: new Date() });
    expect(await getPaymentSettings()).toEqual({ razorpay: false, cod: true });
  });
});

describe("refreshPaymentSettings", () => {
  test("expires the cached settings straight away", () => {
    refreshPaymentSettings();
    expect(revalidateTag).toHaveBeenCalledWith("payment-settings", { expire: 0 });
  });
});
