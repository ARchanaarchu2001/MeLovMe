import { site } from "@/data/site";

// A shipping address as entered at checkout and saved to the customer's account
export type Address = {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
};

export type SavedAddress = Address & { id: string };

export type CartItem = { slug: string; qty: number };

export const MAX_QTY = 10;

export function shippingFor(subtotal: number) {
  return subtotal >= site.shipping.freeAbove ? 0 : site.shipping.fee;
}

// An order as the checkout page sees it while the customer pays online
export type Order = {
  id: string;
  address: Address;
  items: { name: string; size: string; qty: number; price: number; total: number }[];
  subtotal: number;
  shipping: number;
  total: number;
  razorpayOrderId: string;
};

export const paymentMethods = ["razorpay", "cod"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export type OrderStatus = "awaiting_payment" | "cod" | "paid";
// Real orders, to pack and ship: paid online, or placed with cash on delivery
export const placedStatuses = ["paid", "cod"] as const satisfies readonly OrderStatus[];
export const isPlaced = (status: OrderStatus) => (placedStatuses as readonly string[]).includes(status);

// A refund made through Razorpay. `amount` in rupees. Razorpay reports "pending" until the money
// is on its way back ("processed"), or "failed".
export type Refund = { id: string; amount: number; status: "pending" | "processed" | "failed"; createdAt: Date; updatedAt?: Date };

// Where an order's refunds stand: how much is refunded or on its way, and what's left to refund
export function refundState(order: { total: number; refunds?: Refund[] }) {
  const live = (order.refunds ?? []).filter((r) => r.status !== "failed");
  const refunded = live.reduce((sum, r) => sum + r.amount, 0);
  const pending = live.some((r) => r.status === "pending");
  const label = !order.refunds?.length
    ? null
    : pending
      ? "Refund initiated"
      : refunded >= order.total
        ? "Refunded"
        : refunded > 0
          ? "Partly refunded"
          : "Refund failed";
  return { refunded, pending, refundable: Math.max(0, order.total - refunded), label };
}

export const addressFields = ["name", "phone", "address", "city", "state", "pincode"] as const;

// Why a field is invalid; the message for each is in checkout.address.errors
export type AddressError = "required" | "invalidPhone" | "invalidPincode";

// Returns an error code per invalid field (empty object when the address is valid)
export function validateAddress(a: Address) {
  const errors: Partial<Record<keyof Address, AddressError>> = {};
  for (const f of addressFields) if (!a[f]?.trim()) errors[f] = "required";
  if (a.phone && !/^[6-9]\d{9}$/.test(a.phone)) errors.phone = "invalidPhone";
  if (a.pincode && !/^[1-9]\d{5}$/.test(a.pincode)) errors.pincode = "invalidPincode";
  return errors;
}

// Where a paid order is, as set by the shop in /admin/orders
export const fulfillments = ["placed", "packed", "shipped", "delivered", "cancelled"] as const;
export type Fulfillment = (typeof fulfillments)[number];
// Customers can cancel an order themselves until it ships
export const customerCancellable = (fulfillment: Fulfillment | undefined) => (fulfillment ?? "placed") === "placed" || fulfillment === "packed";
export const fulfillmentLabels: Record<Fulfillment, string> = {
  placed: "Order placed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
