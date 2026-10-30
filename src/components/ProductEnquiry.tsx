import { useTranslations } from "next-intl";
import { WhatsAppIcon } from "./Icons";
import { siteUrl, whatsappUrl } from "@/data/site";
import type { Product } from "@/lib/product";

// "Enquire on WhatsApp" for one product: opens a chat with the shop with the product's name, size
// and short link (/p/<slug>/, which WhatsApp turns into a preview with the photo) typed in.
// `compact` is the round icon button on product cards; the product page gets the full button.
export default function ProductEnquiry({ product, compact = false }: { product: Pick<Product, "slug" | "name" | "size">; compact?: boolean }) {
  const t = useTranslations("products.enquiry");
  const href = whatsappUrl(t("message", { name: product.name, size: product.size, link: `${siteUrl()}/p/${product.slug}/` }));

  if (compact) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={t("label", { name: product.name })}
        title={t("button")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25d366]/15 text-[#128c7e] transition-colors hover:bg-[#25d366] hover:text-white @xs:h-11 @xs:w-11"
      >
        <WhatsAppIcon className="h-4 w-4 @xs:h-5 @xs:w-5" />
      </a>
    );
  }

  return (
    <div className="mt-3 w-full max-w-md">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="btn h-11 w-full justify-center gap-2 border border-[#25d366] !px-4 !tracking-[0.15em] text-[#128c7e] hover:bg-[#25d366] hover:text-white"
      >
        <WhatsAppIcon />
        {t("button")}
      </a>
      <p className="mt-2 text-center text-xs text-chocolate/60">{t("note")}</p>
    </div>
  );
}
