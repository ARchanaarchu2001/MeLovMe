import type { Metadata } from "next";
import WishlistView from "@/components/WishlistView";

export const metadata: Metadata = {
  title: "Your Wishlist",
  robots: { index: false },
};

export default function WishlistPage() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
      <p className="eyebrow">Saved for later</p>
      <h1 className="mb-10 mt-4 text-4xl font-light md:text-5xl">Your Wishlist</h1>
      <WishlistView />
    </section>
  );
}
