"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Product } from "@/lib/product";

// The shop's products (enabled only), loaded on the server in the root layout and shared with
// client components such as the cart, wishlist and header counters.
const CatalogContext = createContext<Product[]>([]);
// Whether any payment method is on (see canBuy in src/lib/payments.ts). When not, the cart,
// Add to Cart and Buy Now are hidden and customers order on WhatsApp instead.
const CanBuyContext = createContext(true);

export function CatalogProvider({ products, canBuy, children }: { products: Product[]; canBuy: boolean; children: ReactNode }) {
  return (
    <CatalogContext.Provider value={products}>
      <CanBuyContext.Provider value={canBuy}>{children}</CanBuyContext.Provider>
    </CatalogContext.Provider>
  );
}

export function useCatalog() {
  const products = useContext(CatalogContext);
  return {
    products,
    get: (slug: string) => products.find((p) => p.slug === slug),
  };
}

export const useCanBuy = () => useContext(CanBuyContext);
