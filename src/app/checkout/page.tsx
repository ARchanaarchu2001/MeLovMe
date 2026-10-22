import type { Metadata } from "next";
import CheckoutFlow from "@/components/CheckoutFlow";
import { razorpayKeyId } from "@/lib/server/razorpay";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

// Guests can shop and fill their cart, but must log in here before buying
export default async function CheckoutPage() {
  const user = await requireUser("/checkout/");
  const addresses = user.addresses.map(({ _id, ...a }) => ({ ...a, id: _id.toHexString() }));

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
      <p className="eyebrow">Secure Payment</p>
      <h1 className="mb-10 mt-4 text-4xl font-light md:text-5xl">Checkout</h1>
      {/* The key ID is public by design (it identifies the account); the secret stays on the server */}
      <CheckoutFlow addresses={addresses} user={{ name: user.name, phone: user.phone }} razorpayKey={razorpayKeyId()} />
    </section>
  );
}
