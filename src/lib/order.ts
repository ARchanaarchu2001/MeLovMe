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
};

export const addressFields = ["name", "phone", "address", "city", "state", "pincode"] as const;

// Returns an error message per invalid field (empty object when the address is valid)
export function validateAddress(a: Address) {
  const errors: Partial<Record<keyof Address, string>> = {};
  for (const f of addressFields) if (!a[f]?.trim()) errors[f] = "This field is required.";
  if (a.phone && !/^[6-9]\d{9}$/.test(a.phone)) errors.phone = "Enter a valid 10-digit mobile number.";
  if (a.pincode && !/^[1-9]\d{5}$/.test(a.pincode)) errors.pincode = "Enter a valid 6-digit PIN code.";
  return errors;
}

// UPI deep link: opens a UPI app on phones, and is what the QR code encodes.
// Values are percent-encoded by hand because some UPI apps don't decode "+" as a space.
export function upiLink(order: Order) {
  const enc = encodeURIComponent;
  return `upi://pay?pa=${site.upi.id}&pn=${enc(site.upi.payeeName)}&am=${order.total.toFixed(2)}&cu=INR&tn=${enc(`Order ${order.id}`)}`;
}
