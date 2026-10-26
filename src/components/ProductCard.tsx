import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import CartButton from "./CartButton";
import Price from "./Price";
import WishlistButton from "./WishlistButton";
import type { Product } from "@/lib/product";

export default function ProductCard({ product }: { product: Product }) {
  const t = useTranslations("products.card");
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
          <span className="absolute left-5 top-5 rounded-full bg-cream/90 px-4 py-1.5 text-[0.65rem] uppercase tracking-[0.2em]">
            {product.category}
          </span>
        </div>
        <div className="mt-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-medium group-hover:text-gold">{product.name}</h3>
            <p className="mt-1 text-sm text-chocolate/60">{product.size}</p>
          </div>
          <Price product={product} className="justify-end text-lg" />
        </div>
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
