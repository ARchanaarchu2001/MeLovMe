import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Logo from "@/components/Logo";
import Reveal from "@/components/Reveal";
import { Icon, LeafArt } from "@/components/Icons";
import { values } from "@/data/site";

export const metadata: Metadata = {
  title: "Our Story",
  description: "The story behind MELOVME — premium body care built around self-love.",
};

const milestones = [
  { year: "2023", text: "The idea of MELOVME is born — body care that celebrates self-love." },
  { year: "2024", text: "Months of formulation and testing to perfect our signature lotion." },
  { year: "2025", text: "MELOVME launches with the Signature Body Lotion and Gift Set." },
  { year: "Next", text: "New rituals and fragrances to complete your signature collection." },
];

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-chocolate text-ivory">
        <LeafArt className="animate-sway pointer-events-none absolute -right-8 top-6 h-96 w-auto text-gold/20" />
        <div className="relative mx-auto max-w-4xl px-5 py-24 text-center md:px-8">
          <p className="eyebrow animate-fade-up">Our Story</p>
          <h1
            className="animate-fade-up mt-6 text-4xl font-light leading-tight md:text-6xl"
            style={{ animationDelay: "150ms" }}
          >
            Me. <span className="text-shimmer">Love.</span> Me.
          </h1>
          <p
            className="animate-fade-up mx-auto mt-6 max-w-2xl leading-relaxed text-ivory/75"
            style={{ animationDelay: "300ms" }}
          >
            Our name says it all. MELOVME is a reminder to pause, care for yourself, and celebrate the person you
            are — one soft, fragrant ritual at a time.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-24 md:grid-cols-2 md:px-8">
        <Reveal className="relative aspect-square overflow-hidden rounded-[2rem]">
          <Image
            src="/images/body-lotion.webp"
            alt="MELOVME Body Lotion among fresh leaves and jasmine"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </Reveal>
        <Reveal delay={200}>
          <p className="eyebrow">Who We Are</p>
          <h2 className="mt-4 text-3xl font-light leading-snug md:text-4xl">
            Premium care, rooted in nature.
          </h2>
          <div className="mt-6 space-y-5 leading-relaxed text-chocolate/80">
            <p>
              MELOVME is a premium body-care identity built around the idea of self-love and personal care. We
              believe that the products you reach for every day should feel just as special as the moments you
              save them for.
            </p>
            <p>
              Our signature droplet represents what we stand for — skincare, hydration and nourishment. Our warm
              chocolate and soft ivory tones reflect the natural, sophisticated experience we bring to every
              bottle and box.
            </p>
          </div>
          <Link href="/products/" className="btn btn-primary mt-10">Shop the Collection</Link>
        </Reveal>
      </section>

      <section className="bg-ivory">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-8">
          <Reveal className="text-center">
            <p className="eyebrow">What We Believe</p>
            <h2 className="mt-4 text-3xl font-light md:text-4xl">Our promise to you</h2>
          </Reveal>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v, i) => (
              <Reveal key={v.title} delay={i * 120} className="h-full">
                <div className="h-full rounded-[2rem] bg-cream p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-chocolate/10">
                  <Icon name={v.icon} className="h-8 w-8 text-gold" />
                  <h3 className="mt-5 text-lg font-medium">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-chocolate/70">{v.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-24 md:px-8">
        <Reveal className="text-center">
          <p className="eyebrow">Our Journey</p>
          <h2 className="mt-4 text-3xl font-light md:text-4xl">From an idea to your signature</h2>
        </Reveal>
        <ol className="mt-14 grid gap-8 md:grid-cols-4">
          {milestones.map((m, i) => (
            <li key={m.year}>
              <Reveal delay={i * 150} className="border-t-2 border-gold pt-6">
                <p className="text-2xl font-medium text-gold">{m.year}</p>
                <p className="mt-3 text-sm leading-relaxed text-chocolate/75">{m.text}</p>
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
