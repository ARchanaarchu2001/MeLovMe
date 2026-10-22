"use server";

import { ObjectId } from "mongodb";
import { getProduct } from "@/data/products";
import { addressFields, MAX_QTY, shippingFor, validateAddress, type Address, type CartItem, type Order, type SavedAddress } from "@/lib/order";
import { getDb, type OrderDoc } from "@/lib/server/db";
import { markOrderPaid } from "@/lib/server/orders";
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
): Promise<{ errors: ReturnType<typeof validateAddress> } | SavedAddress> {
  const user = await requireUser("/checkout/");
  // Keep only the known fields, as trimmed strings
  const address = Object.fromEntries(addressFields.map((f) => [f, String(input?.[f] ?? "").trim()])) as Address;
  const errors = validateAddress(address);
  if (Object.keys(errors).length) return { errors };
  const { users } = await getDb();

  if (id) {
    const _id = findAddressId(user, id);
    if (!_id) return { errors: { address: "This address no longer exists. Please add it again." } };
    await users.updateOne({ _id: user._id, "addresses._id": _id }, { $set: { "addresses.$": { ...address, _id } } });
    return { ...address, id };
  }

  if (user.addresses.length >= MAX_ADDRESSES) {
    return { errors: { address: `You can save up to ${MAX_ADDRESSES} addresses.` } };
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

// Creates the order and its Razorpay order before payment, so the payment is tied to it.
// Prices come from the catalogue on the server, never from the browser.
export async function createOrder(addressId: string, cart: CartItem[]): Promise<{ error: string } | Order> {
  const user = await requireUser("/checkout/");
  const address = user.addresses.find((a) => a._id.toHexString() === addressId);
  if (!address) return { error: "Please choose a delivery address." };

  const items = (Array.isArray(cart) ? cart : []).flatMap((i) => {
    const product = getProduct(i?.slug);
    const qty = Math.min(Number(i?.qty), MAX_QTY);
    if (!product || !Number.isInteger(qty) || qty < 1) return [];
    return [{ slug: product.slug, name: product.name, size: product.size, qty, price: product.price, total: product.price * qty }];
  });
  if (!items.length) return { error: "Your cart is empty." };

  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const shipping = shippingFor(subtotal);
  const shipTo = Object.fromEntries(addressFields.map((f) => [f, address[f]])) as Address;
  const id = newOrderId();
  const total = subtotal + shipping;
  let razorpayOrderId: string;
  try {
    razorpayOrderId = await createRazorpayOrder(total, id);
  } catch (err) {
    console.error(err);
    return { error: "We couldn't start the payment right now. Please try again shortly." };
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
  if (!order) return { error: "We couldn't find this order." };

  const paymentId = String(payment?.razorpay_payment_id ?? "");
  // Use our own record of the Razorpay order ID, never one sent by the browser
  if (!paymentId || !isValidPaymentSignature(order.razorpayOrderId, paymentId, payment?.razorpay_signature)) {
    return { error: `We couldn't confirm your payment. If money was deducted, please contact us with order ID ${order._id}.` };
  }
  await markOrderPaid(order.razorpayOrderId, paymentId);
  return { ok: true };
}
