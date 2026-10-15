const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

// 1499 -> "₹1,499"
export function formatPrice(amount: number) {
  return inr.format(amount);
}
