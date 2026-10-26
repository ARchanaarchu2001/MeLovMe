import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import WishlistView from "@/components/WishlistView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cart.wishlist");
  return {
    title: t("title"),
    robots: { index: false },
  };
}

export default function WishlistPage() {
  const t = useTranslations("cart.wishlist");
  return (
    <section className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="mb-10 mt-4 text-4xl font-light md:text-5xl">{t("title")}</h1>
      <WishlistView />
    </section>
  );
}
