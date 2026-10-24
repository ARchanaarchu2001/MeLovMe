import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { afterLoginPath, getUser } from "@/lib/server/session";

export const metadata: Metadata = {
  title: "Login",
  robots: { index: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const returnTo = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/profile/";
  const user = await getUser();
  if (user) redirect(afterLoginPath(user, returnTo));

  return (
    <section className="mx-auto max-w-md px-5 py-12 md:py-20">
      <p className="eyebrow">{returnTo.startsWith("/checkout") ? "Login to continue checkout" : "Welcome"}</p>
      <h1 className="mb-10 mt-4 text-4xl font-light md:text-5xl">Login</h1>
      <LoginForm next={returnTo} />
    </section>
  );
}
