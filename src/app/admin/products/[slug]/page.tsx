import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductForm from "@/components/admin/ProductForm";
import { getDb } from "@/lib/server/db";
import { toProduct } from "@/lib/server/products";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Edit product" };

// Offer dates are stored as moments in time; the form shows them as India-time dates
const indiaDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "");

export default async function EditProductPage({ params }: PageProps<"/admin/products/[slug]">) {
  const { slug } = await params;
  await requireAdmin(`/admin/products/${encodeURIComponent(slug)}/`);
  const doc = await (await getDb()).products.findOne({ _id: slug });
  if (!doc) notFound();
  const p = toProduct(doc);

  return (
    <div>
      <h2 className="mb-6 text-2xl font-medium">{p.name}</h2>
      <ProductForm
        isNew={false}
        initial={{
          ...p,
          offer: p.offer
            ? { type: p.offer.type, value: p.offer.value, startDate: indiaDate(p.offer.startsAt), endDate: indiaDate(p.offer.endsAt) }
            : null,
        }}
      />
    </div>
  );
}
