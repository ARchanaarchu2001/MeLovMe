// @vitest-environment node
import { generateKeyPair, SignJWT, type CryptoKey } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

const { keys } = vi.hoisted(() => ({ keys: { google: null as CryptoKey | null } }));

vi.mock("server-only", () => ({}));
// Instead of downloading Google's public keys, Firebase tokens are checked against a test key pair
vi.mock("jose", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createRemoteJWKSet: () => async () => keys.google,
}));

const PROJECT = "melovme-test";
const NOW = Date.parse("2026-06-15T12:00:00+05:30");
const NOW_S = NOW / 1000;

let googleKey: CryptoKey; // signs the tokens "Firebase" issues
let otherKey: CryptoKey; // someone else's key

beforeAll(async () => {
  const google = await generateKeyPair("RS256");
  keys.google = google.publicKey;
  googleKey = google.privateKey;
  otherKey = (await generateKeyPair("RS256")).privateKey;
});

// firebase-config reads the project id when it is first imported, so import afresh after setting it
const load = async () => {
  vi.resetModules();
  return (await import("./firebase")).verifyPhoneToken;
};

// A token like the one Firebase gives the browser after the SMS code is entered
const token = (
  claims: Record<string, unknown> = {},
  { key = googleKey, issuer = `https://securetoken.google.com/${PROJECT}`, audience = PROJECT, alg = "RS256", exp = NOW_S + 3600 } = {},
) =>
  new SignJWT({ phone_number: "+919876543210", auth_time: NOW_S - 60, ...claims })
    .setProtectedHeader({ alg })
    .setSubject("firebase-uid-1")
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(NOW_S - 60)
    .setExpirationTime(exp)
    .sign(key);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", PROJECT);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("verifyPhoneToken", () => {
  test("a valid Firebase token gives the 10-digit mobile number", async () => {
    const verify = await load();
    expect(await verify(await token())).toBe("9876543210");
  });

  test("a token signed with someone else's key is rejected", async () => {
    const verify = await load();
    expect(await verify(await token({}, { key: otherKey }))).toBeNull();
  });

  test("a token for another Firebase project is rejected", async () => {
    const verify = await load();
    expect(await verify(await token({}, { audience: "other-project" }))).toBeNull();
    expect(await verify(await token({}, { issuer: "https://securetoken.google.com/other-project" }))).toBeNull();
  });

  test("an expired token is rejected", async () => {
    const verify = await load();
    expect(await verify(await token({}, { exp: NOW_S - 1 }))).toBeNull();
  });

  test("a token without a sign-in time, or one in the future, is rejected", async () => {
    const verify = await load();
    expect(await verify(await token({ auth_time: undefined }))).toBeNull();
    expect(await verify(await token({ auth_time: NOW_S + 60 }))).toBeNull();
  });

  test("only Indian mobile numbers are accepted", async () => {
    const verify = await load();
    for (const phone_number of ["+14155550123", "+915876543210", "+91987654321", "9876543210", undefined]) {
      expect(await verify(await token({ phone_number }))).toBeNull();
    }
  });

  test("anything that isn't a token is rejected without crashing", async () => {
    const verify = await load();
    for (const bad of ["", "not-a-jwt", undefined, 42]) expect(await verify(bad as string)).toBeNull();
  });

  test("everything is rejected while Firebase isn't set up", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "");
    const verify = await load();
    expect(await verify(await token())).toBeNull();
  });
});
