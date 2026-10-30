import Link from "next/link";
import type { ReactNode } from "react";
import { site, whatsappUrl } from "@/data/site";

export type PolicySection = { id: string; title: string; points: string[]; icon: ReactNode };

const updatedFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

// A policy point as written in en.json, with "<orders>My Orders</orders>" turned into a link
function withOrdersLink(text: string) {
  return text.split(/<orders>(.*?)<\/orders>/).map((part, i) =>
    i % 2 ? (
      <Link key={i} href="/orders/" className="text-gold underline-offset-4 hover:underline">
        {part}
      </Link>
    ) : (
      part
    ),
  );
}

// Layout shared by the policy pages (returns & refunds, privacy): title and intro, jump links,
// one card per section, and a dark "Need help?" box with email / WhatsApp / My Orders
export default function PolicyPage({ eyebrow, title, intro, updated, updatedLabel, sections, contact }: {
  eyebrow: string;
  title: string;
  intro: string;
  updated: Date;
  updatedLabel: (date: string) => string;
  sections: PolicySection[];
  contact: { title: string; text: string; email: string; whatsapp: string; whatsappMessage: string; orders: string };
}) {
  return (
    <section className="mx-auto max-w-4xl px-5 py-8 md:px-8 md:py-20">
      <header className="text-center">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-4 text-4xl font-light md:text-5xl">{title}</h1>
        <p className="mx-auto mt-6 max-w-2xl leading-relaxed text-chocolate/75">{intro}</p>
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-chocolate/50">{updatedLabel(updatedFormat.format(updated))}</p>
      </header>

      {/* Jump links */}
      <nav aria-label={title} className="mt-6 md:mt-10 flex flex-wrap justify-center gap-2">
        {sections.map((s, i) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border border-chocolate/15 px-4 py-1.5 text-xs uppercase tracking-[0.15em] text-chocolate/70 transition-colors hover:border-gold hover:text-gold"
          >
            {i + 1}. {s.title}
          </a>
        ))}
      </nav>

      <div className="mt-8 md:mt-12 grid gap-6">
        {sections.map((s, i) => (
          <article key={s.id} id={s.id} className="scroll-mt-28 rounded-[2rem] border border-chocolate/15 bg-white/30 p-6 sm:p-8">
            <h2 className="flex items-center gap-4 text-xl font-light sm:text-2xl">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {s.icon}
                </svg>
              </span>
              <span>
                <span className="mr-2 text-gold">{i + 1}.</span>
                {s.title}
              </span>
            </h2>
            <ul className="mt-5 grid gap-3 sm:pl-[3.75rem]">
              {s.points.map((point) => (
                <li key={point} className="flex gap-3 text-sm leading-relaxed text-chocolate/80 sm:text-base">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                  <span>{withOrdersLink(point)}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <aside className="mt-6 md:mt-10 rounded-[2rem] bg-espresso px-6 py-8 text-center text-ivory sm:px-10">
        <h2 className="text-2xl font-light">{contact.title}</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ivory/75">{contact.text}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href={`mailto:${site.email}`} className="btn btn-primary !bg-gold !text-espresso">
            {contact.email}
          </a>
          <a href={whatsappUrl(contact.whatsappMessage)} target="_blank" rel="noreferrer" className="btn border border-ivory/30 text-ivory hover:border-gold hover:text-gold">
            {contact.whatsapp}
          </a>
          <Link href="/orders/" className="btn border border-ivory/30 text-ivory hover:border-gold hover:text-gold">
            {contact.orders}
          </Link>
        </div>
        <p className="mt-5 text-xs text-ivory/50">
          {site.email} · {site.phone}
        </p>
      </aside>
    </section>
  );
}
