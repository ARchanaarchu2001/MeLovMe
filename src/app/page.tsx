import Image from "next/image";
import Link from "next/link";
import Logo from "@/components/Logo";
import ProductCard from "@/components/ProductCard";
import Reveal from "@/components/Reveal";
import { Icon, LeafArt } from "@/components/Icons";
import { products } from "@/data/products";
import { testimonials, values } from "@/data/site";

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-chocolate text-ivory">
        <LeafArt className="animate-sway pointer-events-none absolute -left-10 bottom-0 h-[420px] w-auto text-gold/25" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 md:grid-cols-2 md:px-8 md:py-28">
          <div className="relative z-10">
            <p className="eyebrow animate-fade-up">Premium Body Care</p>
            <h1
              className="animate-fade-up mt-6 text-4xl font-light leading-tight md:text-6xl"
              style={{ animationDelay: "150ms" }}
            >
              More than <br />
              just a <span className="text-shimmer font-medium">scent.</span>
            </h1>
            <p
              className="animate-fade-up mt-6 max-w-md text-base leading-relaxed text-ivory/75"
              style={{ animationDelay: "300ms" }}
            >
              Rituals of self-love, crafted to nourish your skin and linger like a memory. Discover care that
              becomes your signature.
            </p>
            <div className="animate-fade-up mt-10 flex flex-wrap gap-4" style={{ animationDelay: "450ms" }}>
              <Link href="/products/" className="btn btn-gold">
                Explore Products
              </Link>
              <Link href="/about/" className="btn btn-outline text-ivory hover:!border-ivory hover:!bg-ivory hover:!text-chocolate">
                Our Story
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="animate-zoom-in relative aspect-square overflow-hidden rounded-[2.5rem] shadow-2xl shadow-black/30">
              <Image
                src="/images/body-lotion-box.webp"
                alt="MELOVME Signature Body Lotion with gift box"
                fill
                priority
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="animate-fade-up absolute -bottom-6 -left-6 hidden md:block" style={{ animationDelay: "700ms" }}>
              <div className="animate-float rounded-3xl bg-ivory px-6 py-5 text-chocolate shadow-xl">
                <p className="text-3xl font-medium">24h</p>
                <p className="text-xs uppercase tracking-[0.2em] text-chocolate/70">Lasting hydration</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Brand intro */}
      <section className="mx-auto max-w-4xl px-5 py-24 text-center md:px-8">
        <Reveal>
          <Logo size="lg" className="text-chocolate" />
        </Reveal>
        <Reveal delay={150}>
          <p className="mx-auto mt-10 max-w-2xl text-lg leading-relaxed text-chocolate/80">
            MELOVME is born from a simple belief — <em className="text-gold not-italic">caring for yourself is an act of love.</em>{" "}
            Every product blends nature&apos;s finest ingredients with a touch of luxury, so your daily ritual feels
            personal, soft and unmistakably you.
          </p>
        </Reveal>
      </section>

      {/* Values */}
      <section className="bg-ivory">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
          {values.map((v, i) => (
            <Reveal key={v.title} delay={i * 120} className="group text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/60 text-gold transition-all duration-500 group-hover:-translate-y-1 group-hover:rotate-12 group-hover:bg-gold group-hover:text-espresso">
                <Icon name={v.icon} className="h-7 w-7" />
              </div>
              <h3 className="mt-5 text-lg font-medium">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-chocolate/70">{v.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Products */}
      <section className="mx-auto max-w-7xl px-5 py-24 md:px-8">
        <Reveal className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="eyebrow">The Collection</p>
            <h2 className="mt-4 text-3xl font-light md:text-5xl">Our signature essentials</h2>
          </div>
          <Link href="/products/" className="btn btn-outline">
            View All
          </Link>
        </Reveal>
        <div className="mt-14 grid gap-14 md:grid-cols-2">
          {products.map((p, i) => (
            <Reveal key={p.slug} delay={i * 150}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Feature banner */}
      <section className="overflow-hidden bg-espresso text-ivory">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 md:grid-cols-2 md:px-8">
          <Reveal>
            <div className="group relative aspect-[4/3] overflow-hidden rounded-[2rem]">
              <Image
                src="/images/gift-set.webp"
                alt="MELOVME gift box, velvet pouch and message card"
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover transition-transform duration-1000 group-hover:scale-105"
              />
            </div>
          </Reveal>
          <Reveal delay={200}>
            <p className="eyebrow">The Art of Gifting</p>
            <h2 className="mt-4 text-3xl font-light leading-snug md:text-4xl">
              Wrapped in chocolate, <br /> finished in <span className="text-shimmer">gold.</span>
            </h2>
            <p className="mt-6 max-w-md leading-relaxed text-ivory/70">
              Every MELOVME gift arrives in a textured keepsake box with botanical gold-foil detailing, a soft
              velvet pouch and a personal message card — ready to make someone feel loved.
            </p>
            <Link href="/products/signature-gift-set/" className="btn btn-gold mt-10">
              Discover the Gift Set
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-7xl px-5 py-24 md:px-8">
        <Reveal className="text-center">
          <p className="eyebrow">Kind Words</p>
          <h2 className="mt-4 text-3xl font-light md:text-5xl">Loved by our community</h2>
        </Reveal>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 150} className="h-full">
              <figure className="h-full rounded-[2rem] bg-ivory p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-chocolate/10">
                <Icon name="sparkle" className="h-6 w-6 text-gold" />
                <blockquote className="mt-5 leading-relaxed text-chocolate/80">“{t.quote}”</blockquote>
                <figcaption className="mt-6 text-sm">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-chocolate/50"> · {t.place}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-24 md:px-8">
        <Reveal className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-chocolate px-8 py-16 text-center text-ivory md:py-20">
          <LeafArt className="animate-sway pointer-events-none absolute -right-6 -top-10 h-80 w-auto rotate-12 text-gold/20" />
          <h2 className="relative text-3xl font-light md:text-4xl">Partner with MELOVME</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-ivory/70">
            Retailers, salons and corporate gifting partners — let&apos;s create something beautiful together.
          </p>
          <Link href="/contact/" className="btn btn-gold relative mt-8">
            Get in Touch
          </Link>
        </Reveal>
      </section>
    </>
  );
}
