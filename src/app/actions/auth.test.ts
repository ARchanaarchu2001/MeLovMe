// @vitest-environment node
import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  firebase: { enabled: false },
  getDb: vi.fn(),
  verifyPhoneToken: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  requireUser: vi.fn(),
  // Like Next's redirect(): it throws, so nothing after it runs
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` });
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: m.redirect, notFound: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn(async () => (key: string) => key) }));
vi.mock("@/lib/firebase-config", () => ({
  get firebaseEnabled() {
    return m.firebase.enabled;
  },
}));
vi.mock("@/lib/server/db", () => ({ getDb: m.getDb }));
vi.mock("@/lib/server/firebase", () => ({ verifyPhoneToken: m.verifyPhoneToken }));
// afterLoginPath is the real one
vi.mock("@/lib/server/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/session")>()),
  createSession: m.createSession,
  deleteSession: m.deleteSession,
  requireUser: m.requireUser,
}));

import { devSendOtp, login, logout, updateProfile } from "./auth";

const NOW = new Date("2026-06-15T12:00:00+05:30");
const PHONE = "9876543210";
const hash = (code: string) => createHash("sha256").update(`${PHONE}:${code}`).digest("hex");

let users: { findOne: ReturnType<typeof vi.fn>; insertOne: ReturnType<typeof vi.fn>; updateOne: ReturnType<typeof vi.fn> };
let otps: { findOne: ReturnType<typeof vi.fn>; updateOne: ReturnType<typeof vi.fn>; deleteOne: ReturnType<typeof vi.fn> };
const customer = { _id: new ObjectId(), phone: PHONE, name: "Anjali", addresses: [], superAdmin: false };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  m.firebase.enabled = false;
  users = { findOne: vi.fn(async () => customer), insertOne: vi.fn(async () => ({})), updateOne: vi.fn(async () => ({})) };
  otps = { findOne: vi.fn(async () => null), updateOne: vi.fn(async () => ({})), deleteOne: vi.fn(async () => ({})) };
  m.getDb.mockResolvedValue({ users, otps });
  m.createSession.mockResolvedValue(undefined);
  m.deleteSession.mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

// ---------- Development OTP ----------

describe("devSendOtp", () => {
  test("isn't available once Firebase is set up", async () => {
    m.firebase.enabled = true;
    expect(await devSendOtp(PHONE)).toEqual({ error: "notConfigured" });
    expect(otps.updateOne).not.toHaveBeenCalled();
  });

  test("isn't available in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await devSendOtp(PHONE)).toEqual({ error: "notConfigured" });
  });

  test("only takes 10-digit Indian mobile numbers", async () => {
    for (const phone of ["12345", "1234567890", "98765432101"]) expect(await devSendOtp(phone)).toEqual({ error: "invalidPhone" });
  });

  test("a new code can't be asked for within 30 seconds", async () => {
    otps.findOne.mockResolvedValue({ phone: PHONE, sentAt: new Date(NOW.getTime() - 29_000) });
    expect(await devSendOtp(PHONE)).toEqual({ error: "resendWait" });
    expect(otps.updateOne).not.toHaveBeenCalled();
  });

  test("stores only a hash of the code, valid for 10 minutes, with no wrong attempts", async () => {
    otps.findOne.mockResolvedValue({ phone: PHONE, sentAt: new Date(NOW.getTime() - 31_000) });
    expect(await devSendOtp(PHONE)).toEqual({ ok: true });
    // The code is printed in the terminal
    const code = String(vi.mocked(console.log).mock.calls[0][0]).match(/: (\d{6})/)![1];
    expect(otps.updateOne).toHaveBeenCalledWith(
      { phone: PHONE },
      { $set: { codeHash: hash(code), attempts: 0, sentAt: NOW, expiresAt: new Date(NOW.getTime() + 10 * 60_000) } },
      { upsert: true },
    );
  });
});

// ---------- Login ----------

describe("login with the development OTP", () => {
  const pending = (attempts = 0) => ({ phone: PHONE, codeHash: hash("123456"), attempts });

  test("a code that isn't 6 digits is refused", async () => {
    expect(await login({ phone: PHONE, code: "12345" })).toEqual({ error: "enterOtp" });
  });

  test("an expired or never-sent code is refused", async () => {
    expect(await login({ phone: PHONE, code: "123456" })).toEqual({ error: "otpExpired" });
    expect(otps.findOne).toHaveBeenCalledWith({ phone: PHONE, expiresAt: { $gt: NOW } });
  });

  test("after 5 wrong tries even the right code is refused", async () => {
    otps.findOne.mockResolvedValue(pending(5));
    expect(await login({ phone: PHONE, code: "123456" })).toEqual({ error: "tooManyWrong" });
    expect(m.createSession).not.toHaveBeenCalled();
  });

  test("a wrong code is refused and counted", async () => {
    otps.findOne.mockResolvedValue(pending(0));
    expect(await login({ phone: PHONE, code: "654321" })).toEqual({ error: "incorrectOtp" });
    expect(otps.updateOne).toHaveBeenCalledWith({ phone: PHONE }, { $inc: { attempts: 1 } });
    expect(m.createSession).not.toHaveBeenCalled();
  });

  test("the right code logs an existing customer in and uses up the code", async () => {
    otps.findOne.mockResolvedValue(pending(2));
    expect(await login({ phone: PHONE, code: "123456", next: "/checkout/" })).toEqual({ redirectTo: "/checkout/" });
    expect(m.createSession).toHaveBeenCalledWith(customer._id);
    expect(otps.deleteOne).toHaveBeenCalledWith({ phone: PHONE });
  });

  test("a first-time customer is asked for their name, and the code stays valid", async () => {
    otps.findOne.mockResolvedValue(pending());
    users.findOne.mockResolvedValue(null);
    expect(await login({ phone: PHONE, code: "123456" })).toEqual({ needsName: true });
    expect(m.createSession).not.toHaveBeenCalled();
    expect(otps.deleteOne).not.toHaveBeenCalled();
  });

  test("a first-time customer's name must be 2–80 characters", async () => {
    otps.findOne.mockResolvedValue(pending());
    users.findOne.mockResolvedValue(null);
    expect(await login({ phone: PHONE, code: "123456", name: "A" })).toEqual({ error: "enterName" });
    expect(await login({ phone: PHONE, code: "123456", name: "A".repeat(81) })).toEqual({ error: "enterName" });
    expect(users.insertOne).not.toHaveBeenCalled();
  });

  test("a first-time customer with a name gets an account that is never an admin", async () => {
    otps.findOne.mockResolvedValue(pending());
    users.findOne.mockResolvedValue(null);
    await login({ phone: PHONE, code: "123456", name: " Anjali " });
    const created = users.insertOne.mock.calls[0][0];
    expect(created).toMatchObject({ phone: PHONE, name: "Anjali", addresses: [], superAdmin: false });
    expect(m.createSession).toHaveBeenCalledWith(created._id);
  });
});

describe("login: where to go afterwards", () => {
  beforeEach(() => {
    otps.findOne.mockResolvedValue({ phone: PHONE, codeHash: hash("123456"), attempts: 0 });
  });
  const goTo = async (next?: string) => ((await login({ phone: PHONE, code: "123456", next })) as { redirectTo: string }).redirectTo;

  test("without a page to return to, the customer goes to their profile", async () => {
    expect(await goTo()).toBe("/profile/");
  });

  test("links to other sites are ignored", async () => {
    expect(await goTo("//evil.example")).toBe("/profile/");
    expect(await goTo("https://evil.example")).toBe("/profile/");
  });

  test("an admin lands on the admin dashboard, unless checking out", async () => {
    users.findOne.mockResolvedValue({ ...customer, superAdmin: true });
    expect(await goTo("/orders/")).toBe("/admin/");
    expect(await goTo("/checkout/")).toBe("/checkout/");
  });

  test("links that browsers would still send to another site are ignored", async () => {
    expect(await goTo("/\\evil.example")).toBe("/profile/"); // browsers read "\" as "/"
    expect(await goTo("/\t/evil.example")).toBe("/profile/"); // browsers drop tabs and line breaks
    expect(await goTo("/\n/evil.example")).toBe("/profile/");
  });

  test("pages on this site are kept, with their search and section", async () => {
    expect(await goTo("/products/rose-mist/?ref=home#reviews")).toBe("/products/rose-mist/?ref=home#reviews");
  });
});

describe("login with Firebase", () => {
  beforeEach(() => {
    m.firebase.enabled = true;
  });

  test("a token Firebase doesn't accept is refused", async () => {
    m.verifyPhoneToken.mockResolvedValue(null);
    expect(await login({ idToken: "bad" })).toEqual({ error: "verifyFailed" });
    expect(m.createSession).not.toHaveBeenCalled();
  });

  test("the phone number comes from the token, not from the request", async () => {
    m.verifyPhoneToken.mockResolvedValue(PHONE);
    await login({ idToken: "good", phone: "9000000000", code: "000000" });
    expect(m.verifyPhoneToken).toHaveBeenCalledWith("good");
    expect(users.findOne).toHaveBeenCalledWith({ phone: PHONE });
    expect(m.createSession).toHaveBeenCalledWith(customer._id);
  });

  test("the development OTP can't be used instead", async () => {
    m.verifyPhoneToken.mockResolvedValue(null);
    otps.findOne.mockResolvedValue({ phone: PHONE, codeHash: hash("123456"), attempts: 0 });
    expect(await login({ phone: PHONE, code: "123456" })).toEqual({ error: "verifyFailed" });
  });
});

// ---------- Logout and profile ----------

describe("logout", () => {
  test("ends the session and goes to the home page", async () => {
    await expect(logout()).rejects.toMatchObject({ digest: expect.stringContaining(";/;") });
    expect(m.deleteSession).toHaveBeenCalled();
    expect(m.redirect).toHaveBeenCalledWith("/");
  });
});

describe("updateProfile", () => {
  test("a guest is sent to log in", async () => {
    m.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(updateProfile("Anjali")).rejects.toThrow("NEXT_REDIRECT");
    expect(m.requireUser).toHaveBeenCalledWith("/profile/");
  });

  test("a name under 2 or over 80 characters is refused", async () => {
    m.requireUser.mockResolvedValue(customer);
    expect(await updateProfile(" A ")).toEqual({ error: "enterName" });
    expect(await updateProfile("A".repeat(81))).toEqual({ error: "enterName" });
    expect(users.updateOne).not.toHaveBeenCalled();
  });

  test("saves the trimmed name on the customer's own account", async () => {
    m.requireUser.mockResolvedValue(customer);
    expect(await updateProfile("  Anjali D'Souza ")).toEqual({ ok: true });
    expect(users.updateOne).toHaveBeenCalledWith({ _id: customer._id }, { $set: { name: "Anjali D'Souza" } });
  });
});
