import type { Metadata } from "next";
import AdminReviewForm from "@/components/admin/AdminReviewForm";
import { getDb } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Add review" };

export default async function NewReviewPage({ searchParams }: PageProps<"/admin/reviews/new">) {
  await requireAdmin("/admin/reviews/new/");
  const { product } = await searchParams;
  const products = await (await getDb()).products.find({}, { projection: { name: 1 } }).sort({ createdAt: 1 }).toArray();

  return (
    <div>
      <h2 className="mb-6 text-2xl font-medium">Add review</h2>
      <AdminReviewForm
        id={null}
        products={products.map((p) => ({ slug: p._id, name: p.name }))}
        initial={{ productSlug: typeof product === "string" ? product : "", name: "", rating: 0, title: "", text: "" }}
      />
    </div>
  );
}
