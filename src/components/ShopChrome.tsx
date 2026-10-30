import type { ReactNode } from "react";
import AnnouncementBar from "./AnnouncementBar";
import { CatalogProvider } from "./CatalogProvider";
import CartDrawer from "./CartDrawer";
import CartToast from "./CartToast";
import Footer from "./Footer";
import Header from "./Header";
import { getAnnouncement } from "@/lib/server/announcement";
import { getPaymentSettings } from "@/lib/server/payments";
import { canBuy } from "@/lib/payments";
import { childrenOf, productCounts } from "@/lib/category";
import { getCatalog, getCategories } from "@/lib/server/products";

// The shop's announcement bar, header and footer around a page, plus the product catalogue that the cart,
// wishlist and header counters read (cached; see src/lib/server/products.ts).
// Used by the (shop) layout and the 404 page; the admin area has its own layout.
export default async function ShopChrome({ children }: { children: ReactNode }) {
  const [catalog, announcement, categories, payments] = await Promise.all([getCatalog(), getAnnouncement(), getCategories(), getPaymentSettings()]);
  // Main categories with something in the shop, for the footer
  const counts = productCounts(categories, catalog);
  const mainCategories = childrenOf(categories, null).filter((c) => (counts.get(c.id)?.total ?? 0) > 0);
  const buying = canBuy(payments);
  return (
    <CatalogProvider products={catalog} canBuy={buying}>
      <AnnouncementBar announcement={announcement} />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer categories={mainCategories} />
      {buying && (
        <>
          <CartDrawer razorpay={payments.razorpay} />
          <CartToast />
        </>
      )}
    </CatalogProvider>
  );
}
