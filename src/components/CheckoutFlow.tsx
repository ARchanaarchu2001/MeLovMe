"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import AddressForm from "./AddressForm";
import { PencilIcon, TrashIcon } from "./Icons";
import OrderSummary from "./OrderSummary";
import PayButton from "./PayButton";
import Spinner from "./Spinner";
import { confirmPayment, createOrder, deleteAddress } from "@/app/actions/checkout";
import { site } from "@/data/site";
import { removeFromCart, setQty, useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { moveToWishlist } from "@/lib/wishlist";
import { paymentMethods, type Address, type Order, type PaymentMethod, type SavedAddress } from "@/lib/order";

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

// Checkout for a logged-in customer: delivery address -> payment method -> order page.
// Online: Razorpay shows UPI apps (Google Pay, PhonePe, ...) on phones, a UPI QR code on computers,
// plus cards and netbanking, and tells us when the payment succeeds. Cash on delivery: the order
// is placed straight away. Which methods show is set in /admin/payments.
export default function CheckoutFlow({
  addresses: initialAddresses,
  user,
  razorpayKey,
  methods,
}: {
  addresses: SavedAddress[];
  user: { name: string; phone: string };
  razorpayKey: string;
  methods: Record<PaymentMethod, boolean>;
}) {
  const t = useTranslations("checkout.flow");
  const router = useRouter();
  const cart = useCart();
  // Only the items ticked in the cart are ordered; the rest stay in the cart for later
  const lines = cart.selected;
  const [addresses, setAddresses] = useState(initialAddresses);
  const [selectedId, setSelectedId] = useState(initialAddresses.at(-1)?.id ?? "");
  // First-time customers go straight to the address form
  const [adding, setAdding] = useState(initialAddresses.length === 0);
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  // What's in `order`, to take out of the cart once it's paid
  const [orderedSlugs, setOrderedSlugs] = useState<string[]>([]);
  // True while Razorpay's payment window is open
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>(methods.razorpay ? "razorpay" : "cod");
  // Set once the order is placed: paid online, or placed with cash on delivery
  const [placed, setPlaced] = useState<PaymentMethod | null>(null);
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
    if (!window.confirm(t("confirmDelete", { name: address.name, address: address.address, city: address.city }))) return;
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
      let slugs = orderedSlugs;
      if (!current) {
        slugs = lines.map((l) => l.product.slug);
        const res = await createOrder(
          selectedId,
          lines.map((l) => ({ slug: l.product.slug, qty: l.qty })),
          method,
        );
        if ("error" in res) return setError(res.error);
        // Cash on delivery: placed, nothing to pay now
        if ("placed" in res) {
          setPlaced("cod");
          removeFromCart(slugs);
          router.push(`/orders/${res.placed}/`);
          return;
        }
        current = res;
        setOrder(res);
        setOrderedSlugs(slugs);
      }
      if (!(await loadRazorpay()) || !window.Razorpay) {
        return setError(t("loadFailed"));
      }
      openPayment(current, slugs);
    });
  }

  function openPayment(o: Order, slugs: string[]) {
    const checkout = new window.Razorpay!({
      key: razorpayKey,
      order_id: o.razorpayOrderId,
      amount: o.total * 100, // paise
      currency: "INR",
      name: site.name,
      description: t("paymentDescription", { id: o.id }),
      prefill: { name: user.name, contact: `+91${user.phone}` },
      notes: { order: o.id },
      theme: { color: "#462b1b" },
      handler: (payment: RazorpaySuccess) => {
        startTransition(async () => {
          const res = await confirmPayment(o.id, payment);
          setPaying(false);
          if ("error" in res) return setError(res.error);
          setPlaced("razorpay");
          removeFromCart(slugs);
          router.push(`/orders/${o.id}/`);
        });
      },
      modal: { ondismiss: () => setPaying(false) },
    });
    // Razorpay lets the customer retry inside its window; we just show why the last try failed
    checkout.on("payment.failed", (res) => setError(res.error?.description ?? t("paymentFailed")));
    setPaying(true);
    checkout.open();
  }

  // Placed: the cart is now empty, so show this (not "cart empty") while the order page opens
  if (placed) {
    return (
      <div className="py-16 text-center">
        <p className="eyebrow">{placed === "cod" ? t("orderPlaced") : t("paymentReceived")}</p>
        <p className="mt-4 text-chocolate/70">{t("openingOrder")}</p>
      </div>
    );
  }

  if (!cart.ready) return <div className="min-h-[40vh]" />;

  if (!order && lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-chocolate/70">{t("cartEmpty")}</p>
        <Link href="/products/" className="btn btn-primary mt-8">{t("shopProducts")}</Link>
      </div>
    );
  }

  const summary = order ?? {
    items: lines.map((l) => ({ slug: l.product.slug, name: l.product.name, qty: l.qty, total: l.total })),
    subtotal: cart.subtotal,
    shipping: cart.shipping,
    total: cart.total,
  };

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_22rem]">
      {!order ? (
        <div>
          <h2 className="mb-6 text-sm uppercase tracking-[0.2em]">{t("deliveryAddress")}</h2>
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
                <legend className="sr-only">{t("chooseAddress")}</legend>
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
                        aria-label={t("editAddress", { name: a.name, address: a.address })}
                        title={t("edit")}
                        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-gold/15 hover:text-gold"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(a)}
                        disabled={pending}
                        aria-label={t("deleteAddress", { name: a.name, address: a.address })}
                        title={t("delete")}
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
                {t("addAddress")}
              </button>
              {/* A choice only when the shop offers both */}
              {methods.razorpay && methods.cod && (
                <fieldset className="mt-10">
                  <legend className="mb-4 text-sm uppercase tracking-[0.2em]">{t("paymentMethod")}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {paymentMethods.map((m) => (
                      <label
                        key={m}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm transition-colors ${
                          method === m ? "border-gold bg-ivory" : "border-chocolate/20 hover:border-gold/60"
                        }`}
                      >
                        <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} className="mt-1 accent-gold" />
                        <span>
                          <span className="block font-medium">{m === "cod" ? t("cod") : t("payOnline")}</span>
                          <span className="block text-chocolate/65">{m === "cod" ? t("codText") : t("payOnlineText")}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {error && <p className="mt-6 text-sm text-red-700" role="alert">{error}</p>}
              <div className="mt-8">
                {!methods.razorpay && !methods.cod ? (
                  <p className="text-sm text-chocolate/70">{t("noPaymentMethods")}</p>
                ) : method === "cod" ? (
                  <>
                    <button type="button" onClick={handlePay} disabled={busy || !selectedId} className="btn btn-primary w-full sm:w-auto">
                      {busy && <Spinner />}
                      {busy ? t("pleaseWait") : t("placeOrder", { amount: formatPrice(cart.total) })}
                    </button>
                    <p className="mt-3 text-xs text-chocolate/60">{t("codNote", { amount: formatPrice(cart.total) })}</p>
                  </>
                ) : (
                  <>
                    <PayButton onClick={handlePay} disabled={busy || !selectedId} pending={busy}>
                      {busy ? t("pleaseWait") : t("pay", { amount: formatPrice(cart.total) })}
                    </PayButton>
                    <p className="mt-3 text-xs text-chocolate/60">{t("paymentMethods")}</p>
                  </>
                )}
                {(methods.razorpay || methods.cod) && (
                  <p className="mt-2 text-xs text-chocolate/60">
                    {t.rich("agreePolicy", {
                      link: (chunks) => (
                        <Link href="/refund-policy/" target="_blank" className="text-gold underline-offset-4 hover:underline">
                          {chunks}
                        </Link>
                      ),
                    })}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div>
          <h2 className="text-sm uppercase tracking-[0.2em]">{t("payment")}</h2>
          <p className="mt-4 text-sm leading-relaxed text-chocolate/75">
            {t.rich("completePayment", {
              amount: formatPrice(order.total),
              id: order.id,
              strong: (chunks) => <strong className="text-chocolate">{chunks}</strong>,
            })}
          </p>
          <p className="mt-6 text-sm text-chocolate/75">
            {t.rich("deliveringTo", { address: () => <AddressText address={order.address} inline /> })}
          </p>
          {error && <p className="mt-6 text-sm text-red-700" role="alert">{error}</p>}
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <PayButton onClick={handlePay} disabled={busy} pending={busy}>
              {busy ? t("pleaseWait") : t("pay", { amount: formatPrice(order.total) })}
            </PayButton>
            <button
              type="button"
              onClick={() => {
                setOrder(null);
                setError("");
              }}
              disabled={busy}
              className="text-xs uppercase tracking-[0.2em] text-chocolate/60 hover:text-gold"
            >
              {t("changeAddress")}
            </button>
          </div>
        </div>
      )}

      <aside className="h-fit rounded-[2rem] bg-ivory p-8">
        <h2 className="mb-6 text-sm uppercase tracking-[0.2em]">{t("orderSummary")}</h2>
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
                    {t("moveToWishlist")}
                  </button>
                  <button type="button" onClick={() => setQty(i.slug, 0)} className="uppercase hover:text-gold">
                    {t("remove")}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <OrderSummary subtotal={summary.subtotal} shipping={summary.shipping} total={summary.total} />
        {!order && (
          <Link href="/cart/" className="mt-6 block text-center text-xs uppercase tracking-[0.2em] text-chocolate/60 hover:text-gold">
            {t("editCart")}
          </Link>
        )}
      </aside>
    </div>
  );
}

function AddressText({ address: a, inline }: { address: Address; inline?: boolean }) {
  const t = useTranslations("checkout.flow");
  const line = `${a.address}, ${a.city}, ${a.state} - ${a.pincode}`;
  if (inline) return <>{a.name}, {line}</>;
  return (
    <span className="leading-relaxed">
      <span className="block font-medium">{a.name}</span>
      <span className="block text-chocolate/75">{line}</span>
      <span className="block text-chocolate/75">{t("phone", { phone: a.phone })}</span>
    </span>
  );
}
