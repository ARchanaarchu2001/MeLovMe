"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "./Logo";
import { CartIcon, Icon, LeafArt, SocialIcon, UserIcon } from "./Icons";
import { navLinks, site, whatsappUrl } from "@/data/site";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";

export default function Header() {
  const t = useTranslations("common");
  const pathname = usePathname();
  const { count } = useCart();
  const { count: wishCount } = useWishlist();
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Admins get an extra "Admin" link. Asked from the browser (the shop pages are cached for
  // everyone) and re-checked on each navigation, so it appears or goes away after logging in or out.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/")
      .then((r) => (r.ok ? r.json() : { admin: false }))
      .then((d: { admin?: boolean }) => !cancelled && setIsAdmin(d.admin === true))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);
  const links = (isAdmin ? [...navLinks, { href: "/admin/", key: "admin" } as const] : navLinks).map((l) => ({
    href: l.href,
    label: t(`nav.${l.key}`),
  }));

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, "")));

  // While the mobile menu is open: lock page scroll, close on Escape or when resized to desktop
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const desktop = window.matchMedia("(min-width: 768px)");
    const onResize = () => desktop.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onResize);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onResize);
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-chocolate/10 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8">
          <Link href="/" className="text-chocolate" onClick={() => setOpen(false)}>
            <Logo size="sm" />
          </Link>

          <nav className="hidden items-center gap-10 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? "page" : undefined}
                className={`nav-link text-xs uppercase tracking-[0.25em] transition-colors hover:text-gold ${
                  isActive(l.href) ? "text-gold" : "text-chocolate"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 md:gap-5">
            {[
              { href: "/wishlist/", label: t("header.wishlist"), count: wishCount, icon: <Icon name="heart" className="h-5 w-5" /> },
              { href: "/cart/", label: t("header.cart"), count, icon: <CartIcon /> },
              // Logged-out visitors are sent on to the login page
              { href: "/profile/", label: t("header.account"), count: 0, icon: <UserIcon />, desktopOnly: true },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-label={l.count > 0 ? t("header.itemCount", { label: l.label, count: l.count }) : l.label}
                className={`relative h-11 w-11 items-center justify-center rounded-full border border-chocolate/20 text-chocolate transition-colors hover:border-gold hover:text-gold ${
                  l.desktopOnly ? "hidden md:flex" : "flex"
                }`}
              >
                {l.icon}
                {l.count > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[0.65rem] font-semibold text-espresso">
                    {l.count}
                  </span>
                )}
              </Link>
            ))}

            <Link href="/products/" className="btn btn-primary hidden !px-6 !py-3 md:inline-flex">
              {t("header.shopNow")}
            </Link>

            {/* Hamburger — morphs into an X */}
            <button
              className={`relative flex h-11 w-11 items-center justify-center rounded-full border transition-colors hover:border-gold hover:text-gold md:hidden ${
                open ? "border-gold text-gold" : "border-chocolate/20 text-chocolate"
              }`}
              onClick={() => setOpen(!open)}
              aria-label={open ? t("header.closeMenu") : t("header.openMenu")}
              aria-expanded={open}
              aria-controls="mobile-menu"
            >
              <span className={`absolute h-[2px] w-5 rounded bg-current transition-all duration-300 ${open ? "rotate-45" : "-translate-y-[6px]"}`} />
              <span className={`absolute h-[2px] w-5 rounded bg-current transition-all duration-300 ${open ? "scale-x-0 opacity-0" : ""}`} />
              <span className={`absolute h-[2px] w-5 rounded bg-current transition-all duration-300 ${open ? "-rotate-45" : "translate-y-[6px]"}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu panel — kept outside <header> so its fixed position isn't trapped by backdrop-blur */}
      <div
        id="mobile-menu"
        className={`fixed inset-x-0 bottom-0 top-20 z-40 overflow-y-auto bg-chocolate text-ivory transition-all duration-500 md:hidden ${
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-4 opacity-0"
        }`}
      >
        <LeafArt className="pointer-events-none absolute -right-10 bottom-10 h-80 w-auto text-gold/15" />

        <nav className="relative px-6 pt-10">
          <ul className="space-y-1">
            {links.map((l, i) => (
              <li
                key={l.href}
                className={`transition-all duration-500 ${open ? "translate-x-0 opacity-100" : "-translate-x-6 opacity-0"}`}
                style={{ transitionDelay: open ? `${150 + i * 80}ms` : "0ms" }}
              >
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={`flex items-center justify-between border-b border-ivory/10 py-5 text-2xl font-light ${
                    isActive(l.href) ? "text-gold" : ""
                  }`}
                >
                  {l.label}
                  <span className="text-base text-gold">→</span>
                </Link>
              </li>
            ))}
          </ul>

          <div
            className={`mt-10 transition-all duration-500 ${open ? "opacity-100" : "opacity-0"}`}
            style={{ transitionDelay: open ? "500ms" : "0ms" }}
          >
            <Link href="/products/" onClick={() => setOpen(false)} className="btn btn-gold w-full">
              {t("header.shopNow")}
            </Link>
            <div className="mt-4 flex items-center justify-center gap-6 text-xs uppercase tracking-[0.25em] text-ivory/80">
              <Link href="/profile/" onClick={() => setOpen(false)} className="flex items-center gap-2 hover:text-gold">
                <UserIcon className="h-4 w-4" /> {t("header.myAccount")}
              </Link>
              <span aria-hidden="true" className="h-3 w-px bg-ivory/30" />
              <Link href="/orders/" onClick={() => setOpen(false)} className="hover:text-gold">
                {t("header.myOrders")}
              </Link>
            </div>

            <div className="mt-10 space-y-2 text-sm text-ivory/70">
              <a href={`mailto:${site.email}`} className="block hover:text-gold">{site.email}</a>
              <a
                href={whatsappUrl(t("whatsappMessage"))}
                target="_blank"
                rel="noreferrer"
                className="block hover:text-gold"
              >
                {site.phone}
              </a>
            </div>

            <div className="mt-6 flex gap-3 pb-10">
              {(["instagram", "facebook"] as const).map((name) => (
                <a
                  key={name}
                  href={site.social[name]}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t(`social.${name}`)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-ivory/25 hover:border-gold hover:bg-gold hover:text-espresso"
                >
                  <SocialIcon name={name} />
                </a>
              ))}
            </div>
          </div>
        </nav>
      </div>
    </>
  );
}
