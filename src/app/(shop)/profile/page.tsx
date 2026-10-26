import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import ProfileForm from "@/components/ProfileForm";
import { logout } from "@/app/actions/auth";
import PendingButton from "@/components/PendingButton";
import { requireUser } from "@/lib/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.profile");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ProfilePage() {
  const user = await requireUser("/profile/");
  const t = await getTranslations("account");

  return (
    <section className="mx-auto max-w-md px-5 py-12 md:py-20">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="mb-10 mt-4 text-4xl font-light md:text-5xl">{t("profile.title")}</h1>
      <ProfileForm name={user.name} phone={user.phone} />
      <Link
        href="/orders/"
        className="mt-10 flex items-center justify-between rounded-2xl border border-chocolate/15 px-5 py-4 transition-colors hover:border-gold hover:text-gold"
      >
        <span className="text-sm uppercase tracking-[0.2em]">{t("profile.myOrders")}</span>
        <span aria-hidden="true" className="text-gold">→</span>
      </Link>
      <form action={logout} className="mt-12 border-t border-chocolate/15 pt-8">
        <PendingButton className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-chocolate/60 hover:text-gold disabled:opacity-60">
          {t("profile.logOut")}
        </PendingButton>
      </form>
    </section>
  );
}
