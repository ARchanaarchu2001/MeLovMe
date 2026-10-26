"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import AddressForm from "./AddressForm";
import { PencilIcon, TrashIcon } from "./Icons";
import OrderSummary from "./OrderSummary";
import { confirmPayment, createOrder, deleteAddress } from "@/app/actions/checkout";
import { site } from "@/data/site";
import { clearCart, setQty, useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { moveToWishlist } from "@/lib/wishlist";
import type { Address, Order, SavedAddress } from "@/lib/order";
import Spinner from "./Spinner";

// The parts of Razorpay Checkout (https://checkout.razorpay.com/v1/checkout.js) we use
type RazorpaySuccess = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayCheckout = {
  open: () => void;
  on: (event: "payment.failed", handler: (res: { error?: { description?: string } }) => void) => void;
};
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

// Loads Razorpay's checkout script once, the first time someone pays
let razorpayScript: Promise<boolean> | null = null;
function loadRazorpay() {
  razorpayScript ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => {
      razorpayScript = null; // let the next attempt retry
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return razorpayScript;
}

// Checkout for a logged-in customer: delivery address -> pay with Razorpay -> order page.
// Razorpay shows UPI apps (Google Pay, PhonePe, ...) on phones, a UPI QR code on computers,
// plus cards and netbanking, and tells us when the payment succeeds.
export default function CheckoutFlow({
  addresses: initialAddresses,
  user,
  razorpayKey,
}: {
  addresses: SavedAddress[];
  user: { name: string; phone: string };
  razorpayKey: string;
}) {
  const router = useRouter();
  const cart = useCart();
  const [addresses, setAddresses] = useState(initialAddresses);
  const [selectedId, setSelectedId] = useState(initialAddresses.at(-1)?.id ?? "");
  // First-time customers go straight to the address form
  const [adding, setAdding] = useState(initialAddresses.length === 0);
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  // True while Razorpay's payment window is open
  const [paying, setPaying] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const busy = pending || paying;

  function handleAddressSaved(address: SavedAddress) {
    setAddresses(
      addresses.some((a) => a.id === address.id)
        ? addresses.map((a) => (a.id === address.id ? address : a))
        : [...addresses, address],
    );
    setSelectedId(address.id);
    setAdding(false);
    setEditing(null);
  }

  function handleDelete(address: SavedAddress) {
    if (!window.confirm(`Delete this address?\n\n${address.name}, ${address.address}, ${address.city}`)) return;
    setError("");
    startTransition(async () => {
      await deleteAddress(address.id);
      const rest = addresses.filter((a) => a.id !== address.id);
      setAddresses(rest);
      if (selectedId === address.id) setSelectedId(rest.at(-1)?.id ?? "");
      // No addresses left: go straight to the form, as for a first-time customer
      if (!rest.length) setAdding(true);
    });
  }

  // Creates the order on first click (prices are worked out on the server), then opens Razorpay.
  // If the customer closes the payment window, clicking Pay again reuses the same order.
  function handlePay() {
    setError("");
    startTransition(async () => {
      let current = order;
      if (!current) {
        const res = await createOrder(
          selectedId,
          cart.lines.map((l) => ({ slug: l.product.slug, qty: l.qty })),
        );
        if ("error" in res) return setError(res.error);
        current = res;
        setOrder(res);
      }
      if (!(await loadRazorpay()) || !window.Razorpay) {
        return setError("We couldn't load the payment page. Please check your connection and try again.");
      }
      openPayment(current);
    });
  }

  function openPayment(o: Order) {
    const checkout = new window.Razorpay!({
      key: razorpayKey,
      order_id: o.razorpayOrderId,
      amount: o.total * 100, // paise
      currency: "INR",
      name: site.name,
      description: `Order ${o.id}`,
      prefill: { name: user.name, contact: `+91${user.phone}` },
      notes: { order: o.id },
      theme: { color: "#462b1b" },
      handler: (payment: RazorpaySuccess) => {
        startTransition(async () => {
          const res = await confirmPayment(o.id, payment);
          setPaying(false);
          if ("error" in res) return setError(res.error);
          setPlaced(true);
          clearCart();
          router.push(`/orders/${o.id}/`);
        });
      },
      modal: { ondismiss: () => setPaying(false) },
    });
    // Razorpay lets the customer retry inside its window; we just show why the last try failed
    checkout.on("payment.failed", (res) => setError(res.error?.description ?? "The payment didn't go through."));
    setPaying(true);
    checkout.open();
  }

  // Paid: the cart is now empty, so show this (not "cart empty") while the order page opens
  if (placed) {
    return (
      <div className="py-16 text-center">
        <p className="eyebrow">Payment received</p>
        <p className="mt-4 text-chocolate/70">Opening your order…</p>
      </div>
    );
  }

  if (!cart.ready) return <div className="min-h-[40vh]" />;

  if (!order && cart.lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-chocolate/70">Your cart is empty.</p>
        <Link href="/products/" className="btn btn-primary mt-8">Shop Products</Link>
      </div>
    );
  }

  const summary = order ?? {
    items: cart.lines.map((l) => ({ slug: l.product.slug, name: l.product.name, qty: l.qty, total: l.total })),
    subtotal: cart.subtotal,
    shipping: cart.shipping,
    total: cart.total,
  };

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_22rem]">
      {!order ? (
        <div>
          <h2 className="mb-6 text-sm uppercase tracking-[0.2em]">1. Delivery Address</h2>
          {editing ? (
            <AddressForm
              key={editing.id}
              defaults={editing}
              editId={editing.id}
              onSaved={handleAddressSaved}
              onCancel={() => setEditing(null)}
            />
          ) : adding ? (
            <AddressForm
              defaults={addresses.length ? {} : user}
              onSaved={handleAddressSaved}
              onCancel={addresses.length ? () => setAdding(false) : undefined}
            />
          ) : (
            <>
              <fieldset className="grid gap-4">
                <legend className="sr-only">Choose a delivery address</legend>
                {addresses.map((a) => (
                  <div
                    key={a.id}
                    className={`flex items-start gap-3 rounded-2xl border p-5 text-sm transition-colors ${
                      a.id === selectedId ? "border-gold bg-ivory" : "border-chocolate/20 hover:border-gold/60"
                    }`}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer gap-4">
                      <input
                        type="radio"
                        name="address"
                        value={a.id}
                        checked={a.id === selectedId}
                        onChange={() => setSelectedId(a.id)}
                        className="mt-1 accent-gold"
                      />
                      <AddressText address={a} />
                    </label>
                    <div className="flex gap-1 text-chocolate/60">
                      <button
                        type="button"
                        onClick={() => setEditing(a)}
                        disabled={pending}
                        aria-label={`Edit address: ${a.name}, ${a.address}`}
                        title="Edit"
                        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-gold/15 hover:text-gold"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(a)}
                        disabled={pending}
                        aria-label={`Delete address: ${a.name}, ${a.address}`}
                        title="Delete"
                        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-red-700/10 hover:text-red-700"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </fieldset>
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="mt-5 text-xs uppercase tracking-[0.2em] text-gold hover:text-chocolate"
              >
                + Add a new address
              </button>
              {error && <p className="mt-6 text-sm text-red-700" role="alert">{error}</p>}
              <div className="mt-8">
                <button type="button" onClick={handlePay} className="btn btn-primary" disabled={busy || !selectedId}>
                  {busy && <Spinner />}
                  {busy ? "Please wait…" : `Pay ${formatPrice(cart.total)}`}
                </button>
                <p className="mt-3 text-xs text-chocolate/60">UPI (Google Pay, PhonePe, Paytm), cards and netbanking</p>
              </div>
            </>
          )}
        </div>
      ) : (
        <div>
          <h2 className="text-sm uppercase tracking-[0.2em]">2. Payment</h2>
          <p className="mt-4 text-sm leading-relaxed text-chocolate/75">
            Complete your payment of <strong className="text-chocolate">{formatPrice(order.total)}</strong> for order{" "}
            <strong className="text-chocolate">{order.id}</strong>. Pay with any UPI app — Google Pay, PhonePe, Paytm —
            or a card or netbanking.
          </p>
          <p className="mt-6 text-sm text-chocolate/75">
            Delivering to: <AddressText address={order.address} inline />
          </p>
          {error && <p className="mt-6 text-sm text-red-700" role="alert">{error}</p>}
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <button type="button" onClick={handlePay} className="btn btn-primary" disabled={busy}>
              {busy && <Spinner />}
              {busy ? "Please wait…" : `Pay ${formatPrice(order.total)}`}
            </button>
            <button
              type="button"
              onClick={() => {
                setOrder(null);
                setError("");
              }}
              disabled={busy}
              className="text-xs uppercase tracking-[0.2em] text-chocolate/60 hover:text-gold"
            >
              Change address
            </button>
          </div>
        </div>
      )}

      <aside className="h-fit rounded-[2rem] bg-ivory p-8">
        <h2 className="mb-6 text-sm uppercase tracking-[0.2em]">Order Summary</h2>
        <ul className="mb-6 space-y-3 border-b border-chocolate/15 pb-6 text-sm">
          {summary.items.map((i) => (
            <li key={i.name}>
              <div className="flex justify-between gap-4">
                <span>
                  {i.name} <span className="text-chocolate/60">× {i.qty}</span>
                </span>
                <span>{formatPrice(i.total)}</span>
              </div>
              {/* Only live cart items have a slug — once the order is created for payment it can't be changed */}
              {"slug" in i && (
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.65rem] tracking-[0.2em] text-chocolate/60">
                  <button type="button" onClick={() => moveToWishlist(i.slug)} className="uppercase hover:text-gold">
                    Move to Wishlist
                  </button>
                  <button type="button" onClick={() => setQty(i.slug, 0)} className="uppercase hover:text-gold">
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <OrderSummary subtotal={summary.subtotal} shipping={summary.shipping} total={summary.total} />
        {!order && (
          <Link href="/cart/" className="mt-6 block text-center text-xs uppercase tracking-[0.2em] text-chocolate/60 hover:text-gold">
            Edit cart
          </Link>
        )}
      </aside>
    </div>
  );
}

function AddressText({ address: a, inline }: { address: Address; inline?: boolean }) {
  const line = `${a.address}, ${a.city}, ${a.state} - ${a.pincode}`;
  if (inline) return <>{a.name}, {line}</>;
  return (
    <span className="leading-relaxed">
      <span className="block font-medium">{a.name}</span>
      <span className="block text-chocolate/75">{line}</span>
      <span className="block text-chocolate/75">Phone: {a.phone}</span>
    </span>
  );
}
