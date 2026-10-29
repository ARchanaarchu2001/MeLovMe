// How customers can buy, switched on and off in /admin/payments. Used by the server and the browser.

export type PaymentSettings = {
  razorpay: boolean; // pay online at checkout (UPI, cards, netbanking)
  cod: boolean; // cash on delivery at checkout
  whatsapp: boolean; // "Buy on WhatsApp" button on product pages
  whatsappMessage: string; // the first line of the WhatsApp message; product details are added below it
};

export const defaultPaymentSettings: PaymentSettings = {
  razorpay: true,
  cod: false,
  whatsapp: false,
  whatsappMessage: "Hi MELOVME! I'm interested in this product. Can I know more about the details?",
};

export const WHATSAPP_MESSAGE_MAX = 300;

export type PaymentSettingsErrors = { form?: string; whatsappMessage?: string };

export function validatePaymentSettings(s: PaymentSettings): PaymentSettingsErrors {
  const errors: PaymentSettingsErrors = {};
  // Checkout needs a way to pay; WhatsApp alone can't take orders through the cart
  if (!s.razorpay && !s.cod) errors.form = "Keep Razorpay or Cash on delivery switched on, so customers can check out.";
  const message = s.whatsappMessage.trim();
  if (s.whatsapp && !message) errors.whatsappMessage = "Enter the message customers send.";
  else if (message.length > WHATSAPP_MESSAGE_MAX) errors.whatsappMessage = `Keep it under ${WHATSAPP_MESSAGE_MAX} characters.`;
  return errors;
}

// The WhatsApp message for one product: the shop's opening line, then what they're looking at
export function whatsappProductMessage(intro: string, p: { name: string; size: string; price: string; url: string }) {
  return `${intro.trim()}\n\n• ${p.name} (${p.size})\n• Price: ${p.price}\n• ${p.url}`;
}
