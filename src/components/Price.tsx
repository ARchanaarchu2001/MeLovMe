import { useTranslations } from "next-intl";
import { formatPrice } from "@/lib/format";
import { priceOf, type Product } from "@/lib/product";

// Price with the offer shown when one is running: "₹719 ₹899 20% OFF"
export default function Price({
  product,
  className = "",
  showBadge = true,
}: {
  product: Pick<Product, "price" | "offer">;
  className?: string;
  showBadge?: boolean;
}) {
  const t = useTranslations("products.price");
  const { price, mrp, off } = priceOf(product);
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 gap-y-1 ${className}`}>
      <span className="font-medium text-gold">{formatPrice(price)}</span>
      {off > 0 && (
        <>
          <s className="text-[0.85em] text-chocolate/50" aria-label={t("regular", { price: formatPrice(mrp) })}>
            {formatPrice(mrp)}
          </s>
          {showBadge && (
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-chocolate">
              {t("off", { percent: off })}
            </span>
          )}
        </>
      )}
    </span>
  );
}
