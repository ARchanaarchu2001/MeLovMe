import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductForm from "@/components/admin/ProductForm";
import { BackLink } from "@/components/admin/ui";
import { getDb } from "@/lib/server/db";
import { categoryNames, loadCategories, toProduct } from "@/lib/server/products";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Edit product" };

// Offer dates are stored as moments in time; the form shows them as India-time dates
const indiaDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "");

export default async function EditProductPage({ params }: PageProps<"/admin/products/[slug]">) {
  const { slug } = await params;
  await requireAdmin(`/admin/products/${encodeURIComponent(slug)}/`);
  const doc = await (await getDb()).products.findOne({ _id: slug });
  if (!doc) notFound();
  const categories = await loadCategories();
  const p = toProduct(doc, categoryNames(categories));

  return (
    <div>
      <BackLink href="/admin/products/">All products</BackLink>
      <h2 className="mb-6 text-2xl font-medium">{p.name}</h2>
      <ProductForm
        isNew={false}
        categories={categories}
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
