import { useTranslations } from "next-intl";
import Link from "next/link";
import ShopChrome from "@/components/ShopChrome";

// Shown for unknown URLs and whenever a page calls notFound() (including the admin area for
// non-admins), so it brings its own shop header and footer
export default function NotFound() {
  const t = useTranslations("common.notFound");
  return (
    <ShopChrome>
      <section className="mx-auto max-w-xl px-5 py-32 text-center">
        <p className="eyebrow">404</p>
        <h1 className="mt-4 text-4xl font-light">{t("title")}</h1>
        <p className="mt-4 text-chocolate/70">{t("text")}</p>
        <Link href="/" className="btn btn-primary mt-10">{t("backHome")}</Link>
      </section>
    </ShopChrome>
  );
}
