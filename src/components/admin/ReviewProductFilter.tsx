"use client";

import { useRouter } from "next/navigation";
import ProductSelect, { type ProductOption } from "./ProductSelect";

// The product filter on the reviews list: picking one reloads the list for that product,
// keeping the current tab and search
export default function ReviewProductFilter({ products, value, view, q }: { products: ProductOption[]; value: string; view: string; q: string }) {
  const router = useRouter();
  return (
    <ProductSelect
      products={products}
      value={value}
      allLabel="All products"
      className="w-full sm:w-72"
      onChange={(slug) => router.push(`/admin/reviews/?${new URLSearchParams({ view, ...(q && { q }), ...(slug && { product: slug }) })}`)}
    />
  );
}
