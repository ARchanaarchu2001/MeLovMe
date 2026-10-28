import { useFormatter, useTranslations } from "next-intl";
import { formatPrice } from "@/lib/format";
import { offerDaysLeft, offerStatus, type Product } from "@/lib/product";

// The gold "20% OFF" sticker on a product photo, while an offer runs. With an end date it also
// says how long is left ("2 days left", "Last day").
export default function OfferSticker({ product, large = false }: { product: Pick<Product, "offer">; large?: boolean }) {
  const t = useTranslations("products.offer");
  const offer = product.offer;
  if (!offer || offerStatus(offer) !== "active") return null;
  const days = offerDaysLeft(offer);
  const urgent = days !== null && days <= 1;

  // Two-part pill: espresso half with the gold discount, cream half with the countdown
  return (
    <span
      className={`inline-flex items-stretch overflow-hidden rounded-full uppercase leading-none shadow-lg shadow-espresso/20 ring-1 ring-gold/50 ${
        large ? "text-sm" : "text-[0.7rem]"
      }`}
    >
      <span className={`flex items-center bg-espresso/90 font-semibold tracking-[0.14em] backdrop-blur ${large ? "px-5 py-2.5" : "px-3.5 py-2"}`}>
        <span className="text-shimmer">
          {offer.type === "percent" ? t("stickerPercent", { value: offer.value }) : t("stickerFlat", { amount: formatPrice(offer.value) })}
        </span>
      </span>
      {days !== null && (
        <span
          className={`flex items-center gap-1.5 bg-cream/90 font-medium tracking-[0.15em] text-espresso backdrop-blur ${
            large ? "px-4 text-[0.7rem]" : "px-3 text-[0.6rem]"
          }`}
        >
          <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
            {urgent && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />}
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold" />
          </span>
          {days === 0 ? t("lastDay") : t("daysLeft", { days })}
        </span>
      )}
    </span>
  );
}

// Compact "₹200 OFF" badge for the corner of a product card photo
export function OfferBadge({ product }: { product: Pick<Product, "offer"> }) {
  const t = useTranslations("products.offer");
  const offer = product.offer;
  if (!offer || offerStatus(offer) !== "active") return null;

  return (
    <span className="inline-flex items-center rounded-full bg-espresso/90 px-3.5 py-2 text-[0.7rem] font-semibold uppercase leading-none tracking-[0.14em] shadow-lg shadow-espresso/20 ring-1 ring-gold/50 backdrop-blur">
      <span className="text-shimmer">
        {offer.type === "percent" ? t("stickerPercent", { value: offer.value }) : t("stickerFlat", { amount: formatPrice(offer.value) })}
      </span>
    </span>
  );
}

// Full-width "• Last day" strip along the bottom of a product card photo, when the offer has an end date
export function OfferTimer({ product, className = "" }: { product: Pick<Product, "offer">; className?: string }) {
  const t = useTranslations("products.offer");
  const offer = product.offer;
  if (!offer || offerStatus(offer) !== "active") return null;
  const days = offerDaysLeft(offer);
  if (days === null) return null;

  return (
    <span
      className={`flex items-center justify-center gap-2 rounded-full bg-cream/90 py-2.5 text-[0.65rem] font-medium uppercase leading-none tracking-[0.18em] text-espresso shadow-sm shadow-espresso/10 backdrop-blur ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
        {days <= 1 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold" />
      </span>
      {days === 0 ? t("lastDay") : t("daysLeft", { days })}
    </span>
  );
}

// "Offer ends in 2 days · Valid till 28 Oct 2026" under the price on the product page
export function OfferCountdown({ product }: { product: Pick<Product, "offer"> }) {
  const t = useTranslations("products.offer");
  const format = useFormatter();
  const offer = product.offer;
  if (!offer || offerStatus(offer) !== "active") return null;
  const days = offerDaysLeft(offer);
  const headline =
    days === null ? t("limited") : days === 0 ? t("endsToday") : days === 1 ? t("endsTomorrow") : t("endsIn", { days });

  return (
    <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-gold/40 bg-gold/15 px-5 py-3 text-sm">
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gold" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      <strong className="font-medium">{headline}</strong>
      {offer.endsAt && (
        <span className="text-chocolate/70">
          {t("validTill", { date: format.dateTime(new Date(offer.endsAt), { day: "numeric", month: "short", year: "numeric" }) })}
        </span>
      )}
    </p>
  );
}
