import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import Logo from "@/components/Logo";
import Reveal from "@/components/Reveal";
import { Icon, LeafArt } from "@/components/Icons";
import { values } from "@/data/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about.meta");
  return { title: t("title"), description: t("description") };
}

// Year and text of each are in about.journey.milestones
const milestones = ["idea", "formulation", "launch", "next"] as const;

export default function AboutPage() {
  const t = useTranslations("about");
  const tc = useTranslations("common");
  return (
    <>
      <section className="relative overflow-hidden bg-chocolate text-ivory">
        <LeafArt className="animate-sway pointer-events-none absolute -right-8 top-6 h-96 w-auto text-gold/20" />
        <div className="relative mx-auto max-w-4xl px-5 py-24 text-center md:px-8">
          <p className="eyebrow animate-fade-up">{t("hero.eyebrow")}</p>
          <h1
            className="animate-fade-up mt-6 text-4xl font-light leading-tight md:text-6xl"
            style={{ animationDelay: "150ms" }}
          >
            {t.rich("hero.title", { shimmer: (chunks) => <span className="text-shimmer">{chunks}</span> })}
          </h1>
          <p
            className="animate-fade-up mx-auto mt-6 max-w-2xl leading-relaxed text-ivory/75"
            style={{ animationDelay: "300ms" }}
          >
            {t("hero.text")}
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-24 md:grid-cols-2 md:px-8">
        <Reveal className="relative aspect-square overflow-hidden rounded-[2rem]">
          <Image
            src="/images/body-lotion.webp"
            alt={t("whoWeAre.imageAlt")}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </Reveal>
        <Reveal delay={200}>
          <p className="eyebrow">{t("whoWeAre.eyebrow")}</p>
          <h2 className="mt-4 text-3xl font-light leading-snug md:text-4xl">
            {t("whoWeAre.title")}
          </h2>
          <div className="mt-6 space-y-5 leading-relaxed text-chocolate/80">
            <p>{t("whoWeAre.paragraph1")}</p>
            <p>{t("whoWeAre.paragraph2")}</p>
          </div>
          <Link href="/products/" className="btn btn-primary mt-10">{t("whoWeAre.cta")}</Link>
        </Reveal>
      </section>

      <section className="bg-ivory">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-8">
          <Reveal className="text-center">
            <p className="eyebrow">{t("values.eyebrow")}</p>
            <h2 className="mt-4 text-3xl font-light md:text-4xl">{t("values.title")}</h2>
          </Reveal>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v, i) => (
              <Reveal key={v.key} delay={i * 120} className="h-full">
                <div className="h-full rounded-[2rem] bg-cream p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-chocolate/10">
                  <Icon name={v.icon} className="h-8 w-8 text-gold" />
                  <h3 className="mt-5 text-lg font-medium">{tc(`values.${v.key}.title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-chocolate/70">{tc(`values.${v.key}.text`)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-24 md:px-8">
        <Reveal className="text-center">
          <p className="eyebrow">{t("journey.eyebrow")}</p>
          <h2 className="mt-4 text-3xl font-light md:text-4xl">{t("journey.title")}</h2>
        </Reveal>
        <ol className="mt-14 grid gap-8 md:grid-cols-4">
          {milestones.map((m, i) => (
            <li key={m}>
              <Reveal delay={i * 150} className="border-t-2 border-gold pt-6">
                <p className="text-2xl font-medium text-gold">{t(`journey.milestones.${m}.year`)}</p>
                <p className="mt-3 text-sm leading-relaxed text-chocolate/75">{t(`journey.milestones.${m}.text`)}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-espresso py-20 text-center text-ivory">
        <Reveal>
          <Logo size="lg" />
        </Reveal>
      </section>
    </>
  );
}
