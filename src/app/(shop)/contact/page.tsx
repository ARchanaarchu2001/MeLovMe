import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ContactForm from "@/components/ContactForm";
import Reveal from "@/components/Reveal";
import { site, whatsappUrl } from "@/data/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact.meta");
  return { title: t("title"), description: t("description") };
}

export default async function ContactPage() {
  const t = await getTranslations("contact");
  const tc = await getTranslations("common");
  const details = [
    { label: t("details.email"), value: site.email, href: `mailto:${site.email}` },
    { label: t("details.phone"), value: site.phone, href: whatsappUrl(tc("whatsappMessage")), external: true },
    { label: t("details.studio"), value: t("details.studioValue") },
    { label: t("details.hours"), value: t("details.hoursValue") },
  ];

  return (
    <>
      <section className="bg-ivory">
        <div className="mx-auto max-w-7xl px-5 py-20 text-center md:px-8">
          <p className="eyebrow animate-fade-up">{t("hero.eyebrow")}</p>
          <h1 className="animate-fade-up mt-4 text-4xl font-light md:text-6xl" style={{ animationDelay: "150ms" }}>
            {t("hero.title")}
          </h1>
          <p
            className="animate-fade-up mx-auto mt-6 max-w-xl leading-relaxed text-chocolate/70"
            style={{ animationDelay: "300ms" }}
          >
            {t("hero.text")}
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-14 px-5 py-20 md:grid-cols-5 md:px-8">
        <Reveal className="md:col-span-2">
          <h2 className="text-2xl font-light">{t("details.title")}</h2>
          <dl className="mt-8 space-y-7">
            {details.map((d) => (
              <div key={d.label}>
                <dt className="eyebrow">{d.label}</dt>
                <dd className="mt-2 leading-relaxed">
                  {d.href ? (
                    <a
                      href={d.href}
                      {...(d.external && { target: "_blank", rel: "noreferrer" })}
                      className="hover:text-gold"
                    >
                      {d.value}
                    </a>
                  ) : (
                    d.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal delay={200} className="rounded-[2rem] bg-chocolate p-8 text-ivory md:col-span-3 md:p-12">
          <h2 className="text-2xl font-light">{t("form.title")}</h2>
          <ContactForm />
        </Reveal>
      </section>
    </>
  );
}
