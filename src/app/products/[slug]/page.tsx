import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductGallery from "@/components/ProductGallery";
import ProductCard from "@/components/ProductCard";
import Reveal from "@/components/Reveal";
import { Icon } from "@/components/Icons";
import { getProduct, products } from "@/data/products";
import { site } from "@/data/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  return product ? { title: product.name, description: product.shortDescription } : {};
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const others = products.filter((p) => p.slug !== product.slug);
  const enquiry = `mailto:${site.email}?subject=${encodeURIComponent(`Enquiry: ${product.name}`)}`;

  return (
    <>
      <section className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
        <nav className="mb-8 text-xs uppercase tracking-[0.2em] text-chocolate/50">
          <Link href="/" className="hover:text-gold">Home</Link> /{" "}
          <Link href="/products/" className="hover:text-gold">Products</Link> /{" "}
          <span className="text-chocolate">{product.name}</span>
        </nav>

        <div className="grid gap-12 md:grid-cols-2 md:gap-16">
          <div className="animate-zoom-in">
            <ProductGallery images={product.images} name={product.name} />
          </div>

          <div className="animate-fade-up md:py-6" style={{ animationDelay: "200ms" }}>
            <p className="eyebrow">{product.category}</p>
            <h1 className="mt-4 text-4xl font-light md:text-5xl">{product.name}</h1>
            <div className="mt-4 flex items-center gap-4">
              <span className="text-2xl font-medium text-gold">{product.price}</span>
              <span className="h-4 w-px bg-chocolate/20" />
              <span className="text-sm text-chocolate/60">{product.size}</span>
            </div>
            <p className="mt-8 leading-relaxed text-chocolate/80">{product.description}</p>

            <ul className="mt-8 space-y-3">
              {product.highlights.map((h) => (
                <li key={h} className="flex items-start gap-3 text-sm">
                  <Icon name="drop" className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  {h}
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-wrap gap-4">
              <a href={enquiry} className="btn btn-primary">Enquire Now</a>
              <a href={site.social.whatsapp} target="_blank" rel="noreferrer" className="btn btn-outline">
                WhatsApp Us
              </a>
            </div>

            <div className="mt-12 divide-y divide-chocolate/10 border-y border-chocolate/10">
              <details className="group py-5" open>
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm uppercase tracking-[0.2em]">
                  Key Ingredients <span className="text-gold transition group-open:rotate-45">+</span>
                </summary>
                <div className="mt-4 flex flex-wrap gap-2">
                  {product.ingredients.map((i) => (
                    <span key={i} className="rounded-full bg-ivory px-4 py-1.5 text-xs">{i}</span>
                  ))}
                </div>
              </details>
              <details className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm uppercase tracking-[0.2em]">
                  How to Use <span className="text-gold transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-chocolate/75">{product.howToUse}</p>
              </details>
            </div>
          </div>
        </div>
      </section>

      {others.length > 0 && (
        <section className="bg-ivory">
          <div className="mx-auto max-w-7xl px-5 py-20 md:px-8">
            <Reveal>
              <h2 className="text-3xl font-light">You may also love</h2>
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
