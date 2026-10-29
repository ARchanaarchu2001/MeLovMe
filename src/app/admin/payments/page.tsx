import type { Metadata } from "next";
import PaymentSettingsForm from "@/components/admin/PaymentSettingsForm";
import { siteUrl } from "@/data/site";
import { formatPrice } from "@/lib/format";
import { priceOf } from "@/lib/product";
import { getPaymentSettings } from "@/lib/server/payments";
import { getCatalog } from "@/lib/server/products";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Payments" };

// How customers can buy: online payment, cash on delivery, WhatsApp
export default async function PaymentsPage() {
  await requireAdmin("/admin/payments/");
  // A real product for the WhatsApp message preview
  const p = (await getCatalog())[0];
  const sample = p && {
    name: p.name,
    size: p.size,
    price: formatPrice(priceOf(p).price),
    url: `${siteUrl()}/products/${p.slug}/`,
    image: p.images[0],
    description: p.shortDescription,
  };
  return (
    <div>
      <h2 className="mb-6 text-2xl font-medium">Payment methods</h2>
      <PaymentSettingsForm initial={await getPaymentSettings()} sample={sample} />
    </div>
  );
}
