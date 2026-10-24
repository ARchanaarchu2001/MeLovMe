import type { ReactNode } from "react";
import { CatalogProvider } from "./CatalogProvider";
import Footer from "./Footer";
import Header from "./Header";
import { getCatalog } from "@/lib/server/products";

// The shop's header and footer around a page, plus the product catalogue that the cart,
// wishlist and header counters read (cached; see src/lib/server/products.ts).
// Used by the (shop) layout and the 404 page; the admin area has its own layout.
export default async function ShopChrome({ children }: { children: ReactNode }) {
  const catalog = await getCatalog();
  return (
    <CatalogProvider products={catalog}>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer products={catalog} />
    </CatalogProvider>
  );
}
