import type { Metadata } from "next";
import PaymentSettingsForm from "@/components/admin/PaymentSettingsForm";
import { getPaymentSettings } from "@/lib/server/payments";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Payments" };

// How customers can buy: online payment or cash on delivery
export default async function PaymentsPage() {
  await requireAdmin("/admin/payments/");
  return (
    <div>
      <h2 className="mb-6 text-2xl font-medium">Payment methods</h2>
      <PaymentSettingsForm initial={await getPaymentSettings()} />
    </div>
  );
}
