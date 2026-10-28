import type { ReactNode } from "react";
import AnnouncementBar from "./AnnouncementBar";
import { CatalogProvider } from "./CatalogProvider";
import CartToast from "./CartToast";
import Footer from "./Footer";
import Header from "./Header";
import { getAnnouncement } from "@/lib/server/announcement";
import { getCatalog } from "@/lib/server/products";

// The shop's announcement bar, header and footer around a page, plus the product catalogue that the cart,
// wishlist and header counters read (cached; see src/lib/server/products.ts).
// Used by the (shop) layout and the 404 page; the admin area has its own layout.
export default async function ShopChrome({ children }: { children: ReactNode }) {
  const [catalog, announcement] = await Promise.all([getCatalog(), getAnnouncement()]);
  return (
    <CatalogProvider products={catalog}>
      <AnnouncementBar announcement={announcement} />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer products={catalog} />
      <CartToast />
    </CatalogProvider>
  );
}
