// How customers can buy, switched on and off in /admin/payments. Used by the server and the browser.

export type PaymentSettings = {
  razorpay: boolean; // pay online at checkout (UPI, cards, netbanking)
  cod: boolean; // cash on delivery at checkout
};

export const defaultPaymentSettings: PaymentSettings = {
  razorpay: true,
  cod: false,
};

// With no payment method on, the shop is a catalogue: no cart or Buy Now, customers order on WhatsApp
export const canBuy = (s: PaymentSettings) => s.razorpay || s.cod;
