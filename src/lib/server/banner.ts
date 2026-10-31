import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { defaultBanner, type Banner } from "@/lib/banner";
import { getDb, type BannerSettingsDoc } from "./db";

// The home page banner, or the defaults (switched off: the built-in hero shows) until an admin saves it.
// Cached across requests; saving calls refreshBanner() so the shop updates straight away.
export const getBanner = unstable_cache(
  async (): Promise<Banner> => {
    const { settings } = await getDb();
    const doc = (await settings.findOne({ _id: "banner" })) as BannerSettingsDoc | null;
    if (!doc) return defaultBanner;
    return {
      enabled: doc.enabled,
      image: doc.image,
      mobileImage: doc.mobileImage,
      alt: doc.alt,
      showButtons: doc.showButtons,
      buttonPosition: doc.buttonPosition,
      buttonStyle: doc.buttonStyle,
      // Banners saved before the buttons could be changed keep "Explore Products" and "Our Story"
      primaryButton: doc.primaryButton ?? defaultBanner.primaryButton,
      secondaryButton: doc.secondaryButton ?? defaultBanner.secondaryButton,
    };
  },
  ["banner"],
  { tags: ["banner"] },
);

export function refreshBanner() {
  revalidateTag("banner", { expire: 0 });
}
