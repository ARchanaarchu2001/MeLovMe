import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { defaultAnnouncement, type Announcement } from "@/lib/announcement";
import { getDb, type AnnouncementSettingsDoc } from "./db";

// The announcement bar's settings, or the defaults (switched off) until an admin saves it.
// Cached across requests; saving calls refreshAnnouncement() so the shop updates straight away.
export const getAnnouncement = unstable_cache(
  async (): Promise<Announcement> => {
    const { settings } = await getDb();
    const doc = (await settings.findOne({ _id: "announcement" })) as AnnouncementSettingsDoc | null;
    if (!doc) return defaultAnnouncement;
    return {
      enabled: doc.enabled,
      messages: doc.messages,
      background: doc.background,
      textColor: doc.textColor,
      speed: doc.speed ?? defaultAnnouncement.speed,
    };
  },
  ["announcement"],
  { tags: ["announcement"] },
);

export function refreshAnnouncement() {
  revalidateTag("announcement", { expire: 0 });
}
