// @vitest-environment node
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BANNER_FOLDER, cloudinaryCloudName, signUpload } from "./cloudinary";

vi.mock("server-only", () => ({}));

// A fixed "now": 15 June 2026, 12:00 India time = 1781505000 seconds since 1970
const NOW = Date.parse("2026-06-15T12:00:00+05:30");
const TIMESTAMP = String(NOW / 1000);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("CLOUDINARY_CLOUD_NAME", "melovme-cloud");
  vi.stubEnv("CLOUDINARY_API_KEY", "123456");
  vi.stubEnv("CLOUDINARY_API_SECRET", "s3cret");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("signUpload", () => {
  test("signs the folder and timestamp the way Cloudinary expects", () => {
    // Sorted by name, joined with &, secret appended, then SHA-1 hex
    const expected = createHash("sha1").update(`folder=melovme/products&timestamp=${TIMESTAMP}s3cret`).digest("hex");
    expect(signUpload()).toEqual({
      cloudName: "melovme-cloud",
      apiKey: "123456",
      signature: expected,
      folder: "melovme/products",
      timestamp: TIMESTAMP,
    });
  });

  test("uploads go to the products folder unless another folder is given", () => {
    expect(signUpload().folder).toBe("melovme/products");
    expect(signUpload(BANNER_FOLDER).folder).toBe("melovme/banners");
  });

  test("a different folder gives a different signature", () => {
    expect(signUpload(BANNER_FOLDER).signature).not.toBe(signUpload().signature);
  });

  test("the timestamp is whole seconds, rounded down", () => {
    vi.setSystemTime(NOW + 999); // 0.999 s later is still the same second
    expect(signUpload().timestamp).toBe(TIMESTAMP);
  });

  test("the API secret is never sent back", () => {
    expect(JSON.stringify(signUpload())).not.toContain("s3cret");
  });

  test("refuses to sign when any Cloudinary setting is missing", () => {
    for (const name of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]) {
      vi.stubEnv(name, "");
      expect(() => signUpload()).toThrow("is not set");
      vi.stubEnv(name, "x");
    }
  });
});

describe("cloudinaryCloudName", () => {
  test("is empty when not set", () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", undefined);
    expect(cloudinaryCloudName()).toBe("");
  });
});
