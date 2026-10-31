import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import BannerForm from "@/components/admin/BannerForm";
import { getBanner } from "@/lib/server/banner";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Home banner" };

// The banner picture at the top of the home page, with the shop's buttons placed over it
export default async function BannerPage() {
  await requireAdmin("/admin/banner/");
  const t = await getTranslations("home");
  // The form shows the page title, with its switch and buttons beside it
  return (
    <BannerForm
      initial={await getBanner()}
      labels={{ heading: t("hero.eyebrow"), explore: t("hero.explore"), ourStory: t("hero.ourStory") }}
    />
  );
}
