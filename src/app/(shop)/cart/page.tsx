import type { Metadata } from "next";
import CartView from "@/components/CartView";

export const metadata: Metadata = {
  title: "Your Cart",
  robots: { index: false },
};

export default function CartPage() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
      <p className="eyebrow">Shopping</p>
      <h1 className="mb-10 mt-4 text-4xl font-light md:text-5xl">Your Cart</h1>
      <CartView />
    </section>
  );
}
