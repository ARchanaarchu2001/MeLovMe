"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { getMyReview, saveMyReview } from "@/app/actions/reviews";
import Spinner from "./Spinner";
import { reviewLimits, type ReviewInput } from "@/lib/review";

const input = "w-full rounded-xl border border-chocolate/20 bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-gold";
const label = "mb-1.5 block text-xs uppercase tracking-[0.15em] text-chocolate/60";

type Me = Awaited<ReturnType<typeof getMyReview>>;

// "Write a review" on a product page. The page is cached for everyone, so whether the visitor is
// logged in (and their earlier review, which they can edit) is asked for from the browser.
export default function ReviewForm({ slug }: { slug: string }) {
  const t = useTranslations("products.reviews");
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<ReviewInput>({ name: "", rating: 0, title: "", text: "" });
  const [hover, setHover] = useState(0);
  const [error, setError] = useState<{ message: string; field?: keyof ReviewInput } | null>(null);
  const [done, setDone] = useState<"thanks" | "updated" | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let live = true;
    getMyReview(slug)
      .then((res) => live && setMe(res))
      .catch(() => live && setMe({ loggedIn: false }));
    return () => {
      live = false;
    };
  }, [slug]);

  // Space for the button while we check, so the layout doesn't jump
  if (!me) return <div className="h-12" />;

  if (!me.loggedIn) {
    return (
      <Link href={`/login/?next=${encodeURIComponent(`/products/${slug}/#reviews`)}`} className="btn btn-outline">
        {t("loginToWrite")}
      </Link>
    );
  }

  const isEdit = !!me.review;

  if (!open) {
    return (
      <div>
        {done && <p className="mb-4 text-sm text-green-800" role="status">{t(`form.${done}`)}</p>}
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            setV(me.review ?? { name: me.name, rating: 0, title: "", text: "" });
            setError(null);
            setDone(null);
            setOpen(true);
          }}
        >
          {isEdit ? t("edit") : t("write")}
        </button>
      </div>
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveMyReview(slug, v);
      if ("error" in res) {
        setError({ message: res.error, field: res.field });
        return;
      }
      setMe({ loggedIn: true, name: v.name, review: v });
      setDone(isEdit ? "updated" : "thanks");
      setOpen(false);
      router.refresh();
    });
  }

  const shown = hover || v.rating;
  const fieldError = (f: keyof ReviewInput) =>
    error?.field === f && <p className="mt-1.5 text-xs text-red-700">{error.message}</p>;

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5 rounded-[2rem] bg-ivory p-6">
      <fieldset>
        <legend className={label}>{t("form.rating")}</legend>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setV({ ...v, rating: n })}
              onMouseEnter={() => setHover(n)}
              aria-label={t("form.star", { count: n })}
              aria-pressed={v.rating === n}
              className="p-0.5 text-gold transition-transform hover:scale-110"
            >
              <svg viewBox="0 0 20 20" className="h-8 w-8" aria-hidden="true">
                <path
                  d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z"
                  fill="currentColor"
                  fillOpacity={n <= shown ? 1 : 0.2}
                />
              </svg>
            </button>
          ))}
        </div>
        {fieldError("rating")}
      </fieldset>

      <label>
        <span className={label}>{t("form.name")}</span>
        <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={reviewLimits.name} className={input} />
        {fieldError("name")}
      </label>

      <label>
        <span className={label}>{t("form.title")}</span>
        <input
          value={v.title}
          onChange={(e) => setV({ ...v, title: e.target.value })}
          maxLength={reviewLimits.title}
          placeholder={t("form.titlePlaceholder")}
          className={input}
        />
      </label>

      <label>
        <span className={label}>{t("form.text")}</span>
        <textarea
          value={v.text}
          onChange={(e) => setV({ ...v, text: e.target.value })}
          maxLength={reviewLimits.text}
          rows={5}
          placeholder={t("form.textPlaceholder")}
          className={`${input} resize-y`}
        />
        {fieldError("text")}
      </label>

      {error && !error.field && <p className="text-sm text-red-700">{error.message}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending && <Spinner />}
          {pending ? t("form.saving") : isEdit ? t("form.update") : t("form.submit")}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs uppercase tracking-[0.15em] text-chocolate/60 hover:text-gold">
          {t("form.cancel")}
        </button>
      </div>
    </form>
  );
}
