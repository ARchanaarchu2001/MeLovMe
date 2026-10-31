import { afterEach, describe, expect, test, vi } from "vitest";
import { IMAGE_TYPES, shrink, uploadToCloudinary } from "./upload";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// A stand-in for fetch's reply: just what uploadToCloudinary reads
const reply = (ok: boolean, data: unknown) => ({ ok, json: async () => data }) as Response;

// What our server sends back to allow one upload
const signature = { cloudName: "demo", apiKey: "123", signature: "sig", timestamp: "1781500000", folder: "melovme/products" };
// What Cloudinary sends back after a successful upload
const uploaded = { secure_url: "https://res.cloudinary.com/demo/image/upload/v1/melovme/products/a.webp", width: 1600, height: 1200 };

const photo = new Blob(["fake image"], { type: "image/webp" });

describe("image types", () => {
  test("the admin can pick JPEG, PNG and WebP photos", () => {
    expect(IMAGE_TYPES).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });
});

describe("uploading: uploadToCloudinary", () => {
  test("returns Cloudinary's link (set to pick the best format and quality) and the picture's size", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply(true, signature)).mockResolvedValueOnce(reply(true, uploaded)));
    expect(await uploadToCloudinary(photo)).toEqual({
      url: "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/melovme/products/a.webp",
      width: 1600,
      height: 1200,
    });
  });

  test("asks our server to sign the upload for the right kind of picture", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply(true, signature)).mockResolvedValueOnce(reply(true, uploaded));
    vi.stubGlobal("fetch", fetch);
    await uploadToCloudinary(photo, "banner");
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("/api/admin/images/");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ kind: "banner" });
  });

  test("uploads are product photos unless told otherwise", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply(true, signature)).mockResolvedValueOnce(reply(true, uploaded));
    vi.stubGlobal("fetch", fetch);
    await uploadToCloudinary(photo);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ kind: "product" });
  });

  test("sends the photo and the signature to the shop's Cloudinary account", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply(true, signature)).mockResolvedValueOnce(reply(true, uploaded));
    vi.stubGlobal("fetch", fetch);
    await uploadToCloudinary(photo);
    const [url, options] = fetch.mock.calls[1];
    expect(url).toBe("https://api.cloudinary.com/v1_1/demo/image/upload");
    const body = options.body as FormData;
    expect(body.get("file")).toBeInstanceOf(Blob);
    expect(body.get("api_key")).toBe("123");
    expect(body.get("timestamp")).toBe("1781500000");
    expect(body.get("signature")).toBe("sig");
    expect(body.get("folder")).toBe("melovme/products");
  });

  test("shows our server's reason when it refuses, and uploads nothing", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply(false, { error: "Please log in again." }));
    vi.stubGlobal("fetch", fetch);
    await expect(uploadToCloudinary(photo)).rejects.toThrow("Please log in again.");
    expect(fetch).toHaveBeenCalledOnce();
  });

  test("fails with a general message when the server gives no signature or reason", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply(true, {})));
    await expect(uploadToCloudinary(photo)).rejects.toThrow("Upload failed");
  });

  test("shows Cloudinary's reason when the upload fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(reply(true, signature)).mockResolvedValueOnce(reply(false, { error: { message: "Invalid Signature" } })),
    );
    await expect(uploadToCloudinary(photo)).rejects.toThrow("Invalid Signature");
  });

  test("fails with a general message when Cloudinary sends back no link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply(true, signature)).mockResolvedValueOnce(reply(true, {})));
    await expect(uploadToCloudinary(photo)).rejects.toThrow("Upload failed");
  });

  test("a missing size from Cloudinary is stored as 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(reply(true, signature)).mockResolvedValueOnce(reply(true, { secure_url: uploaded.secure_url })),
    );
    expect(await uploadToCloudinary(photo)).toMatchObject({ width: 0, height: 0 });
  });
});

describe("shrinking photos: shrink", () => {
  // Fakes the browser's image decoding and canvas (jsdom has neither)
  function fakeBrowser(width: number, height: number, blob: Blob | null = new Blob(["webp"], { type: "image/webp" })) {
    const bitmap = { width, height, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob: vi.fn((done: (b: Blob | null) => void) => done(blob)),
    };
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) =>
      tag === "canvas" ? (canvas as unknown as HTMLCanvasElement) : createElement(tag),
    );
    return { bitmap, canvas, drawImage };
  }
  const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });

  test("a wide photo is shrunk to 1600px wide, keeping its shape", async () => {
    const { canvas } = fakeBrowser(3200, 2400);
    await shrink(file);
    // 3200 × 2400 at half size
    expect([canvas.width, canvas.height]).toEqual([1600, 1200]);
  });

  test("a tall photo is shrunk to the size limit high", async () => {
    const { canvas } = fakeBrowser(1000, 4000);
    await shrink(file, 1600);
    // 1600 / 4000 = 0.4 → 400 × 1600
    expect([canvas.width, canvas.height]).toEqual([400, 1600]);
  });

  test("a small photo isn't made bigger", async () => {
    const { canvas } = fakeBrowser(800, 600);
    await shrink(file);
    expect([canvas.width, canvas.height]).toEqual([800, 600]);
  });

  test("the photo is saved as WebP at 85% quality", async () => {
    const { canvas } = fakeBrowser(800, 600);
    const blob = await shrink(file);
    expect(blob.type).toBe("image/webp");
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.85);
  });

  test("draws the whole photo onto the smaller canvas and frees the original", async () => {
    const { bitmap, drawImage } = fakeBrowser(3200, 2400);
    await shrink(file);
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1600, 1200);
    expect(bitmap.close).toHaveBeenCalled();
  });

  test("fails with a clear message when the browser can't produce the image", async () => {
    fakeBrowser(800, 600, null);
    await expect(shrink(file)).rejects.toThrow("Could not process the image");
  });
});
