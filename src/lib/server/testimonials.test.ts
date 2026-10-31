// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getTestimonials, refreshTestimonials } from "./testimonials";

const { settings, revalidateTag, getTranslations } = vi.hoisted(() => ({
  settings: { findOne: vi.fn() },
  revalidateTag: vi.fn(),
  // A fake translator that just shows which key was asked for
  getTranslations: vi.fn(async (ns: string) => (key: string) => `${ns}.${key}`),
}));

vi.mock("server-only", () => ({}));
// No caching in tests: the function runs every time
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag }));
vi.mock("next-intl/server", () => ({ getTranslations }));
vi.mock("./db", () => ({ getDb: async () => ({ settings }) }));

beforeEach(() => {
  settings.findOne.mockReset();
  revalidateTag.mockReset();
  getTranslations.mockClear();
});

describe("getTestimonials", () => {
  test("looks up the testimonials settings document", async () => {
    settings.findOne.mockResolvedValue(null);
    await getTestimonials();
    expect(settings.findOne).toHaveBeenCalledWith({ _id: "testimonials" });
  });

  test("returns what the admin saved, without the database fields", async () => {
    const items = [{ id: "t1", name: "Meera", place: "Kochi", message: "Lovely scent", photo: null }];
    settings.findOne.mockResolvedValue({ _id: "testimonials", enabled: false, layout: "slider", autoScroll: true, items, updatedAt: new Date() });
    expect(await getTestimonials()).toEqual({ enabled: false, layout: "slider", autoScroll: true, items });
    expect(getTranslations).not.toHaveBeenCalled();
  });

  test("an admin who saved an empty list gets the empty list, not the built-in reviews", async () => {
    settings.findOne.mockResolvedValue({ _id: "testimonials", enabled: true, layout: "grid", autoScroll: false, items: [] });
    expect((await getTestimonials()).items).toEqual([]);
  });

  test("until an admin saves them, shows the built-in reviews from en.json in a grid", async () => {
    settings.findOne.mockResolvedValue(null);
    const result = await getTestimonials();
    expect(getTranslations).toHaveBeenCalledWith("home");
    expect(result).toMatchObject({ enabled: true, layout: "grid", autoScroll: false });
    expect(result.items.map((i) => i.id)).toEqual(["priya", "arjun", "sneha"]);
    expect(result.items[0]).toEqual({
      id: "priya",
      name: "home.testimonials.priya.name",
      place: "home.testimonials.priya.place",
      message: "home.testimonials.priya.quote",
      photo: null,
    });
  });
});

describe("refreshTestimonials", () => {
  test("expires the cached testimonials straight away", () => {
    refreshTestimonials();
    expect(revalidateTag).toHaveBeenCalledWith("testimonials", { expire: 0 });
  });
});
