import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import HeroBanner from "@/components/HeroBanner";
import Logo from "@/components/Logo";
import ProductCard from "@/components/ProductCard";
import Reveal from "@/components/Reveal";
import Testimonials from "@/components/Testimonials";
import { Icon, LeafArt } from "@/components/Icons";
import { getBanner } from "@/lib/server/banner";
import { getCatalog } from "@/lib/server/products";
import { getTestimonials } from "@/lib/server/testimonials";
import { values } from "@/data/site";

export default async function Home() {
  const [products, banner, community] = await Promise.all([getCatalog(), getBanner(), getTestimonials()]);
  const t = await getTranslations("home");
  const tc = await getTranslations("common");

  return (
    <>
      {/* Hero: the banner picture uploaded in the admin area, or the built-in one */}
      {banner.enabled && banner.image ? (
        <HeroBanner
          banner={{ ...banner, image: banner.image }}
          labels={{ heading: t("hero.eyebrow"), explore: t("hero.explore"), ourStory: t("hero.ourStory") }}
        />
      ) : (
        <section className="relative overflow-hidden bg-chocolate text-ivory">
          <LeafArt className="animate-sway pointer-events-none absolute -left-10 bottom-0 h-[420px] w-auto text-gold/25" />
          <div className="mx-auto grid max-w-7xl items-center gap-8 md:gap-12 px-5 py-12 md:grid-cols-2 md:px-8 md:py-28">
            <div className="relative z-10">
              <p className="eyebrow animate-fade-up">{t("hero.eyebrow")}</p>
              <h1
                className="animate-fade-up mt-6 text-4xl font-light leading-tight md:text-6xl"
                style={{ animationDelay: "150ms" }}
              >
                {t.rich("hero.title", {
                  br: () => <br />,
                  shimmer: (chunks) => <span className="text-shimmer font-medium">{chunks}</span>,
                })}
              </h1>
              <p
                className="animate-fade-up mt-6 max-w-md text-base leading-relaxed text-ivory/75"
                style={{ animationDelay: "300ms" }}
              >
                {t("hero.text")}
              </p>
              <div className="animate-fade-up mt-6 md:mt-10 flex flex-wrap gap-4" style={{ animationDelay: "450ms" }}>
                <Link href="/products/" className="btn btn-gold">
                  {t("hero.explore")}
                </Link>
                <Link href="/about/" className="btn btn-outline text-ivory hover:!border-ivory hover:!bg-ivory hover:!text-chocolate">
                  {t("hero.ourStory")}
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="animate-zoom-in relative aspect-[4/3] overflow-hidden md:aspect-square rounded-[2.5rem] shadow-2xl shadow-black/30">
                <Image
                  src="/images/body-lotion-box.webp"
                  alt={t("hero.imageAlt")}
                  fill
                  priority
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="animate-fade-up absolute -bottom-6 -left-6 hidden md:block" style={{ animationDelay: "700ms" }}>
                <div className="animate-float rounded-3xl bg-ivory px-6 py-5 text-chocolate shadow-xl">
                  <p className="text-3xl font-medium">{t("hero.statValue")}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-chocolate/70">{t("hero.statLabel")}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Brand intro */}
      <section className="mx-auto max-w-4xl px-5 py-12 md:py-24 text-center md:px-8">
        <Reveal>
          <Logo size="lg" className="text-chocolate" />
        </Reveal>
        <Reveal delay={150}>
          <p className="mx-auto mt-6 md:mt-10 max-w-2xl text-lg leading-relaxed text-chocolate/80">
            {t.rich("intro.text", {
              em: (chunks) => <em className="text-gold not-italic">{chunks}</em>,
            })}
          </p>
        </Reveal>
      </section>

      {/* Values */}
      <section className="bg-ivory">
        <div className="mx-auto grid max-w-7xl gap-6 md:gap-10 px-5 py-12 md:py-20 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
          {values.map((v, i) => (
            <Reveal key={v.key} delay={i * 120} className="group text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/60 text-gold transition-all duration-500 group-hover:-translate-y-1 group-hover:rotate-12 group-hover:bg-gold group-hover:text-espresso">
                <Icon name={v.icon} className="h-7 w-7" />
              </div>
              <h3 className="mt-5 text-lg font-medium">{tc(`values.${v.key}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-chocolate/70">{tc(`values.${v.key}.text`)}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Products */}
      <section className="mx-auto max-w-7xl px-5 py-12 md:py-24 md:px-8">
        <Reveal className="flex items-end justify-between gap-4 md:gap-6">
          <div>
            <p className="eyebrow">{t("collection.eyebrow")}</p>
            <h2 className="mt-3 text-2xl font-light sm:text-3xl md:mt-4 md:text-5xl">{t("collection.title")}</h2>
          </div>
          <Link href="/products/" className="btn btn-outline min-h-0 shrink-0 whitespace-nowrap !px-4 !py-2 !text-[0.65rem] md:min-h-11 md:!px-7 md:!py-3 md:!text-xs">
            {t("collection.viewAll")}
          </Link>
        </Reveal>
        <div className="mt-8 md:mt-14 grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 md:gap-x-8 md:gap-y-12">
          {products.map((p, i) => (
            <Reveal key={p.slug} delay={i * 150}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Feature banner */}
      <section className="overflow-hidden bg-espresso text-ivory">
        <div className="mx-auto grid max-w-7xl items-center gap-8 md:gap-12 px-5 py-12 md:py-20 md:grid-cols-2 md:px-8">
          <Reveal>
            <div className="group relative aspect-[4/3] overflow-hidden rounded-[2rem]">
              <Image
                src="/images/gift-set.webp"
                alt={t("gifting.imageAlt")}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover transition-transform duration-1000 group-hover:scale-105"
              />
            </div>
          </Reveal>
          <Reveal delay={200}>
            <p className="eyebrow">{t("gifting.eyebrow")}</p>
            <h2 className="mt-4 text-3xl font-light leading-snug md:text-4xl">
              {t.rich("gifting.title", {
                br: () => <br />,
                shimmer: (chunks) => <span className="text-shimmer">{chunks}</span>,
              })}
            </h2>
            <p className="mt-6 max-w-md leading-relaxed text-ivory/70">
              {t("gifting.text")}
            </p>
            <Link href="/products/signature-gift-set/" className="btn btn-gold mt-6 md:mt-10">
              {t("gifting.cta")}
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Testimonials (set up in the admin area) */}
      {community.enabled && community.items.length > 0 && (
        <Testimonials data={community} eyebrow={t("testimonialsSection.eyebrow")} title={t("testimonialsSection.title")} />
      )}

      {/* CTA */}
      <section className="px-5 pb-12 md:pb-24 md:px-8">
        <Reveal className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-chocolate px-8 py-10 text-center text-ivory md:py-20">
          <LeafArt className="animate-sway pointer-events-none absolute -right-6 -top-10 h-80 w-auto rotate-12 text-gold/20" />
          <h2 className="relative text-3xl font-light md:text-4xl">{t("partner.title")}</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-ivory/70">
            {t("partner.text")}
          </p>
          <Link href="/contact/" className="btn btn-gold relative mt-6 md:mt-8">
            {t("partner.cta")}
          </Link>
        </Reveal>
      </section>
    </>
  );
}
