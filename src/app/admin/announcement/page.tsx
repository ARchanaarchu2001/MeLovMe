import type { Metadata } from "next";
import AnnouncementForm from "@/components/admin/AnnouncementForm";
import { getAnnouncement } from "@/lib/server/announcement";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Announcement bar" };

// The scrolling strip of offers and news above the shop header
export default async function AnnouncementPage() {
  await requireAdmin("/admin/announcement/");
  return (
    <div>
      <h2 className="mb-6 text-2xl font-medium">Announcement bar</h2>
      <AnnouncementForm initial={await getAnnouncement()} />
    </div>
  );
}
