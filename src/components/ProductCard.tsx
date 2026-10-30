import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import CartButton from "./CartButton";
import { OfferBadge, OfferTimer } from "./OfferSticker";
import Price from "./Price";
import ProductEnquiry from "./ProductEnquiry";
import WishlistButton from "./WishlistButton";
import { activeCombos, type Product } from "@/lib/product";

export default function ProductCard({ product }: { product: Product }) {
  const t = useTranslations("products.card");
  const tc = useTranslations("products.combo");
  const href = `/products/${product.slug}/`;

  return (
    // Wrapper so the wishlist and cart buttons can sit next to the link without being nested inside it.
    // It's a size container: the card shrinks its text and spacing when the grid makes it narrow (2–4 per row).
    // Full height of its grid row, with the buttons pushed to the bottom so they line up across the row.
    <div className="@container relative flex h-full flex-col">
      <WishlistButton
        slug={product.slug}
        className="absolute right-2 top-2 z-10 !h-8 !w-8 @xs:right-3 @xs:top-3 @xs:!h-10 @xs:!w-10 [&_svg]:!h-4 [&_svg]:!w-4"
      />
      <Link href={href} className="group block">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-ivory @xs:rounded-3xl">
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            sizes="(min-width: 768px) 33vw, 50vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute left-2 top-2 origin-top-left scale-[0.85] @xs:left-3 @xs:top-3 @xs:scale-100">
            <OfferBadge product={product} />
          </div>
          {product.inStock ? (
            <OfferTimer product={product} className="absolute inset-x-2 bottom-2 !py-2 !tracking-[0.12em] @xs:inset-x-3 @xs:bottom-3" />
          ) : (
            <span className="absolute inset-x-2 bottom-2 rounded-full bg-chocolate/85 py-2 text-center text-[0.6rem] uppercase leading-none tracking-[0.15em] text-ivory @xs:inset-x-3 @xs:bottom-3">
              {t("outOfStock")}
            </span>
          )}
        </div>
        <p className="mt-3 truncate text-[0.6rem] uppercase tracking-[0.18em] text-chocolate/60">{product.category}</p>
        <h3 className="mt-1 text-sm font-medium leading-snug group-hover:text-gold @xs:text-base @sm:text-lg">
          {product.name} <span className="text-xs font-normal text-chocolate/60 @xs:text-sm">· {product.size}</span>
        </h3>
        <Price product={product} savings className="mt-1 text-sm @xs:text-base" />
        {activeCombos(product).length > 0 && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-1 text-[0.55rem] font-medium uppercase tracking-[0.12em] text-chocolate @xs:text-[0.6rem]">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
            {tc("cardLabel")}
          </p>
        )}
        <p className="mt-2 hidden text-sm leading-relaxed text-chocolate/75 @sm:line-clamp-2">{product.shortDescription}</p>
      </Link>
      <div className="mt-auto flex items-center justify-between gap-3 pt-3 @xs:pt-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 @xs:flex-none [&>div]:min-w-0 [&>div]:flex-1 [&>div>button]:h-9 [&>div>button]:w-8 [&>div>span]:w-6 @xs:[&>div]:flex-none @xs:[&>div>button]:h-10 @xs:[&>div>button]:w-10 @xs:[&>div>span]:w-8">
          <CartButton slug={product.slug} compact />
          <ProductEnquiry product={product} compact />
        </div>
        <Link
          href={href}
          className="hidden border-b border-chocolate pb-1 text-[0.65rem] uppercase tracking-[0.2em] transition-colors hover:border-gold hover:text-gold @xs:inline"
        >
          {t("viewDetails")}
        </Link>
      </div>
    </div>
  );
}
