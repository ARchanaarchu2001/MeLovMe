import type { Metadata } from "next";
import ProfileForm from "@/components/ProfileForm";
import { logout } from "@/app/actions/auth";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = {
  title: "My Profile",
  robots: { index: false },
};

export default async function ProfilePage() {
  const user = await requireUser("/profile/");

  return (
    <section className="mx-auto max-w-md px-5 py-12 md:py-20">
      <p className="eyebrow">My Account</p>
      <h1 className="mb-10 mt-4 text-4xl font-light md:text-5xl">Profile</h1>
      <ProfileForm name={user.name} phone={user.phone} />
      <form action={logout} className="mt-12 border-t border-chocolate/15 pt-8">
        <button type="submit" className="text-xs uppercase tracking-[0.2em] text-chocolate/60 hover:text-gold">
          Log out
        </button>
      </form>
    </section>
  );
}
