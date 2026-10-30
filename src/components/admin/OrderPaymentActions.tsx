"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markCodPaid, refundOrder } from "@/app/actions/admin";
import Spinner from "@/components/Spinner";
import { onlyDigits } from "@/lib/admin-validation";
import { formatPrice } from "@/lib/format";
import type { Refund } from "@/lib/order";
import { ConfirmDialog } from "./actions";
import RefundStatusButton from "./RefundStatusButton";

const refundColors: Record<Refund["status"], string> = {
  pending: "bg-sky-700/10 text-sky-900",
  processed: "bg-green-700/10 text-green-800",
  failed: "bg-red-700/10 text-red-800",
};
const refundLabels: Record<Refund["status"], string> = { pending: "Refund initiated", processed: "Refunded", failed: "Failed" };

// Cash on delivery: once the courier has collected the cash, the shop marks the order paid
export function MarkCodPaid({ orderId, total }: { orderId: string; total: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      const res = await markCodPaid(orderId);
      if ("error" in res) return setError(res.error);
      router.refresh();
    });

  return (
    <div className="mt-4 rounded-xl bg-amber-600/10 p-4">
      <p className="text-sm text-amber-900">Cash on delivery: collect {formatPrice(total)} when it&apos;s delivered.</p>
      {confirming ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Cash of {formatPrice(total)} received?</span>
          <button type="button" onClick={confirm} disabled={pending} className="btn btn-primary !px-5 !py-2 text-xs">
            {pending && <Spinner />}
            Yes, mark paid
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="text-xs uppercase tracking-[0.15em] text-chocolate/60 hover:text-chocolate">
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="btn btn-outline mt-3 !px-5 !py-2 text-xs">
          Mark cash received
        </button>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}

// Refunds made so far, and a box to refund part or all of what's left through Razorpay
// (not once the order is delivered)
export function RefundPanel({ orderId, refunds, refundable, total, delivered }: {
  orderId: string;
  refunds: Refund[];
  refundable: number;
  total: number;
  delivered: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(refundable));
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const value = Number(amount);

  function ask() {
    setError("");
    if (!(value >= 1)) return setError("Enter the amount to refund.");
    if (value > refundable) return setError(`You can refund up to ${formatPrice(refundable)}.`);
    setConfirming(true);
  }

  const refund = () =>
    startTransition(async () => {
      const res = await refundOrder(orderId, value);
      setConfirming(false);
      if ("error" in res) return setError(res.error);
      router.refresh();
    });

  return (
    <div className="mt-6 border-t border-chocolate/10 pt-5">
      <h4 className="mb-3 text-xs uppercase tracking-[0.2em] text-chocolate/60">Refunds</h4>
      {/* Razorpay is only asked when pressed (and confirmed); greyed out when nothing is pending */}
      {refunds.length > 0 && (
        <div className="mb-4">
          <RefundStatusButton orderId={orderId} pending={refunds.filter((r) => r.status === "pending").length} />
        </div>
      )}
      {refunds.length > 0 && (
        <ul className="mb-4 divide-y divide-chocolate/10 rounded-xl border border-chocolate/10 text-sm">
          {refunds.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <span>
                <span className="font-medium">{formatPrice(r.amount)}</span>
                <span className="ml-2 font-mono text-xs text-chocolate/50">{r.id}</span>
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${refundColors[r.status]}`}>
                {refundLabels[r.status]}
              </span>
            </li>
          ))}
        </ul>
      )}

      {refundable === 0 ? (
        <p className="text-sm text-chocolate/70">The full {formatPrice(total)} has been refunded.</p>
      ) : delivered ? (
        <p className="rounded-xl bg-chocolate/5 px-4 py-3 text-sm text-chocolate/70">
          Refunds aren&apos;t available once an order is delivered.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1.5">
              <span className="text-xs text-chocolate/60">Amount (₹), up to {formatPrice(refundable)}</span>
              <input
                value={amount}
                onChange={(e) => {
                  setAmount(onlyDigits(e.target.value));
                  setError("");
                }}
                inputMode="numeric"
                className="w-36 rounded-xl border border-chocolate/20 bg-white/60 px-4 py-2 text-sm outline-none focus:border-gold"
              />
            </label>
            <button type="button" onClick={ask} disabled={pending} className="btn !px-5 !py-2.5 border border-red-700/40 text-xs text-red-800 hover:bg-red-700 hover:text-ivory">
              Refund
            </button>
          </div>
          <p className="mt-2 text-xs text-chocolate/60">
            Sent back through Razorpay to how the customer paid, in 5–7 working days. Delivery status and stock don&apos;t change.
          </p>
        </>
      )}
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}

      {confirming && (
        <ConfirmDialog
          title={`Refund ${formatPrice(value)}?`}
          subject={`Order ${orderId}${value === total ? " · full amount" : ` · of ${formatPrice(total)}`}`}
          icon={<span className="text-2xl font-light">₹</span>}
          text="The money goes back from your Razorpay balance to the customer's UPI, card or bank account in 5–7 working days. This can't be undone."
          confirmLabel="Yes, refund"
          pendingLabel="Refunding…"
          pending={pending}
          onConfirm={refund}
          onClose={() => !pending && setConfirming(false)}
        />
      )}
    </div>
  );
}
