import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import CartView from "@/components/CartView";
import { getPaymentSettings } from "@/lib/server/payments";
import { canBuy } from "@/lib/payments";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("cart.page");
  return {
    title: t("title"),
    robots: { index: false },
  };
}

export default async function CartPage() {
  const t = await getTranslations("cart.page");
  const payments = await getPaymentSettings();
  // No payment method on: the shop takes orders on WhatsApp, from the product pages
  if (!canBuy(payments)) redirect("/products/");
  const { razorpay } = payments;
  return (
    <section className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-16">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="mb-6 md:mb-10 mt-4 text-4xl font-light md:text-5xl">{t("title")}</h1>
      <CartView razorpay={razorpay} />
    </section>
  );
}
