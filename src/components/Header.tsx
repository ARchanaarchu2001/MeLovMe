"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "./Logo";
import { LeafArt, SocialIcon } from "./Icons";
import { navLinks, site } from "@/data/site";

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
            {navLinks.map((l) => (
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

          <Link href="/products/" className="btn btn-primary hidden !px-6 !py-3 md:inline-flex">
            Shop Now
          </Link>

          {/* Hamburger — morphs into an X */}
          <button
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-chocolate text-ivory md:hidden"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            <span className={`absolute h-[2px] w-5 rounded bg-current transition-all duration-300 ${open ? "rotate-45" : "-translate-y-[6px]"}`} />
            <span className={`absolute h-[2px] w-5 rounded bg-current transition-all duration-300 ${open ? "scale-x-0 opacity-0" : ""}`} />
            <span className={`absolute h-[2px] w-5 rounded bg-current transition-all duration-300 ${open ? "-rotate-45" : "translate-y-[6px]"}`} />
          </button>
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
            {navLinks.map((l, i) => (
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
              Shop Now
            </Link>

            <div className="mt-10 space-y-2 text-sm text-ivory/70">
              <a href={`mailto:${site.email}`} className="block hover:text-gold">{site.email}</a>
              <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="block hover:text-gold">{site.phone}</a>
            </div>

            <div className="mt-6 flex gap-3 pb-10">
              {(["instagram", "facebook"] as const).map((name) => (
                <a
                  key={name}
                  href={site.social[name]}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={name === "instagram" ? "Instagram" : "Facebook"}
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
