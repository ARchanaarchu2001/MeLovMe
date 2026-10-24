import ShopChrome from "@/components/ShopChrome";

// Product pages are cached; rebuild them at least every 5 minutes so offers start and end on time
export const revalidate = 300;

// Every customer-facing page: the shop header, footer and product catalogue
export default function ShopLayout({ children }: LayoutProps<"/">) {
  return <ShopChrome>{children}</ShopChrome>;
}
