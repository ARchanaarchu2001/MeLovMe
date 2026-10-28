import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductGallery from "@/components/ProductGallery";
import AddToCart from "@/components/AddToCart";
import ProductCard from "@/components/ProductCard";
import Reveal from "@/components/Reveal";
import WishlistButton from "@/components/WishlistButton";
import { Icon } from "@/components/Icons";
import OfferSticker, { OfferCountdown } from "@/components/OfferSticker";
import Price from "@/components/Price";
import ProductReviews from "@/components/ProductReviews";
import Stars from "@/components/Stars";
import { getCatalog, getCatalogProduct } from "@/lib/server/products";
import { getProductReviews } from "@/lib/server/reviews";

// Pages for current products are built ahead; products added later render on first visit
export async function generateStaticParams() {
  return (await getCatalog()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCatalogProduct(slug);
  return product ? { title: product.name, description: product.shortDescription } : {};
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getCatalogProduct(slug);
  // Unknown and disabled products both 404
  if (!product) notFound();
  const t = await getTranslations("products.detail");
  const tr = await getTranslations("products.reviews");
  const { summary, reviews } = await getProductReviews(product.slug);

  const others = (await getCatalog()).filter((p) => p.slug !== product.slug);

  return (
    <>
      <section className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
        <nav className="mb-8 text-xs uppercase tracking-[0.2em] text-chocolate/50">
          <Link href="/" className="hover:text-gold">{t("breadcrumbHome")}</Link> /{" "}
          <Link href="/products/" className="hover:text-gold">{t("breadcrumbProducts")}</Link> /{" "}
          <span className="text-chocolate">{product.name}</span>
        </nav>

        <div className="grid gap-12 md:grid-cols-2 md:gap-16">
          <div className="relative animate-zoom-in">
            <ProductGallery images={product.images} name={product.name} />
            <WishlistButton slug={product.slug} className="absolute right-5 top-5 z-10" />
            <div className="pointer-events-none absolute left-5 top-5 z-10">
              <OfferSticker product={product} large />
            </div>
          </div>

          <div className="animate-fade-up md:py-6" style={{ animationDelay: "200ms" }}>
            <p className="eyebrow">{product.category}</p>
            <h1 className="mt-4 text-4xl font-light md:text-5xl">{product.name}</h1>
            {summary.count > 0 && (
              <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-sm text-chocolate/70 hover:text-gold">
                <Stars rating={summary.average} label={tr("outOf5", { rating: summary.average })} />
                <span>
                  {summary.average.toFixed(1)} · {tr("count", { count: summary.count })}
                </span>
              </a>
            )}
            <div className="mt-4 flex items-center gap-4">
              <Price product={product} className="text-2xl" />
              <span className="h-4 w-px bg-chocolate/20" />
              <span className="text-sm text-chocolate/60">{product.size}</span>
            </div>
            <OfferCountdown product={product} />
            <p className="mt-8 leading-relaxed text-chocolate/80">{product.description}</p>

            <ul className="mt-8 space-y-3">
              {product.highlights.map((h) => (
                <li key={h} className="flex items-start gap-3 text-sm">
                  <Icon name="drop" className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  {h}
                </li>
              ))}
            </ul>

            <AddToCart slug={product.slug} inStock={product.inStock} stock={product.stock} />

            <div className="mt-12 divide-y divide-chocolate/10 border-y border-chocolate/10">
              <details className="group py-5" open>
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm uppercase tracking-[0.2em]">
                  {t("keyIngredients")} <span className="text-gold transition group-open:rotate-45">+</span>
                </summary>
                <div className="mt-4 flex flex-wrap gap-2">
                  {product.ingredients.map((i) => (
                    <span key={i} className="rounded-full bg-ivory px-4 py-1.5 text-xs">{i}</span>
                  ))}
                </div>
              </details>
              <details className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm uppercase tracking-[0.2em]">
                  {t("howToUse")} <span className="text-gold transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-chocolate/75">{product.howToUse}</p>
              </details>
            </div>
          </div>
        </div>
      </section>

      <ProductReviews slug={product.slug} summary={summary} reviews={reviews} />

      {others.length > 0 && (
        <section className="bg-ivory">
          <div className="mx-auto max-w-7xl px-5 py-20 md:px-8">
            <Reveal>
              <h2 className="text-3xl font-light">{t("youMayAlsoLove")}</h2>
            </Reveal>
            <div className="mt-10 grid gap-14 md:grid-cols-2">
              {others.map((p, i) => (
                <Reveal key={p.slug} delay={i * 150}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
