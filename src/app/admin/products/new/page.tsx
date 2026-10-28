import type { Metadata } from "next";
import ProductForm from "@/components/admin/ProductForm";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireAdmin("/admin/products/new/");
  return (
    <div>
      <h2 className="mb-6 text-2xl font-medium">New product</h2>
      <ProductForm
        isNew
        initial={{
          slug: "",
          name: "",
          category: "",
          size: "",
          price: 0,
          shortDescription: "",
          description: "",
          images: [],
          highlights: [],
          ingredients: [],
          howToUse: "",
          enabled: true,
          stock: null,
          offer: null,
          combos: [],
        }}
      />
    </div>
  );
}
