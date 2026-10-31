// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ getAdmin: vi.fn(), signUpload: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/session", () => ({ getAdmin: m.getAdmin }));
vi.mock("@/lib/server/cloudinary", () => ({
  PRODUCT_FOLDER: "melovme/products",
  BANNER_FOLDER: "melovme/banners",
  TESTIMONIAL_FOLDER: "melovme/testimonials",
  signUpload: m.signUpload,
}));

import { POST } from "./route";

const ask = (body: string) => POST(new Request("http://localhost/api/admin/images/", { method: "POST", body }));
const askFor = (kind: string) => ask(JSON.stringify({ kind }));
const signature = { signature: "abc", timestamp: 1781500000, folder: "melovme/products" };

beforeEach(() => {
  m.getAdmin.mockResolvedValue({ name: "Owner", superAdmin: true });
  m.signUpload.mockReturnValue(signature);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("POST /api/admin/images", () => {
  test("anyone who isn't an admin gets 403 and no signature", async () => {
    m.getAdmin.mockResolvedValue(null);
    const res = await askFor("product");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Not allowed" });
    expect(m.signUpload).not.toHaveBeenCalled();
  });

  test("an admin gets a signature for the product folder", async () => {
    const res = await askFor("product");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(signature);
    expect(m.signUpload).toHaveBeenCalledWith("melovme/products");
  });

  test("banner and testimonial uploads go to their own folders", async () => {
    await askFor("banner");
    await askFor("testimonial");
    expect(m.signUpload.mock.calls).toEqual([["melovme/banners"], ["melovme/testimonials"]]);
  });

  test("an unknown kind or a body that isn't JSON falls back to the product folder", async () => {
    await askFor("../../secrets");
    await ask("not json");
    expect(m.signUpload.mock.calls).toEqual([["melovme/products"], ["melovme/products"]]);
  });

  test("returns 500 while Cloudinary isn't set up", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.signUpload.mockImplementation(() => {
      throw new Error("CLOUDINARY_API_SECRET is not set");
    });
    const res = await askFor("product");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Image uploads aren't set up yet." });
  });
});
