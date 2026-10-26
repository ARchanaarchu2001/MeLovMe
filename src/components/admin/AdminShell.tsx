"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import Logo from "@/components/Logo";
import PendingButton from "@/components/PendingButton";

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const nav = [
  { href: "/admin/", label: "Dashboard", exact: true, icon: icon("M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z") },
  { href: "/admin/orders/", label: "Orders", icon: icon("M6 7h12l-1 13H7L6 7Zm3 0V6a3 3 0 0 1 6 0v1") },
  { href: "/admin/customers/", label: "Customers", icon: icon("M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 7m6 9a7 7 0 0 0-4-6.3") },
  { href: "/admin/products/", label: "Products", icon: icon("M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 0v18M4 7l8 4 8-4") },
];

// The admin area's frame: a sidebar on desktop, a top bar with a slide-in menu on phones
export default function AdminShell({ name, children }: { name: string; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href || pathname === href.replace(/\/$/, "") : pathname.startsWith(href.replace(/\/$/, ""));
  const current = nav.find((n) => isActive(n.href, n.exact));

  // Escape closes the phone menu (links close it as they navigate)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const sidebar = (
    <div className="flex h-full flex-col bg-espresso text-ivory">
      {/* Same height as the top bar, and the logo starts where the menu icons do */}
      <Link
        href="/admin/"
        onClick={() => setOpen(false)}
        className="flex h-20 shrink-0 items-center gap-4 border-b border-ivory/10 px-7 text-ivory"
      >
        <Logo size="sm" tagline={false} />
        <span className="h-8 w-px bg-ivory/20" aria-hidden="true" />
        <span className="text-[0.7rem] font-medium uppercase tracking-[0.3em] text-gold">Admin</span>
      </Link>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5" aria-label="Admin">
        {nav.map((n) => {
          const active = isActive(n.href, n.exact);
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors ${
                active ? "bg-ivory/10 text-gold" : "text-ivory/75 hover:bg-ivory/5 hover:text-ivory"
              }`}
            >
              {n.icon}
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t border-ivory/10 px-3 py-4 text-sm">
        <Link href="/" className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-ivory/75 hover:bg-ivory/5 hover:text-ivory">
          {icon("M3 11 12 4l9 7M5 10v10h14V10")}
          View shop
        </Link>
        <form action={logout}>
          <PendingButton className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-ivory/75 hover:bg-ivory/5 hover:text-ivory disabled:opacity-60">
            {icon("M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10")}
            Log out
          </PendingButton>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-cream">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">{sidebar}</aside>

      {/* Phone menu */}
      <div className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-espresso/50 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        />
        <aside
          id="admin-menu"
          className={`absolute inset-y-0 left-0 w-72 max-w-[85%] transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}
        >
          {sidebar}
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-chocolate/10 bg-cream/95 px-5 backdrop-blur md:px-8 lg:h-20">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="admin-menu"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-chocolate/20 lg:hidden"
          >
            {icon("M4 7h16M4 12h16M4 17h16")}
          </button>
          <h1 className="text-lg font-medium">{current?.label ?? "Admin"}</h1>
          {/* Who is signed in */}
          <div className="ml-auto flex items-center gap-3" title={`Signed in as ${name}`}>
            <span className="hidden text-right text-xs leading-tight sm:block">
              <span className="block text-chocolate/60">Signed in as</span>
              <span className="block text-sm font-medium text-chocolate">{name}</span>
            </span>
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full bg-chocolate text-sm font-medium uppercase text-ivory"
              aria-hidden="true"
            >
              {name.trim().charAt(0) || "A"}
            </span>
            <span className="sr-only sm:hidden">Signed in as {name}</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
