import Link from "next/link";
import { fulfillmentLabels, type Fulfillment } from "@/lib/order";
import { LOW_STOCK } from "@/lib/product";
import type { PaymentDetails } from "@/lib/server/razorpay";

const dateTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});
const dateOnly = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
export const formatDateTime = (d: Date) => dateTime.format(d);
export const formatDate = (d: Date) => dateOnly.format(d);
export const daysAgo = (days: number) => new Date(Date.now() - days * 864e5);
// Midnight today, India time
export const startOfTodayIndia = () =>
  new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}T00:00:00+05:30`);

// Escapes text typed into a search box for use in a MongoDB regex
export const searchRegex = (q: string) => new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

const pill = "inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em]";

export function PaymentBadge({ status }: { status: "paid" | "awaiting_payment" }) {
  return status === "paid" ? (
    <span className={`${pill} bg-green-700/10 text-green-800`}>Paid</span>
  ) : (
    <span className={`${pill} bg-chocolate/10 text-chocolate/70`}>Awaiting payment</span>
  );
}

// How an order was paid, e.g. "PhonePe · UPI", "Visa card ••4242", "Netbanking · HDFC"
export function paymentLabel(p: PaymentDetails) {
  const methods: Record<string, string> = { upi: "UPI", card: "Card", netbanking: "Netbanking", wallet: "Wallet", emi: "EMI", paylater: "Pay Later" };
  const method = methods[p.method] ?? p.method;
  if (p.method === "upi") return p.app ? `${p.app} · UPI` : "UPI";
  if (p.method === "card") return [p.card?.network, "card", p.card?.last4 && `••${p.card.last4}`].filter(Boolean).join(" ");
  if (p.method === "netbanking" && p.bank) return `Netbanking · ${p.bank}`;
  if (p.method === "wallet" && p.wallet) return `Wallet · ${p.wallet}`;
  return method;
}

const fulfillmentColors: Record<Fulfillment, string> = {
  placed: "bg-gold/20 text-chocolate",
  packed: "bg-sky-700/10 text-sky-900",
  shipped: "bg-indigo-700/10 text-indigo-900",
  delivered: "bg-green-700/10 text-green-800",
  cancelled: "bg-red-700/10 text-red-800",
};

export function FulfillmentBadge({ status }: { status: Fulfillment }) {
  return <span className={`${pill} ${fulfillmentColors[status]}`}>{fulfillmentLabels[status]}</span>;
}

// "In stock · 12", "Low stock · 3", "Out of stock" for the admin; null = no count saved yet
export function StockBadge({ stock }: { stock: number | null }) {
  if (stock === null || !Number.isFinite(stock)) return <span className={`${pill} bg-chocolate/10 text-chocolate/70`}>Stock not set</span>;
  if (stock <= 0) return <span className={`${pill} bg-red-700/10 text-red-800`}>Out of stock</span>;
  if (stock <= LOW_STOCK) return <span className={`${pill} bg-amber-600/15 text-amber-900`}>Low stock · {stock}</span>;
  return <span className={`${pill} bg-green-700/10 text-green-800`}>In stock · {stock}</span>;
}

export function AdminBadge() {
  return <span className={`${pill} bg-chocolate text-ivory`}>Admin</span>;
}

// A number tile for dashboards. `href` makes it a link to the matching list.
export function Stat({ label, value, note, href }: { label: string; value: string; note?: string; href?: string }) {
  const body = (
    <>
      <p className="text-xs uppercase tracking-[0.15em] text-chocolate/60">{label}</p>
      <p className="mt-1 text-2xl font-medium">{value}</p>
      {note && <p className="mt-1 text-xs text-chocolate/60">{note}</p>}
    </>
  );
  const box = "block rounded-2xl bg-ivory px-5 py-4";
  return href ? (
    <Link href={href} className={`${box} transition-colors hover:bg-gold/15`}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

// Page numbers to show: always the first and last, the current one and its neighbours, with
// gaps ("…") between, e.g. 1 … 4 5 6 … 12
function pageList(page: number, pages: number) {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...keep].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? (["gap", p] as const) : ([p] as const)));
}

// "Showing 11–20 of 34" with Previous / page numbers / Next. `href(n)` builds the link to page n
// (keeping the current filters). Hidden when everything fits on one page.
export function Pagination({ page, pageSize, total, href }: { page: number; pageSize: number; total: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const step = "flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm transition-colors";
  const off = `${step} cursor-default text-chocolate/30`;

  return (
    <nav className="mt-6 flex flex-wrap items-center justify-between gap-4" aria-label="Pages">
      <p className="text-sm text-chocolate/60">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {page > 1 ? (
          <Link href={href(page - 1)} className={`${step} hover:bg-chocolate/5`} rel="prev">← Previous</Link>
        ) : (
          <span className={off}>← Previous</span>
        )}
        {pageList(page, pages).map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} className="px-1 text-chocolate/40">…</span>
          ) : p === page ? (
            <span key={p} aria-current="page" className={`${step} bg-chocolate font-medium text-ivory`}>{p}</span>
          ) : (
            <Link key={p} href={href(p)} className={`${step} hover:bg-chocolate/5`}>{p}</Link>
          ),
        )}
        {page < pages ? (
          <Link href={href(page + 1)} className={`${step} hover:bg-chocolate/5`} rel="next">Next →</Link>
        ) : (
          <span className={off}>Next →</span>
        )}
      </div>
    </nav>
  );
}

// A GET form, so searches and filters live in the URL and survive reloads
export function SearchBox({ action, q, placeholder, hidden = {} }: {
  action: string;
  q: string;
  placeholder: string;
  hidden?: Record<string, string>;
}) {
  return (
    <form action={action} className="flex w-full max-w-md gap-2">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 rounded-full border border-chocolate/20 bg-white/60 px-5 py-2.5 text-sm outline-none focus:border-gold"
      />
      <button type="submit" className="btn btn-primary !px-5 !py-2.5">Search</button>
      {q && (
        <Link href={action + (Object.keys(hidden).length ? `?${new URLSearchParams(hidden)}` : "")} className="self-center text-xs uppercase tracking-[0.15em] text-chocolate/60 hover:text-gold">
          Clear
        </Link>
      )}
    </form>
  );
}
