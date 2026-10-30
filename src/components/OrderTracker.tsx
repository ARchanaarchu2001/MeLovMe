import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { Fulfillment } from "@/lib/order";

const steps = ["placed", "packed", "shipped", "delivered"] as const;

const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

const icons: Record<(typeof steps)[number], ReactNode> = {
  // Receipt
  placed: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6" />,
  // Box
  packed: <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 0v0M4 7l8 4 8-4M12 11v10" />,
  // Truck
  shipped: <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />,
  // House with a tick
  delivered: <path d="M4 11 12 4l8 7v9H4v-9Zm5 4 2 2 4-4" />,
};

// Where the customer's order is, as a row of steps (a column on phones): done steps in gold with
// their date, the current one highlighted, the rest still to come. Cancelled orders get a notice.
export default function OrderTracker({ status, placedAt, history, courier, trackingNumber }: {
  status: Fulfillment;
  placedAt: Date;
  history: { status: Fulfillment; at: Date }[];
  courier?: string;
  trackingNumber?: string;
}) {
  const t = useTranslations("account");

  // The latest time each status was set (an admin may go back and forth)
  const dateOf = (s: Fulfillment) => (s === "placed" ? placedAt : history.findLast((h) => h.status === s)?.at);

  if (status === "cancelled") {
    const at = dateOf("cancelled");
    return (
      <div className="mt-6 md:mt-10 rounded-[2rem] border border-red-700/20 bg-red-700/5 px-6 py-5 text-left">
        <p className="font-medium text-red-800">{t("tracker.cancelledTitle")}</p>
        <p className="mt-1 text-sm text-chocolate/75">{t("tracker.cancelledText")}</p>
        {at && <p className="mt-2 text-xs text-chocolate/55">{when.format(at)}</p>}
      </div>
    );
  }

  const current = steps.indexOf(status);

  return (
    <div className="mt-6 md:mt-10 rounded-[2rem] border border-chocolate/15 px-6 py-7 text-left sm:px-8">
      <p className="text-xs uppercase tracking-[0.2em] text-chocolate/60">{t("order.status")}</p>
      <p className="mt-1 text-lg font-medium">{t(`tracker.headline.${steps[current]}`)}</p>

      <ol className="mt-7 grid gap-0 sm:grid-cols-4">
        {steps.map((step, i) => {
          const done = i <= current;
          const isCurrent = i === current;
          const at = done ? dateOf(step) : undefined;
          return (
            <li key={step} className="relative flex gap-4 pb-7 last:pb-0 sm:flex-col sm:items-center sm:gap-3 sm:pb-0 sm:text-center">
              {/* Line to the next step: down on phones, across on larger screens */}
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute left-5 top-11 bottom-1 w-0.5 -translate-x-1/2 rounded-full sm:left-[calc(50%+1.75rem)] sm:right-[calc(-50%+1.75rem)] sm:top-5 sm:bottom-auto sm:h-0.5 sm:w-auto sm:translate-x-0 ${
                    i < current ? "bg-gold" : "bg-chocolate/15"
                  }`}
                />
              )}
              <span
                className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                  isCurrent
                    ? "bg-espresso text-gold ring-4 ring-gold/25"
                    : done
                      ? "bg-gold text-espresso"
                      : "border-2 border-dashed border-chocolate/20 text-chocolate/30"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {icons[step]}
                </svg>
              </span>
              <span className="min-w-0 pt-1 sm:pt-0">
                <span className={`block text-sm ${done ? "font-medium text-chocolate" : "text-chocolate/45"}`}>
                  {t(`status.${step}`)}
                  <span className="sr-only">: {isCurrent ? t("tracker.current") : done ? t("tracker.done") : t("tracker.upcoming")}</span>
                </span>
                {at && <span className="mt-0.5 block text-xs text-chocolate/55">{when.format(at)}</span>}
                {step === "shipped" && done && trackingNumber && (
                  <span className="mt-1 block text-xs text-chocolate/70">
                    {courier ? `${courier} · ` : ""}
                    {t("order.tracking", { number: trackingNumber })}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
