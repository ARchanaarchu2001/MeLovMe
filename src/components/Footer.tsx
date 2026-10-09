import Link from "next/link";
import Logo from "./Logo";
import { SocialIcon } from "./Icons";
import { navLinks, site } from "@/data/site";
import { products } from "@/data/products";

export default function Footer() {
  return (
    <footer className="bg-espresso text-ivory">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 md:grid-cols-4 md:px-8">
        <div className="md:col-span-1">
          <Logo size="md" className="text-ivory" />
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-ivory/70">
            Premium body care built around self-love. More than just a scent.
          </p>
        </div>

        <div>
          <h3 className="eyebrow mb-5">Explore</h3>
          <ul className="space-y-3 text-sm text-ivory/80">
            {navLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-gold">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="eyebrow mb-5">Products</h3>
          <ul className="space-y-3 text-sm text-ivory/80">
            {products.map((p) => (
              <li key={p.slug}>
                <Link href={`/products/${p.slug}/`} className="hover:text-gold">
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="eyebrow mb-5">Get in touch</h3>
          <ul className="space-y-3 text-sm text-ivory/80">
            <li>
              <a href={`mailto:${site.email}`} className="hover:text-gold">
                {site.email}
              </a>
            </li>
            <li>
              <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="hover:text-gold">
                {site.phone}
              </a>
            </li>
            <li className="flex gap-3 pt-2">
              {(["instagram", "facebook"] as const).map((name) => (
                <a
                  key={name}
                  href={site.social[name]}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={name === "instagram" ? "Instagram" : "Facebook"}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-ivory/25 transition-all duration-300 hover:-translate-y-1 hover:border-gold hover:bg-gold hover:text-espresso"
                >
                  <SocialIcon name={name} />
                </a>
              ))}
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-ivory/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-5 py-6 text-xs text-ivory/50 md:flex-row md:px-8">
          <p>© {new Date().getFullYear()} MELOVME. All rights reserved.</p>
          <p className="uppercase tracking-[0.3em]">Your Signature</p>
        </div>
      </div>
    </footer>
  );
}
