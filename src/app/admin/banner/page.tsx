import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import BannerForm from "@/components/admin/BannerForm";
import { bannerLinkGroups } from "@/lib/banner";
import { categoryLabel, flatTree } from "@/lib/category";
import { getBanner } from "@/lib/server/banner";
import { getCatalog, getCategories } from "@/lib/server/products";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Home banner" };

// The banner picture at the top of the home page, with the shop's buttons placed over it
export default async function BannerPage() {
  await requireAdmin("/admin/banner/");
  const t = await getTranslations("home");
  const [banner, categories, products] = await Promise.all([getBanner(), getCategories(), getCatalog()]);
  // Every page a button can link to: the shop's pages, each category and each product on sale
  const links = bannerLinkGroups(
    flatTree(categories).map((c) => ({ slug: c.slug, label: categoryLabel(categories, c.id) })),
    products,
  );
  // The form shows the page title, with its switch and buttons beside it
  return (
    <BannerForm
      initial={banner}
      labels={{ heading: t("hero.eyebrow"), explore: t("hero.explore"), ourStory: t("hero.ourStory") }}
      links={links}
    />
  );
}
