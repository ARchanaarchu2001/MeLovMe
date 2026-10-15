"use client";

import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useState, useTransition, type FormEvent } from "react";
import AddressForm, { field } from "./AddressForm";
import { PencilIcon, TrashIcon } from "./Icons";
import OrderSummary from "./OrderSummary";
import { createOrder, deleteAddress, submitPayment } from "@/app/actions/checkout";
import { site } from "@/data/site";
import { clearCart, setQty, useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { moveToWishlist } from "@/lib/wishlist";
import { upiLink, type Address, type Order, type SavedAddress } from "@/lib/order";

// Checkout for a logged-in customer: delivery address -> pay by UPI -> confirmation.
// Payment goes straight to the shop's UPI ID (no gateway); the customer then
// enters the UPI reference number so the shop can match the payment to the order.
export default function CheckoutFlow({
  addresses: initialAddresses,
  user,
}: {
  addresses: SavedAddress[];
  user: { name: string; phone: string };
}) {
  const cart = useCart();
  const [addresses, setAddresses] = useState(initialAddresses);
  const [selectedId, setSelectedId] = useState(initialAddresses.at(-1)?.id ?? "");
  // First-time customers go straight to the address form
  const [adding, setAdding] = useState(initialAddresses.length === 0);
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [placed, setPlaced] = useState(false);
  const [upiRef, setUpiRef] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

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

  function handleContinue() {
    setError("");
    startTransition(async () => {
      const res = await createOrder(
        selectedId,
        cart.lines.map((l) => ({ slug: l.product.slug, qty: l.qty })),
      );
      if ("error" in res) return setError(res.error);
      setOrder(res);
      window.scrollTo(0, 0);
    });
  }

  function handleConfirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!order) return;
    setError("");
    startTransition(async () => {
      const res = await submitPayment(order.id, upiRef);
      if ("error" in res) return setError(res.error);
      setPlaced(true);
      clearCart();
      window.scrollTo(0, 0);
    });
  }

  async function copyUpiId() {
    try {
      await navigator.clipboard.writeText(site.upi.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the ID is visible on screen to copy by hand
    }
  }

  if (order && placed) {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <p className="eyebrow">Thank you</p>
        <h2 className="mt-4 text-3xl font-light">Order received</h2>
        <p className="mt-6 text-sm uppercase tracking-[0.2em] text-chocolate/60">Order ID</p>
        <p className="mt-1 text-2xl font-medium text-gold">{order.id}</p>
        <p className="mt-6 leading-relaxed text-chocolate/75">
          Once we verify your UPI payment of {formatPrice(order.total)}, we&apos;ll confirm your order on{" "}
          {order.address.phone}.
        </p>
        <Link href="/products/" className="btn btn-primary mt-10">Continue Shopping</Link>
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
                <button type="button" onClick={handleContinue} className="btn btn-primary" disabled={pending || !selectedId}>
                  {pending ? "Please wait…" : "Continue to Payment"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div>
          <h2 className="text-sm uppercase tracking-[0.2em]">2. Pay by UPI</h2>
          <p className="mt-4 text-sm leading-relaxed text-chocolate/75">
            Pay <strong className="text-chocolate">{formatPrice(order.total)}</strong> for order{" "}
            <strong className="text-chocolate">{order.id}</strong> using any UPI app — Google Pay, PhonePe, Paytm, BHIM
            and others.
          </p>

          <div className="mt-8 flex flex-col items-center gap-8 rounded-[2rem] bg-ivory p-8 sm:flex-row sm:items-start">
            <div className="rounded-2xl bg-white p-4">
              <QRCodeSVG value={upiLink(order)} size={176} fgColor="#2e1a11" title="UPI payment QR code" />
            </div>
            <div className="w-full text-center text-sm sm:text-left">
              <p className="font-medium">Scan the QR code with your UPI app</p>
              <p className="mt-1 text-chocolate/70">The amount is filled in automatically.</p>

              <a href={upiLink(order)} className="btn btn-primary mt-6 w-full sm:hidden">Open UPI App</a>

              <p className="mt-6 text-xs uppercase tracking-[0.2em] text-chocolate/60">Or pay to UPI ID</p>
              <div className="mt-2 flex items-center justify-center gap-3 sm:justify-start">
                <span className="font-medium">{site.upi.id}</span>
                <button type="button" onClick={copyUpiId} className="border-b border-gold text-xs uppercase tracking-[0.2em] text-gold">
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-1 text-chocolate/70">Payee: {site.upi.payeeName}</p>
            </div>
          </div>

          <p className="mt-8 text-sm text-chocolate/75">
            Delivering to: <AddressText address={order.address} inline />
          </p>

          <form onSubmit={handleConfirm} className="mt-10">
            <h2 className="text-sm uppercase tracking-[0.2em]">3. Confirm Your Payment</h2>
            <p className="mt-4 text-sm leading-relaxed text-chocolate/75">
              After paying, enter the 12-digit UPI reference number (UTR) shown in your UPI app&apos;s transaction
              details.
            </p>
            <input
              value={upiRef}
              onChange={(e) => setUpiRef(e.target.value.replace(/\D/g, "").slice(0, 12))}
              required
              inputMode="numeric"
              pattern="[0-9]{12}"
              title="12-digit UPI reference number"
              placeholder="UPI reference number (UTR) *"
              aria-label="UPI reference number (UTR)"
              className={`${field} mt-5 max-w-sm`}
            />
            {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-6">
              <button type="submit" className="btn btn-primary" disabled={pending}>
                {pending ? "Placing Order…" : "Place Order"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrder(null);
                  setError("");
                }}
                className="text-xs uppercase tracking-[0.2em] text-chocolate/60 hover:text-gold"
              >
                Change address
              </button>
            </div>
          </form>
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
