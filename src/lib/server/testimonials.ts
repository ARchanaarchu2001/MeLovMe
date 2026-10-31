import "server-only";
import { getTranslations } from "next-intl/server";
import { revalidateTag, unstable_cache } from "next/cache";
import { testimonials as builtIn } from "@/data/site";
import type { Testimonials } from "@/lib/testimonials";
import { getDb, type TestimonialsSettingsDoc } from "./db";

// What an admin saved, or null if they never have. Cached across requests; saving calls
// refreshTestimonials() so the shop updates straight away.
const getSaved = unstable_cache(
  async (): Promise<Testimonials | null> => {
    const { settings } = await getDb();
    const doc = (await settings.findOne({ _id: "testimonials" })) as TestimonialsSettingsDoc | null;
    if (!doc) return null;
    return { enabled: doc.enabled, layout: doc.layout, autoScroll: doc.autoScroll, items: doc.items };
  },
  ["testimonials"],
  { tags: ["testimonials"] },
);

// The home page reviews: the saved ones, or until then the built-in ones from en.json
export async function getTestimonials(): Promise<Testimonials> {
  const saved = await getSaved();
  if (saved) return saved;
  const t = await getTranslations("home");
  return {
    enabled: true,
    layout: "grid",
    autoScroll: false,
    items: builtIn.map((key) => ({
      id: key,
      name: t(`testimonials.${key}.name`),
      place: t(`testimonials.${key}.place`),
      message: t(`testimonials.${key}.quote`),
      photo: null,
    })),
  };
}

export function refreshTestimonials() {
  revalidateTag("testimonials", { expire: 0 });
}
