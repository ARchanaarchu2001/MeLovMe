"use server";

import { ObjectId } from "mongodb";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import {
  addressFields,
  MAX_QTY,
  paymentMethods,
  shippingFor,
  validateAddress,
  type Address,
  type CartItem,
  type Order,
  type PaymentMethod,
  type SavedAddress,
} from "@/lib/order";
import { lineTotal, priceOf } from "@/lib/product";
import { getDb, type OrderDoc } from "@/lib/server/db";
import { markOrderPaid, notifyShop } from "@/lib/server/orders";
import { getPaymentSettings } from "@/lib/server/payments";
import { adjustStock, getCatalog } from "@/lib/server/products";
import { createRazorpayOrder, isValidPaymentSignature } from "@/lib/server/razorpay";
import { requireUser } from "@/lib/server/session";

const MAX_ADDRESSES = 10;

// The customer's saved address with this ID, if it exists
function findAddressId(user: { addresses: { _id: ObjectId }[] }, id: unknown) {
  return user.addresses.find((a) => a._id.toHexString() === id)?._id ?? null;
}

// Adds a new address, or updates the saved address `id` when given
export async function saveAddress(
  input: Address,
  id?: string,
): Promise<{ errors: Partial<Record<keyof Address, string>> } | SavedAddress> {
  const user = await requireUser("/checkout/");
  // Keep only the known fields, as trimmed strings
  const address = Object.fromEntries(addressFields.map((f) => [f, String(input?.[f] ?? "").trim()])) as Address;
  const invalid = validateAddress(address);
  if (Object.keys(invalid).length) {
    const t = await getTranslations("checkout.address.errors");
    return { errors: Object.fromEntries(Object.entries(invalid).map(([f, code]) => [f, t(code)])) };
  }
  const { users } = await getDb();

  if (id) {
    const _id = findAddressId(user, id);
    if (!_id) return { errors: { address: (await getTranslations("checkout.errors"))("addressGone") } };
    await users.updateOne({ _id: user._id, "addresses._id": _id }, { $set: { "addresses.$": { ...address, _id } } });
    return { ...address, id };
  }

  if (user.addresses.length >= MAX_ADDRESSES) {
    return { errors: { address: (await getTranslations("checkout.errors"))("tooManyAddresses", { max: MAX_ADDRESSES }) } };
  }
  const _id = new ObjectId();
  await users.updateOne({ _id: user._id }, { $push: { addresses: { ...address, _id } } });
  return { ...address, id: _id.toHexString() };
}

// Past orders keep their own copy of the address, so deleting it doesn't change them
export async function deleteAddress(id: string): Promise<{ ok: true }> {
  const user = await requireUser("/checkout/");
  const _id = findAddressId(user, id);
  if (_id) await (await getDb()).users.updateOne({ _id: user._id }, { $pull: { addresses: { _id } } });
  return { ok: true };
}

function newOrderId() {
  const random = Math.random().toString(36).slice(2, 5);
  return `ML-${Date.now().toString(36)}${random}`.toUpperCase();
}

// Online payment: creates the order and its Razorpay order before payment, so the payment is tied
// to it. Cash on delivery: places the order straight away (`placed`).
// Prices come from the catalogue on the server, never from the browser.
export async function createOrder(
  addressId: string,
  cart: CartItem[],
  method: PaymentMethod = "razorpay",
): Promise<{ error: string } | Order | { placed: string }> {
  const user = await requireUser("/checkout/");
  const t = await getTranslations("checkout.errors");
  // Only the methods the shop has switched on in /admin/payments
  if (!paymentMethods.includes(method) || !(await getPaymentSettings())[method]) return { error: t("methodUnavailable") };
  const address = user.addresses.find((a) => a._id.toHexString() === addressId);
  if (!address) return { error: t("chooseAddress") };

  // Only enabled products, at today's price (the offer price while an offer runs)
  const catalog = await getCatalog();
  // One line per product: a product split over several lines must not get past the stock check or MAX_QTY
  const merged = new Map<string, number>();
  for (const i of Array.isArray(cart) ? cart : []) {
    const qty = Number(i?.qty);
    if (typeof i?.slug === "string" && Number.isInteger(qty) && qty > 0) merged.set(i.slug, (merged.get(i.slug) ?? 0) + qty);
  }
  const lines = [...merged].map(([slug, qty]) => ({ slug, qty }));
  // Stock may have run out since the cart was loaded: stop rather than charge for less than they saw
  if (lines.some((i) => catalog.find((p) => p.slug === i.slug)?.inStock === false)) {
    return { error: t("outOfStock") };
  }
  // Nor sell more than there are
  const short = lines.flatMap((i) => {
    const product = catalog.find((p) => p.slug === i.slug);
    return product && product.stock !== null && i.qty > product.stock ? [product] : [];
  });
  if (short.length) return { error: t("notEnoughStock", { name: short[0].name, count: short[0].stock ?? 0 }) };
  const items = lines.flatMap((i) => {
    const product = catalog.find((p) => p.slug === i.slug);
    const qty = Math.min(i.qty, MAX_QTY);
    if (!product || !Number.isInteger(qty) || qty < 1) return [];
    const { price } = priceOf(product);
    // Combo offers apply by quantity, worked out here again (never trusted from the browser)
    const { total, saving } = lineTotal(product, qty);
    return [
      {
        slug: product.slug,
        name: product.name,
        size: product.size,
        qty,
        price,
        total,
        ...(saving > 0 && { comboSaving: saving }),
        image: product.images[0],
      },
    ];
  });
  if (!items.length) return { error: t("cartEmpty") };

  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const shipping = shippingFor(subtotal);
  const shipTo = Object.fromEntries(addressFields.map((f) => [f, address[f]])) as Address;
  const id = newOrderId();
  const total = subtotal + shipping;

  if (method === "cod") {
    // Placed now, like a paid order: ready to pack, and its items leave stock. The shop marks it
    // paid in /admin/orders once the cash is collected.
    const order: OrderDoc = {
      _id: id,
      userId: user._id,
      address: shipTo,
      items,
      subtotal,
      shipping,
      total,
      status: "cod",
      paymentMethod: "cod",
      fulfillment: "placed",
      stockTaken: true,
      createdAt: new Date(),
    };
    await (await getDb()).orders.insertOne(order);
    await adjustStock(items, -1).catch((err) => console.error("Updating stock failed", id, err));
    after(() => notifyShop(order));
    return { placed: id };
  }

  let razorpayOrderId: string;
  try {
    razorpayOrderId = await createRazorpayOrder(total, id);
  } catch (err) {
    console.error(err);
    return { error: t("paymentStartFailed") };
  }

  const order: OrderDoc = {
    _id: id,
    userId: user._id,
    address: shipTo,
    items,
    subtotal,
    shipping,
    total,
    status: "awaiting_payment",
    paymentMethod: "razorpay",
    razorpayOrderId,
    createdAt: new Date(),
  };
  await (await getDb()).orders.insertOne(order);

  return {
    id: order._id,
    address: order.address,
    // Without slugs: the checkout treats items with a slug as still-editable cart lines
    items: items.map(({ name, size, qty, price, total }) => ({ name, size, qty, price, total })),
    subtotal,
    shipping,
    total,
    razorpayOrderId,
  };
}

// Razorpay Checkout reports a successful payment from the browser. The signature proves it
// came from Razorpay; Razorpay's webhook (src/app/api/razorpay/webhook) confirms it again.
export async function confirmPayment(
  orderId: string,
  payment: { razorpay_payment_id: string; razorpay_signature: string },
): Promise<{ error: string } | { ok: true }> {
  const user = await requireUser("/checkout/");
  const order = await (await getDb()).orders.findOne({ _id: String(orderId), userId: user._id });
  const t = await getTranslations("checkout.errors");
  if (!order?.razorpayOrderId) return { error: t("orderNotFound") };

  const paymentId = String(payment?.razorpay_payment_id ?? "");
  // Use our own record of the Razorpay order ID, never one sent by the browser
  if (!paymentId || !isValidPaymentSignature(order.razorpayOrderId, paymentId, payment?.razorpay_signature)) {
    return { error: t("paymentNotConfirmed", { id: order._id }) };
  }
  await markOrderPaid(order.razorpayOrderId, paymentId);
  return { ok: true };
}
