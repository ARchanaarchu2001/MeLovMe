import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/data/products";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/products/${product.slug}/`} className="group block">
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
          <h3 className="text-xl font-medium">{product.name}</h3>
          <p className="mt-1 text-sm text-chocolate/60">{product.size}</p>
        </div>
        <p className="text-lg font-medium text-gold">{product.price}</p>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-chocolate/75">{product.shortDescription}</p>
      <span className="mt-5 inline-block border-b border-chocolate pb-1 text-xs uppercase tracking-[0.25em] transition-colors group-hover:border-gold group-hover:text-gold">
        View Details
      </span>
    </Link>
  );
}
