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
  return (
    <dl className="space-y-3 text-sm">
      <div className="flex justify-between">
        <dt className="text-chocolate/70">Subtotal</dt>
        <dd>{formatPrice(subtotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-chocolate/70">Shipping</dt>
        <dd>{shipping ? formatPrice(shipping) : "Free"}</dd>
      </div>
      <div className="flex justify-between border-t border-chocolate/15 pt-4 text-lg font-medium">
        <dt>Total</dt>
        <dd className="text-gold">{formatPrice(total)}</dd>
      </div>
    </dl>
  );
}
