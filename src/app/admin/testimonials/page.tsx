import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import TestimonialsForm from "@/components/admin/TestimonialsForm";
import { getTestimonials } from "@/lib/server/testimonials";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Testimonials" };

// The "Loved by our community" reviews on the home page. Before the first save, the form starts
// with the reviews the shop shows today, so nothing needs typing again.
export default async function TestimonialsPage() {
  await requireAdmin("/admin/testimonials/");
  const t = await getTranslations("home");
  return (
    <TestimonialsForm
      initial={await getTestimonials()}
      heading={{ eyebrow: t("testimonialsSection.eyebrow"), title: t("testimonialsSection.title") }}
    />
  );
}
