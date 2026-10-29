import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import PolicyPage from "@/components/PolicyPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy.meta");
  return { title: t("title"), description: t("description") };
}

// Change this when the policy text in en.json (privacy.*) changes
const LAST_UPDATED = new Date("2026-10-29T00:00:00+05:30");

// The text of each section is in en.json: privacy.sections.<key>.points. Keep it in step with what
// the shop really collects (login, orders, payments, contact form, reviews, cart in the browser).
const sections: { key: "collect" | "use" | "payments" | "sharing" | "cookies" | "rights"; icon: ReactNode }[] = [
  { key: "collect", icon: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0" /> },
  { key: "use", icon: <path d="M6 7h12l-1 13H7L6 7Zm3 0V6a3 3 0 0 1 6 0v1" /> },
  { key: "payments", icon: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Zm-3 9 2 2 4-4" /> },
  { key: "sharing", icon: <path d="M8 12a3 3 0 1 0 0-.01M18 6a3 3 0 1 0 0-.01M18 18a3 3 0 1 0 0-.01M10.6 10.7l4.8-3.2M10.6 13.3l4.8 3.2" /> },
  { key: "cookies", icon: <path d="M21 12a9 9 0 1 1-9-9 3 3 0 0 0 4 4 3 3 0 0 0 5 5ZM8.5 9.5h.01M15.5 15.5h.01M10 15h.01" /> },
  { key: "rights", icon: <path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0L5 7Zm14 0-3 7a3 3 0 0 0 6 0l-3-7ZM8 21h8" /> },
];

// How the shop handles customers' personal information
export default async function PrivacyPolicyPage() {
  const t = await getTranslations("privacy");
  return (
    <PolicyPage
      eyebrow={t("eyebrow")}
      title={t("title")}
      intro={t("intro")}
      updated={LAST_UPDATED}
      updatedLabel={(date) => t("updated", { date })}
      sections={sections.map((s) => ({
        id: s.key,
        title: t(`sections.${s.key}.title`),
        points: t.raw(`sections.${s.key}.points`) as string[],
        icon: s.icon,
      }))}
      contact={{
        title: t("contact.title"),
        text: t("contact.text"),
        email: t("contact.email"),
        whatsapp: t("contact.whatsapp"),
        whatsappMessage: t("contact.whatsappMessage"),
        orders: t("contact.orders"),
      }}
    />
  );
}
