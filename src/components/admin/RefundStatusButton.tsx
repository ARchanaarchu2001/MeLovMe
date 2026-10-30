"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { checkRefundStatus } from "@/app/actions/admin";
import { formatPrice } from "@/lib/format";
import type { Refund } from "@/lib/order";
import { ConfirmDialog } from "./actions";

type Result = Awaited<ReturnType<typeof checkRefundStatus>>[number];

const labels: Record<Refund["status"], string> = {
  pending: "Refund initiated · still in progress",
  processed: "Refunded · money sent back",
  failed: "Refund failed",
};
const colors: Record<Refund["status"], string> = {
  pending: "bg-sky-700/10 text-sky-900",
  processed: "bg-green-700/10 text-green-800",
  failed: "bg-red-700/10 text-red-800",
};

const refreshIcon = (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" />
  </svg>
);

// "Check refund status": after a confirmation, asks Razorpay for the latest on pending refunds,
// for one order (`orderId`) or every order with a pending refund, and lists what it said.
// Razorpay is only asked when this is confirmed.
export default function RefundStatusButton({ orderId, pending }: { orderId?: string; pending: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [busy, startTransition] = useTransition();

  const check = () =>
    startTransition(async () => {
      const res = await checkRefundStatus(orderId);
      setResults(res);
      setConfirming(false);
      router.refresh();
    });

  const many = pending === 1 ? "1 refund" : `${pending} refunds`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={busy || pending === 0}
          className="inline-flex items-center gap-2 rounded-full border border-sky-700/30 bg-sky-700/5 px-4 py-2 text-xs uppercase tracking-[0.15em] text-sky-900 transition-colors hover:bg-sky-700/10 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" />
          </svg>
          Check refund status
          {pending > 0 && <span className="rounded-full bg-sky-700/15 px-1.5 text-[0.65rem]">{pending}</span>}
        </button>
        {pending === 0 && !results && <span className="text-xs text-chocolate/60">No refunds waiting for Razorpay.</span>}
      </div>

      {/* What Razorpay said, refund by refund */}
      {results && (
        <div className="mt-3 rounded-xl border border-chocolate/10 bg-white/50 p-3 text-sm" role="status">
          <p className="mb-2 text-xs uppercase tracking-[0.15em] text-chocolate/60">Razorpay says</p>
          {results.length === 0 ? (
            <p className="text-chocolate/70">No refunds were waiting.</p>
          ) : (
            <ul className="divide-y divide-chocolate/10">
              {results.map((r) => (
                <li key={r.refundId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {!orderId && <span className="mr-2 font-medium">{r.orderId}</span>}
                    {formatPrice(r.amount)}
                  </span>
                  {r.status ? (
                    <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${colors[r.status]}`}>
                      {labels[r.status]}
                    </span>
                  ) : (
                    <span className="text-xs text-red-700">Couldn&apos;t reach Razorpay, try again</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          tone="neutral"
          title="Check refund status?"
          subject={orderId ? `Order ${orderId} · ${many}` : `${many} in progress`}
          icon={refreshIcon}
          text="This asks Razorpay for the latest status of refunds still shown as “Refund initiated”, and updates them here: refunded, still in progress, or failed."
          confirmLabel="Yes, check now"
          pendingLabel="Checking with Razorpay…"
          pending={busy}
          onConfirm={check}
          onClose={() => !busy && setConfirming(false)}
        />
      )}
    </div>
  );
}
