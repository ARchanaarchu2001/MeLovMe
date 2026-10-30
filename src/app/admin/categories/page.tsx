import type { Metadata } from "next";
import CategoryManager from "@/components/admin/CategoryManager";
import { getDb } from "@/lib/server/db";
import { loadCategories } from "@/lib/server/products";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Categories" };

// The category tree with product counts. Hidden products count too: they still belong to a category.
export default async function AdminCategoriesPage() {
  await requireAdmin("/admin/categories/");
  const [categories, products] = await Promise.all([
    loadCategories(),
    (await getDb()).products.find({}, { projection: { name: 1, categoryId: 1, enabled: 1 } }).sort({ name: 1 }).toArray(),
  ]);
  return (
    <CategoryManager
      categories={categories}
      products={products.map((p) => ({ slug: p._id, name: p.name, categoryId: p.categoryId ?? "", enabled: p.enabled }))}
    />
  );
}
