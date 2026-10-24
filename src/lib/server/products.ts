import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import type { Product } from "@/lib/product";
import { getDb, type ProductDoc } from "./db";

// Only these fields go to the browser
export const toProduct = (d: ProductDoc): Product => ({
  slug: d._id,
  name: d.name,
  category: d.category,
  size: d.size,
  price: d.price,
  shortDescription: d.shortDescription,
  description: d.description,
  images: d.images,
  highlights: d.highlights,
  ingredients: d.ingredients,
  howToUse: d.howToUse,
  enabled: d.enabled,
  offer: d.offer ?? null,
});

// The products the shop shows (enabled only), in the order they were added. Cached across
// requests; admin changes call refreshCatalog() so the shop updates straight away.
export const getCatalog = unstable_cache(
  async (): Promise<Product[]> => {
    const { products } = await getDb();
    return (await products.find({ enabled: true }).sort({ createdAt: 1 }).toArray()).map(toProduct);
  },
  ["catalog"],
  { tags: ["products"] },
);

export async function getCatalogProduct(slug: string) {
  return (await getCatalog()).find((p) => p.slug === slug);
}

export function refreshCatalog() {
  // expire: 0 — the next visitor gets fresh data, not the old catalogue
  revalidateTag("products", { expire: 0 });
}
