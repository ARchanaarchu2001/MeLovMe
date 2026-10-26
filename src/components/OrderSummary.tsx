import { useTranslations } from "next-intl";
import { formatPrice } from "@/lib/format";

export default function OrderSummary({
  subtotal,
  shipping,
  total,
}: {
  subtotal: number;
  shipping: number;
  total: number;
}) {
  const t = useTranslations("cart.summary");
  return (
    <dl className="space-y-3 text-sm">
      <div className="flex justify-between">
        <dt className="text-chocolate/70">{t("subtotal")}</dt>
        <dd>{formatPrice(subtotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-chocolate/70">{t("shipping")}</dt>
        <dd>{shipping ? formatPrice(shipping) : t("free")}</dd>
      </div>
      <div className="flex justify-between border-t border-chocolate/15 pt-4 text-lg font-medium">
        <dt>{t("total")}</dt>
        <dd className="text-gold">{formatPrice(total)}</dd>
      </div>
    </dl>
  );
}
