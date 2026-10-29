import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { defaultPaymentSettings, type PaymentSettings } from "@/lib/payments";
import { getDb, type PaymentSettingsDoc } from "./db";

// Which payment methods are on, or the defaults (Razorpay only) until an admin saves them.
// Cached across requests; saving calls refreshPaymentSettings() so the shop updates straight away.
export const getPaymentSettings = unstable_cache(
  async (): Promise<PaymentSettings> => {
    const doc = (await (await getDb()).settings.findOne({ _id: "payments" })) as PaymentSettingsDoc | null;
    if (!doc) return defaultPaymentSettings;
    return { razorpay: doc.razorpay, cod: doc.cod, whatsapp: doc.whatsapp, whatsappMessage: doc.whatsappMessage };
  },
  ["payment-settings"],
  { tags: ["payment-settings"] },
);

export function refreshPaymentSettings() {
  revalidateTag("payment-settings", { expire: 0 });
}
