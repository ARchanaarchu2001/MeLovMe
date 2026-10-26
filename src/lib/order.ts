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

// An order as the checkout page sees it
export type Order = {
  id: string;
  address: Address;
  items: { name: string; size: string; qty: number; price: number; total: number }[];
  subtotal: number;
  shipping: number;
  total: number;
  razorpayOrderId: string;
};

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
export const fulfillmentLabels: Record<Fulfillment, string> = {
  placed: "Order placed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
