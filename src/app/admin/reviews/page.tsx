import type { Metadata } from "next";
import Link from "next/link";
import type { Filter } from "mongodb";
import Stars from "@/components/Stars";
import ReviewActions from "@/components/admin/ReviewActions";
import ReviewProductFilter from "@/components/admin/ReviewProductFilter";
import { Pagination, SearchBox, Stat, formatDateTime, searchRegex } from "@/components/admin/ui";
import { getDb, type ReviewDoc } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Reviews" };

const views = [
  { key: "all", label: "All", filter: {} },
  { key: "customer", label: "By customers", filter: { source: "customer" } },
  { key: "admin", label: "Added by admin", filter: { source: "admin" } },
  { key: "hidden", label: "Hidden", filter: { hidden: true } },
] as const satisfies readonly { key: string; label: string; filter: Filter<ReviewDoc> }[];

const PAGE_SIZE = 15;

export default async function AdminReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  await requireAdmin("/admin/reviews/");
  const sp = await searchParams;
  const view = views.find((v) => v.key === sp.view) ?? views[0];
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const product = typeof sp.product === "string" ? sp.product : "";
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);

  // Search by reviewer name, title or text; optionally one product
  const filter: Filter<ReviewDoc> = { ...view.filter, ...(product && { productSlug: product }) };
  if (q) {
    const re = searchRegex(q);
    filter.$or = [{ name: re }, { title: re }, { text: re }];
  }

  const { reviews, products, users } = await getDb();
  const [list, total, counts, productList, perProduct] = await Promise.all([
    reviews.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray(),
    reviews.countDocuments(filter),
    Promise.all(views.map((v) => reviews.countDocuments({ ...v.filter, ...(product && { productSlug: product }) }))),
    products.find({}, { projection: { name: 1, images: 1 } }).sort({ name: 1 }).toArray(),
    // Reviews per product in the current tab, shown next to each name in the product filter
    reviews.aggregate<{ _id: string; n: number }>([{ $match: view.filter }, { $group: { _id: "$productSlug", n: { $sum: 1 } } }]).toArray(),
  ]);
  const productName = new Map(productList.map((p) => [p._id, p.name]));
  const reviewCount = new Map(perProduct.map((r) => [r._id, r.n]));
  // The customer account behind each customer review
  const accounts = new Map(
    (
      await users
        .find({ _id: { $in: list.flatMap((r) => (r.userId ? [r.userId] : [])) } }, { projection: { phone: 1 } })
        .toArray()
    ).map((u) => [u._id.toHexString(), u]),
  );
  const href = (params: Record<string, string | number>) =>
    `/admin/reviews/?${new URLSearchParams({
      view: view.key,
      ...(q && { q }),
      ...(product && { product }),
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    })}`;

  return (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="By customers" value={String(counts[1])} href={href({ view: "customer" })} />
        <Stat label="Added by admin" value={String(counts[2])} href={href({ view: "admin" })} />
        <Stat label="Hidden from shop" value={String(counts[3])} href={href({ view: "hidden" })} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {views.map((v, i) => (
            <Link
              key={v.key}
              href={href({ view: v.key })}
              className={`rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.15em] ${
                v.key === view.key ? "bg-gold/25 text-chocolate" : "text-chocolate/60 hover:text-gold"
              }`}
            >
              {v.label} ({counts[i]})
            </Link>
          ))}
        </div>
        <Link href="/admin/reviews/new/" className="btn btn-primary !px-6 !py-3">+ Add review</Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <SearchBox action="/admin/reviews/" q={q} placeholder="Name or review text" hidden={{ view: view.key, ...(product && { product }) }} />
        <ReviewProductFilter
          products={productList.map((p) => ({ slug: p._id, name: p.name, image: p.images?.[0], count: reviewCount.get(p._id) ?? 0 }))}
          value={product}
          view={view.key}
          q={q}
        />
      </div>

      {list.length === 0 ? (
        <p className="py-16 text-center text-chocolate/60">No reviews found.</p>
      ) : (
        <ul className="grid gap-4">
          {list.map((r) => {
            const account = r.userId && accounts.get(r.userId.toHexString());
            return (
              <li
                key={r._id.toHexString()}
                className={`rounded-2xl border p-5 ${r.hidden ? "border-dashed border-chocolate/25 bg-chocolate/[0.03]" : "border-chocolate/15"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className={`min-w-0 flex-1 ${r.hidden ? "opacity-60" : ""}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <Stars rating={r.rating} label={`${r.rating} out of 5 stars`} />
                      <SourceBadge source={r.source} />
                      {r.verified && <span className="rounded-full bg-green-700/10 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-green-800">Verified buyer</span>}
                      {r.hidden && <span className="rounded-full bg-chocolate/10 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-chocolate/70">Hidden</span>}
                    </div>
                    {r.title && <p className="mt-2 font-medium">{r.title}</p>}
                    <p className="mt-1 whitespace-pre-line text-sm text-chocolate/80">{r.text}</p>
                    <p className="mt-3 text-xs text-chocolate/60">
                      <span className="font-medium text-chocolate">{r.name}</span>
                      {account && <> · +91 {account.phone}</>} · {formatDateTime(r.createdAt)} ·{" "}
                      <Link href={`/admin/products/${r.productSlug}/`} className="hover:text-gold">
                        {productName.get(r.productSlug) ?? r.productSlug}
                      </Link>
                    </p>
                  </div>
                  <ReviewActions id={r._id.toHexString()} hidden={r.hidden} editable={r.source === "admin"} by={r.name} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} href={(p) => href({ page: p })} />
    </div>
  );
}

function SourceBadge({ source }: { source: ReviewDoc["source"] }) {
  const pill = "rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em]";
  return source === "admin" ? (
    <span className={`${pill} bg-chocolate text-ivory`}>Added by admin</span>
  ) : (
    <span className={`${pill} bg-gold/20 text-chocolate`}>Customer</span>
  );
}
