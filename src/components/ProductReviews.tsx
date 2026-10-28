import { getTranslations } from "next-intl/server";
import ReviewForm from "./ReviewForm";
import Stars from "./Stars";
import type { Review, ReviewSummary } from "@/lib/review";

const reviewDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

// The reviews section of a product page: star summary, the write/edit form and the reviews
export default async function ProductReviews({ slug, summary, reviews }: { slug: string; summary: ReviewSummary; reviews: Review[] }) {
  const t = await getTranslations("products.reviews");

  return (
    <section id="reviews" className="mx-auto max-w-7xl scroll-mt-28 px-5 pb-20 md:px-8">
      <div className="border-t border-chocolate/10 pt-14">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h2 className="mt-3 text-3xl font-light">{t("title")}</h2>

        <div className="mt-10 grid gap-12 lg:grid-cols-[20rem_1fr] lg:gap-16">
          <div className="h-fit lg:sticky lg:top-28">
            {summary.count > 0 && (
              <div className="mb-8">
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-light">{summary.average.toFixed(1)}</span>
                  <span className="pb-1.5">
                    <Stars rating={summary.average} label={t("outOf5", { rating: summary.average })} className="h-5 w-5" />
                  </span>
                </div>
                <p className="mt-2 text-sm text-chocolate/60">{t("count", { count: summary.count })}</p>
                <ul className="mt-6 space-y-2">
                  {summary.byStars.map((n, i) => (
                    <li key={i} className="flex items-center gap-3 text-xs" aria-label={t("starRow", { stars: 5 - i, count: n })}>
                      <span className="w-3 text-chocolate/70" aria-hidden="true">{5 - i}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-chocolate/10" aria-hidden="true">
                        <span className="block h-full rounded-full bg-gold" style={{ width: `${(n / summary.count) * 100}%` }} />
                      </span>
                      <span className="w-6 text-right text-chocolate/60" aria-hidden="true">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ReviewForm slug={slug} />
          </div>

          {reviews.length === 0 ? (
            <p className="text-chocolate/70">{t("empty")}</p>
          ) : (
            <ul className="divide-y divide-chocolate/10 border-y border-chocolate/10">
              {reviews.map((r) => (
                <li key={r.id} className="py-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Stars rating={r.rating} label={t("outOf5", { rating: r.rating })} />
                    <time dateTime={r.createdAt} className="text-xs text-chocolate/50">
                      {reviewDate.format(new Date(r.createdAt))}
                    </time>
                  </div>
                  {r.title && <h3 className="mt-3 font-medium">{r.title}</h3>}
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-chocolate/80">{r.text}</p>
                  <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-chocolate/60">
                    <span className="font-medium text-chocolate">{r.name}</span>
                    {r.verified && (
                      <span className="rounded-full bg-green-700/10 px-2.5 py-0.5 text-[0.65rem] uppercase tracking-[0.12em] text-green-800">
                        {t("verified")}
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
