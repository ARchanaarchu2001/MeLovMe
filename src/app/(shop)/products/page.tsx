import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import ProductCard from "@/components/ProductCard";
import ProductGrid from "@/components/ProductGrid";
import Reveal from "@/components/Reveal";
import { childrenOf, descendantIds, pathOf, productCounts, type Category } from "@/lib/category";
import { getCatalog, getCategories } from "@/lib/server/products";

export async function generateMetadata({ searchParams }: PageProps<"/products">): Promise<Metadata> {
  const t = await getTranslations("products.meta");
  const { category } = await searchParams;
  const selected = typeof category === "string" ? (await getCategories()).find((c) => c.slug === category) : undefined;
  return { title: selected ? `${selected.name} · ${t("title")}` : t("title"), description: t("description") };
}

// All products, or those in one category (?category=slug, with everything under it)
export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const t = await getTranslations("products.meta");
  const tf = await getTranslations("products.filter");
  const { category } = await searchParams;
  const [products, categories] = await Promise.all([getCatalog(), getCategories()]);

  // Only categories with something in them are offered
  const counts = productCounts(categories, products);
  const inUse = categories.filter((c) => (counts.get(c.id)?.total ?? 0) > 0);
  // An unknown link (e.g. a category renamed since) shows everything
  const selected = typeof category === "string" ? categories.find((c) => c.slug === category) : undefined;
  const inSelected = selected && descendantIds(categories, selected.id);
  const shown = inSelected ? products.filter((p) => inSelected.has(p.categoryId)) : products;

  // A row of choices per level: the main categories, then the sub-categories of each chosen one
  const trail = pathOf(categories, selected?.id ?? null);
  const levels = [null, ...trail]
    .map((parent, i) => ({ parent, options: childrenOf(inUse, parent?.id ?? null), chosen: trail[i] }))
    .filter((l) => l.options.length > 0);

  return (
    <>
      <h1 className="sr-only">{selected?.name ?? t("title")}</h1>
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
        {/* Hidden while there is only one category: there's nothing to choose between */}
        {/* Phones: one row per level that scrolls sideways, edge to edge; wider screens: centred and wrapping */}
        {inUse.length > 1 && (
          <nav aria-label={tf("label")} className="mb-4 grid gap-2 md:mb-8 md:gap-3">
            {levels.map(({ parent, options, chosen }) => (
              <ul key={parent?.id ?? "main"} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:justify-center md:overflow-visible md:px-0">
                <li className="shrink-0">
                  <Chip href={parent ? hrefFor(parent) : "/products/"} active={!chosen}>
                    {parent ? tf("allIn", { name: parent.name }) : tf("all")}
                  </Chip>
                </li>
                {options.map((c) => (
                  <li key={c.id} className="shrink-0">
                    <Chip href={hrefFor(c)} active={chosen?.id === c.id}>
                      {c.name}
                    </Chip>
                  </li>
                ))}
              </ul>
            ))}
          </nav>
        )}
        {shown.length ? (
          <ProductGrid count={shown.length}>
            {shown.map((p, i) => (
              <Reveal key={p.slug} delay={(i % 4) * 100}>
                <ProductCard product={p} />
              </Reveal>
            ))}
          </ProductGrid>
        ) : (
          <div className="py-10 text-center">
            <p className="text-chocolate/70">{tf("empty")}</p>
            <Link href="/products/" className="mt-6 inline-block border-b border-chocolate pb-1 text-xs uppercase tracking-[0.25em] hover:border-gold hover:text-gold">
              {tf("seeAll")}
            </Link>
          </div>
        )}
      </section>
    </>
  );
}

const hrefFor = (c: Category) => `/products/?category=${encodeURIComponent(c.slug)}`;

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={`inline-block whitespace-nowrap rounded-full border px-4 py-1.5 text-[0.7rem] uppercase tracking-[0.15em] transition-colors md:px-5 md:py-2 md:text-xs md:tracking-[0.18em] ${
        active ? "border-chocolate bg-chocolate text-ivory" : "border-chocolate/20 text-chocolate/75 hover:border-gold hover:text-gold"
      }`}
    >
      {children}
    </Link>
  );
}
