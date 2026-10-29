"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelOrder } from "@/app/actions/orders";
import { ConfirmDialog } from "@/components/admin/actions";

// "Cancel order" on the customer's order page, shown until the order ships
export default function CancelOrderButton({ orderId, paidOnline }: { orderId: string; paidOnline: boolean }) {
  const t = useTranslations("account.order");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const cancel = () =>
    startTransition(async () => {
      const res = await cancelOrder(orderId);
      setConfirming(false);
      if ("error" in res) return setError(res.error);
      router.refresh();
    });

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ivory/60 px-5 py-4 text-left">
      <p className="text-sm text-chocolate/70">{t("cancelHint")}</p>
      <button
        type="button"
        onClick={() => {
          setError("");
          setConfirming(true);
        }}
        className="rounded-full border border-red-700/30 px-5 py-2 text-xs uppercase tracking-[0.2em] text-red-800 transition-colors hover:bg-red-700 hover:text-ivory"
      >
        {t("cancel")}
      </button>
      {error && <p className="w-full text-sm text-red-700" role="alert">{error}</p>}
      {confirming && (
        <ConfirmDialog
          title={t("cancelTitle")}
          subject={orderId}
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="m9 9 6 6M15 9l-6 6" />
            </svg>
          }
          text={paidOnline ? t("cancelTextPaid") : t("cancelText")}
          confirmLabel={t("cancelConfirm")}
          pendingLabel={t("cancelling")}
          cancelLabel={t("keepOrder")}
          pending={pending}
          onConfirm={cancel}
          onClose={() => !pending && setConfirming(false)}
        />
      )}
    </div>
  );
}
