import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import Reveal from "@/components/Reveal";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with MELOVME for orders, partnerships and corporate gifting.",
};

const details = [
  { label: "Email", value: site.email, href: `mailto:${site.email}` },
  { label: "Phone", value: site.phone, href: `tel:${site.phone.replace(/\s/g, "")}` },
  { label: "Studio", value: site.address },
  { label: "Hours", value: site.hours },
];

export default function ContactPage() {
  return (
    <>
      <section className="bg-ivory">
        <div className="mx-auto max-w-7xl px-5 py-20 text-center md:px-8">
          <p className="eyebrow animate-fade-up">Contact</p>
          <h1 className="animate-fade-up mt-4 text-4xl font-light md:text-6xl" style={{ animationDelay: "150ms" }}>
            Let&apos;s talk
          </h1>
          <p
            className="animate-fade-up mx-auto mt-6 max-w-xl leading-relaxed text-chocolate/70"
            style={{ animationDelay: "300ms" }}
          >
            Questions about our products, wholesale, or corporate gifting? We&apos;d love to hear from you.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-14 px-5 py-20 md:grid-cols-5 md:px-8">
        <Reveal className="md:col-span-2">
          <h2 className="text-2xl font-light">Reach us directly</h2>
          <dl className="mt-8 space-y-7">
            {details.map((d) => (
              <div key={d.label}>
                <dt className="eyebrow">{d.label}</dt>
                <dd className="mt-2 leading-relaxed">
                  {d.href ? (
                    <a href={d.href} className="hover:text-gold">{d.value}</a>
                  ) : (
                    d.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal delay={200} className="rounded-[2rem] bg-chocolate p-8 text-ivory md:col-span-3 md:p-12">
          <h2 className="text-2xl font-light">Send us a message</h2>
          <ContactForm />
        </Reveal>
      </section>
    </>
  );
}
