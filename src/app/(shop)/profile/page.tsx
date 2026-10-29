import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import ProfileForm from "@/components/ProfileForm";
import { logout } from "@/app/actions/auth";
import { CartIcon, Icon } from "@/components/Icons";
import PendingButton from "@/components/PendingButton";
import { placedStatuses } from "@/lib/order";
import { getDb } from "@/lib/server/db";
import { requireUser } from "@/lib/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.profile");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ProfilePage() {
  const user = await requireUser("/profile/");
  const t = await getTranslations("account");
  const orderCount = await (await getDb()).orders.countDocuments({ userId: user._id, status: { $in: [...placedStatuses] } });
  const since = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(user.createdAt);

  return (
    <section className="mx-auto max-w-2xl px-5 py-12 md:py-20">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="mb-10 mt-4 text-4xl font-light md:text-5xl">{t("profile.title")}</h1>

      <ProfileForm name={user.name} phone={user.phone} memberSince={t("profile.memberSince", { date: since })} />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Tile href="/orders/" icon={<CartIcon className="h-5 w-5" />} title={t("profile.myOrders")} text={t("profile.ordersCount", { count: orderCount })} />
        <Tile href="/wishlist/" icon={<Icon name="heart" className="h-5 w-5" />} title={t("profile.wishlist")} text={t("profile.wishlistText")} />
      </div>

      <form action={logout} className="mt-10 flex justify-center">
        <PendingButton className="inline-flex items-center gap-2 rounded-full border border-chocolate/15 px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-chocolate/70 transition-colors hover:border-red-700/40 hover:bg-red-700/5 hover:text-red-800 disabled:opacity-60">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          {t("profile.logOut")}
        </PendingButton>
      </form>
    </section>
  );
}

// A shortcut card: icon in a circle, title and a line under it, arrow that slides on hover
function Tile({ href, icon, title, text }: { href: string; icon: ReactNode; title: string; text: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-chocolate/15 bg-white/40 p-5 transition-all hover:-translate-y-0.5 hover:border-gold hover:shadow-[0_12px_30px_-16px_rgba(46,26,17,0.4)]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold transition-colors group-hover:bg-gold group-hover:text-espresso">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm uppercase tracking-[0.18em]">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-chocolate/60">{text}</span>
      </span>
      <span aria-hidden="true" className="text-gold transition-transform group-hover:translate-x-1">→</span>
    </Link>
  );
}
