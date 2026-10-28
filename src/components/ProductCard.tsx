import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import CartButton from "./CartButton";
import { OfferBadge, OfferTimer } from "./OfferSticker";
import Price from "./Price";
import WishlistButton from "./WishlistButton";
import { activeCombos, type Product } from "@/lib/product";

export default function ProductCard({ product }: { product: Product }) {
  const t = useTranslations("products.card");
  const tc = useTranslations("products.combo");
  const href = `/products/${product.slug}/`;

  return (
    // Wrapper so the wishlist and cart buttons can sit next to the link without being nested inside it
    <div className="relative">
      <WishlistButton slug={product.slug} className="absolute right-5 top-5 z-10" />
      <Link href={href} className="group block">
        <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-ivory">
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            sizes="(min-width: 768px) 45vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute left-5 top-5">
            <OfferBadge product={product} />
          </div>
          {product.inStock ? (
            <OfferTimer product={product} className="absolute inset-x-4 bottom-4" />
          ) : (
            <span className="absolute inset-x-4 bottom-4 rounded-full bg-chocolate/85 py-2.5 text-center text-[0.65rem] uppercase leading-none tracking-[0.2em] text-ivory">
              {t("outOfStock")}
            </span>
          )}
        </div>
        <p className="mt-5 text-[0.65rem] uppercase tracking-[0.2em] text-chocolate/60">{product.category}</p>
        <h3 className="mt-1.5 text-xl font-medium group-hover:text-gold">
          {product.name} <span className="text-base font-normal text-chocolate/60">· {product.size}</span>
        </h3>
        <Price product={product} savings className="mt-2 text-lg" />
        {activeCombos(product).length > 0 && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-[0.65rem] font-medium uppercase tracking-[0.15em] text-chocolate">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
            {tc("cardLabel")}
          </p>
        )}
        <p className="mt-3 text-sm leading-relaxed text-chocolate/75">{product.shortDescription}</p>
      </Link>
      <div className="mt-6 flex items-center justify-between gap-4">
        <CartButton slug={product.slug} compact />
        <Link
          href={href}
          className="border-b border-chocolate pb-1 text-xs uppercase tracking-[0.25em] transition-colors hover:border-gold hover:text-gold"
        >
          {t("viewDetails")}
        </Link>
      </div>
    </div>
  );
}
