import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import CartView from "@/components/CartView";
import { getPaymentSettings } from "@/lib/server/payments";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cart.page");
  return {
    title: t("title"),
    robots: { index: false },
  };
}

export default async function CartPage() {
  const t = await getTranslations("cart.page");
  const { razorpay } = await getPaymentSettings();
  return (
    <section className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-16">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="mb-6 md:mb-10 mt-4 text-4xl font-light md:text-5xl">{t("title")}</h1>
      <CartView razorpay={razorpay} />
    </section>
  );
}
