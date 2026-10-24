"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Product } from "@/lib/product";

// The shop's products (enabled only), loaded on the server in the root layout and shared with
// client components such as the cart, wishlist and header counters.
const CatalogContext = createContext<Product[]>([]);

export function CatalogProvider({ products, children }: { products: Product[]; children: ReactNode }) {
  return <CatalogContext.Provider value={products}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const products = useContext(CatalogContext);
  return {
    products,
    get: (slug: string) => products.find((p) => p.slug === slug),
  };
}
