import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import PolicyPage from "@/components/PolicyPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("policy.meta");
  return { title: t("title"), description: t("description") };
}

// Change this when the policy text in en.json (policy.*) changes
const LAST_UPDATED = new Date("2026-10-29T00:00:00+05:30");

// The text of each section is in en.json: policy.sections.<key>.points
const sections: { key: "shipping" | "cancellation" | "returns" | "refunds"; icon: ReactNode }[] = [
  { key: "shipping", icon: <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" /> },
  { key: "cancellation", icon: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9 9l6 6M15 9l-6 6" /> },
  { key: "returns", icon: <path d="M4 9h11a5 5 0 0 1 0 10H9M4 9l4-4M4 9l4 4" /> },
  { key: "refunds", icon: <path d="M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /> },
];

// Returns, refunds and cancellation policy, matching how the shop works: customers cancel from
// My Orders until it ships, refunds go back through Razorpay, damaged items are replaced
export default async function RefundPolicyPage() {
  const t = await getTranslations("policy");
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
