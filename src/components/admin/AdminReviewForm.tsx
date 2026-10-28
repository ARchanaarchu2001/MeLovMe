"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { saveAdminReview } from "@/app/actions/admin";
import Spinner from "@/components/Spinner";
import ProductSelect, { type ProductOption } from "@/components/admin/ProductSelect";
import { RequiredMark } from "@/components/admin/ui";
import { validateAdminReview, type AdminReviewErrors } from "@/lib/admin-validation";
import { reviewLimits, type ReviewInput } from "@/lib/review";

const input =
  "w-full rounded-xl border border-chocolate/20 bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-gold aria-invalid:border-red-700";
const label = "mb-1.5 block text-xs uppercase tracking-[0.15em] text-chocolate/60";

type Errors = AdminReviewErrors;

// Adds a review on behalf of the shop (`id` null), or edits one the shop added.
// It's saved with source "admin", so it's always clear it didn't come from a customer account.
export default function AdminReviewForm({ id, products, initial }: {
  id: string | null;
  products: ProductOption[];
  initial: ReviewInput & { productSlug: string };
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();
  // Editing a field clears its error
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => {
    setV((prev) => ({ ...prev, [k]: value }));
    setErrors((prev) => ({ ...prev, [k]: undefined }));
  };

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const { productSlug, ...review } = v;
    const found = validateAdminReview(productSlug, review);
    if (Object.keys(found).length) return setErrors(found);
    startTransition(async () => {
      const res = await saveAdminReview(id, productSlug, review);
      if ("errors" in res) {
        setErrors(res.errors);
        return;
      }
      router.push("/admin/reviews/?view=admin");
      router.refresh();
    });
  }

  const error = (k: keyof Errors) => errors[k] && <p className="mt-1.5 text-xs text-red-700">{errors[k]}</p>;

  return (
    <form onSubmit={handleSubmit} noValidate className="grid max-w-2xl gap-5">
      <p className="rounded-xl bg-ivory px-4 py-3 text-sm text-chocolate/75">
        For reviews customers sent you another way, e.g. on WhatsApp or Instagram. It&apos;s marked as added by admin
        and never gets the &ldquo;Verified buyer&rdquo; badge.
      </p>

      <div>
        <p className={label}>Product<RequiredMark /></p>
        <ProductSelect
          products={products}
          value={v.productSlug}
          onChange={(slug) => set("productSlug", slug)}
          invalid={!!errors.productSlug}
          className="sm:w-96"
        />
        {error("productSlug")}
      </div>

      <div>
        <p className={label}>Rating<RequiredMark /></p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => set("rating", n)} aria-label={`${n} star${n === 1 ? "" : "s"}`} aria-pressed={v.rating === n} className="p-0.5 text-gold">
              <svg viewBox="0 0 20 20" className="h-8 w-8" aria-hidden="true">
                <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" fill="currentColor" fillOpacity={n <= v.rating ? 1 : 0.2} />
              </svg>
            </button>
          ))}
        </div>
        {error("rating")}
      </div>

      <label>
        <span className={label}>Reviewer name (shown in the shop)<RequiredMark /></span>
        <input value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={reviewLimits.name} aria-invalid={!!errors.name} className={input} />
        {error("name")}
      </label>

      <label>
        <span className={label}>Title (optional)</span>
        <input value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={reviewLimits.title} aria-invalid={!!errors.title} className={input} />
        {error("title")}
      </label>

      <label>
        <span className={label}>Review<RequiredMark /></span>
        <textarea value={v.text} onChange={(e) => set("text", e.target.value)} maxLength={reviewLimits.text} rows={6} aria-invalid={!!errors.text} className={`${input} resize-y`} />
        {error("text")}
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending && <Spinner />}
          {pending ? "Saving…" : id ? "Save changes" : "Add review"}
        </button>
        <Link href="/admin/reviews/" className="text-xs uppercase tracking-[0.15em] text-chocolate/60 hover:text-gold">
          Back to reviews
        </Link>
      </div>
    </form>
  );
}
