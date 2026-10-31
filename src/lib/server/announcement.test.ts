// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";
import { defaultAnnouncement } from "@/lib/announcement";
import { getAnnouncement, refreshAnnouncement } from "./announcement";

const { settings, revalidateTag } = vi.hoisted(() => ({
  settings: { findOne: vi.fn() },
  revalidateTag: vi.fn(),
}));

vi.mock("server-only", () => ({}));
// No caching in tests: the function runs every time
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag }));
vi.mock("./db", () => ({ getDb: async () => ({ settings }) }));

const saved = {
  _id: "announcement",
  enabled: true,
  messages: [{ text: "Diwali sale: 20% off" }],
  background: "#000000",
  textColor: "#ffffff",
  speed: "fast",
  updatedAt: new Date("2026-06-15T12:00:00+05:30"),
};

beforeEach(() => {
  settings.findOne.mockReset();
  revalidateTag.mockReset();
});

describe("getAnnouncement", () => {
  test("looks up the announcement settings document", async () => {
    settings.findOne.mockResolvedValue(null);
    await getAnnouncement();
    expect(settings.findOne).toHaveBeenCalledWith({ _id: "announcement" });
  });

  test("shows the defaults (switched off) until an admin saves it", async () => {
    settings.findOne.mockResolvedValue(null);
    expect(await getAnnouncement()).toEqual(defaultAnnouncement);
    expect(defaultAnnouncement.enabled).toBe(false);
  });

  test("returns what the admin saved, without the database fields", async () => {
    settings.findOne.mockResolvedValue(saved);
    expect(await getAnnouncement()).toEqual({
      enabled: true,
      messages: [{ text: "Diwali sale: 20% off" }],
      background: "#000000",
      textColor: "#ffffff",
      speed: "fast",
    });
  });

  test("settings saved before the speed option existed use the default speed", async () => {
    const old = { ...saved, speed: undefined };
    settings.findOne.mockResolvedValue(old);
    expect((await getAnnouncement()).speed).toBe("normal");
  });
});

describe("refreshAnnouncement", () => {
  test("expires the cached announcement straight away", () => {
    refreshAnnouncement();
    expect(revalidateTag).toHaveBeenCalledWith("announcement", { expire: 0 });
  });
});
