import type { Metadata } from "next";
import ProductCard from "@/components/ProductCard";
import Reveal from "@/components/Reveal";
import { products } from "@/data/products";

export const metadata: Metadata = {
  title: "Products",
  description: "Explore the MELOVME collection of premium body-care essentials.",
};

export default function ProductsPage() {
  return (
    <>
      <section className="bg-ivory">
        <div className="mx-auto max-w-7xl px-5 py-20 text-center md:px-8">
          <p className="eyebrow animate-fade-up">The Collection</p>
          <h1 className="animate-fade-up mt-4 text-4xl font-light md:text-6xl" style={{ animationDelay: "150ms" }}>
            Our Products
          </h1>
          <p
            className="animate-fade-up mx-auto mt-6 max-w-xl leading-relaxed text-chocolate/70"
            style={{ animationDelay: "300ms" }}
          >
            Thoughtfully formulated essentials for skin that feels loved — every single day.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8">
        <div className="grid gap-14 md:grid-cols-2">
          {products.map((p, i) => (
            <Reveal key={p.slug} delay={i * 150}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
