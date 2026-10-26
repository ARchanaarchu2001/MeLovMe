import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import CheckoutFlow from "@/components/CheckoutFlow";
import { razorpayKeyId } from "@/lib/server/razorpay";
import { requireUser } from "@/lib/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("checkout.page");
  return {
    title: t("title"),
    robots: { index: false },
  };
}

// Guests can shop and fill their cart, but must log in here before buying
export default async function CheckoutPage() {
  const user = await requireUser("/checkout/");
  const t = await getTranslations("checkout.page");
  const addresses = user.addresses.map(({ _id, ...a }) => ({ ...a, id: _id.toHexString() }));

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="mb-10 mt-4 text-4xl font-light md:text-5xl">{t("title")}</h1>
      {/* The key ID is public by design (it identifies the account); the secret stays on the server */}
      <CheckoutFlow addresses={addresses} user={{ name: user.name, phone: user.phone }} razorpayKey={razorpayKeyId()} />
    </section>
  );
}
