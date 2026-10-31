// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";
import { defaultBanner } from "@/lib/banner";
import { getBanner, refreshBanner } from "./banner";

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

describe("getBanner", () => {
  test("looks up the banner settings document", async () => {
    settings.findOne.mockResolvedValue(null);
    await getBanner();
    expect(settings.findOne).toHaveBeenCalledWith({ _id: "banner" });
  });

  test("shows the defaults (switched off, so the built-in hero shows) until an admin saves it", async () => {
    settings.findOne.mockResolvedValue(null);
    expect(await getBanner()).toEqual(defaultBanner);
    expect(defaultBanner.enabled).toBe(false);
  });

  test("returns what the admin saved, without the database fields", async () => {
    settings.findOne.mockResolvedValue({
      _id: "banner",
      enabled: true,
      image: "https://res.cloudinary.com/x/banner.jpg",
      mobileImage: null,
      alt: "Summer collection",
      showButtons: false,
      buttonPosition: "center",
      buttonStyle: "dark",
      updatedAt: new Date("2026-06-15T12:00:00+05:30"),
    });
    expect(await getBanner()).toEqual({
      enabled: true,
      image: "https://res.cloudinary.com/x/banner.jpg",
      mobileImage: null,
      alt: "Summer collection",
      showButtons: false,
      buttonPosition: "center",
      buttonStyle: "dark",
      // Saved before the buttons could be changed: the usual ones
      primaryButton: { label: "", link: "/products/" },
      secondaryButton: { label: "", link: "/about/" },
    });
  });

  test("returns the button text and links the admin saved", async () => {
    const primaryButton = { label: "Shop the sale", link: "/products/?category=gift-sets" };
    const secondaryButton = { label: "Follow us", link: "https://instagram.com/melovme" };
    settings.findOne.mockResolvedValue({ _id: "banner", ...defaultBanner, primaryButton, secondaryButton, updatedAt: new Date() });
    expect(await getBanner()).toMatchObject({ primaryButton, secondaryButton });
  });
});

describe("refreshBanner", () => {
  test("expires the cached banner straight away", () => {
    refreshBanner();
    expect(revalidateTag).toHaveBeenCalledWith("banner", { expire: 0 });
  });
});
