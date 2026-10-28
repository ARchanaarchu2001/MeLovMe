import type { Metadata } from "next";
import { ObjectId } from "mongodb";
import { notFound } from "next/navigation";
import AdminReviewForm from "@/components/admin/AdminReviewForm";
import { BackLink } from "@/components/admin/ui";
import { getDb } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Edit review" };

// Only reviews the shop added can be edited; customers' reviews can only be hidden or deleted
export default async function EditReviewPage({ params }: PageProps<"/admin/reviews/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/reviews/${encodeURIComponent(id)}/`);
  if (!ObjectId.isValid(id)) notFound();
  const { reviews, products } = await getDb();
  const [review, productList] = await Promise.all([
    reviews.findOne({ _id: new ObjectId(id), source: "admin" }),
    products.find({}, { projection: { name: 1, images: 1 } }).sort({ name: 1 }).toArray(),
  ]);
  if (!review) notFound();

  return (
    <div>
      <BackLink href="/admin/reviews/">All reviews</BackLink>
      <h2 className="mb-6 text-2xl font-medium">Edit review</h2>
      <AdminReviewForm
        id={id}
        products={productList.map((p) => ({ slug: p._id, name: p.name, image: p.images?.[0] }))}
        initial={{ productSlug: review.productSlug, name: review.name, rating: review.rating, title: review.title, text: review.text }}
      />
    </div>
  );
}
