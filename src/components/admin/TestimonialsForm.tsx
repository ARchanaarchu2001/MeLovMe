"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { saveTestimonials } from "@/app/actions/admin";
import Spinner from "@/components/Spinner";
import Testimonials from "@/components/Testimonials";
import {
  MAX_IMAGE_MB,
  hasTestimonialErrors,
  validateTestimonials,
  type TestimonialErrors,
  type TestimonialRowErrors,
} from "@/lib/admin-validation";
import { testimonialLimits, type Testimonial, type Testimonials as TestimonialsData } from "@/lib/testimonials";
import { IMAGE_TYPES, shrink, uploadToCloudinary } from "@/lib/upload";

const input =
  "w-full rounded-xl border border-chocolate/20 bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-gold aria-invalid:border-red-700";
const label = "mb-1.5 block text-xs uppercase tracking-[0.15em] text-chocolate/60";
// A choice card: gold ring when picked
const card = (on: boolean) =>
  `grid gap-3 rounded-2xl border p-3 text-left transition-all ${
    on ? "border-gold bg-white/70 ring-2 ring-gold/60" : "border-chocolate/15 hover:-translate-y-0.5 hover:border-gold/60 hover:bg-white/40"
  }`;
const iconButton =
  "flex h-9 w-9 items-center justify-center rounded-full text-chocolate/50 hover:bg-chocolate/5 hover:text-chocolate disabled:pointer-events-none disabled:opacity-30";

// Photos are shown small and round, so they don't need many pixels
const PHOTO_MAX_SIDE = 600;

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const emptyReview = (): Testimonial => ({ id: newId(), name: "", place: "", message: "", photo: null });

// Adds, edits and orders the home page reviews, and chooses how they're shown
export default function TestimonialsForm({ initial, heading }: { initial: TestimonialsData; heading: { eyebrow: string; title: string } }) {
  const router = useRouter();
  const [v, setV] = useState<TestimonialsData>(initial);
  const [errors, setErrors] = useState<TestimonialErrors>({});
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const preview = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const update = (patch: Partial<TestimonialsData>) => {
    setV((prev) => ({ ...prev, ...patch }));
    setSaved(false);
    setErrors((prev) => ({ items: prev.items }));
  };
  const setReview = (i: number, patch: Partial<Testimonial>) => {
    update({ items: v.items.map((r, k) => (k === i ? { ...r, ...patch } : r)) });
    // Typing in a field clears that field's message
    setErrors((prev) => ({
      items: prev.items?.map((e, k) => {
        if (k !== i || !e) return e;
        const next: TestimonialRowErrors = { ...e };
        for (const key of Object.keys(patch)) delete next[key as keyof TestimonialRowErrors];
        return Object.keys(next).length ? next : undefined;
      }),
    }));
  };
  const moveReview = (i: number, to: number) => {
    const items = [...v.items];
    const [r] = items.splice(i, 1);
    items.splice(to, 0, r);
    update({ items });
    // Row messages belong to rows by position, so they'd point at the wrong ones after a move
    setErrors({});
  };
  const removeReview = (i: number) => {
    update({ items: v.items.filter((_, k) => k !== i) });
    setErrors({});
  };
  const addReview = () => {
    update({ items: [...v.items, emptyReview()] });
    // Bring the new, empty review into view and put the cursor in it
    requestAnimationFrame(() => {
      const rows = list.current?.querySelectorAll<HTMLElement>("[data-review]");
      const last = rows?.[rows.length - 1];
      last?.scrollIntoView({ behavior: "smooth", block: "center" });
      last?.querySelector("textarea")?.focus({ preventScroll: true });
    });
  };

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateTestimonials(v);
    if (hasTestimonialErrors(found)) return setErrors(found);
    startTransition(async () => {
      const res = await saveTestimonials(v);
      if ("errors" in res) return setErrors(res.errors);
      setErrors({});
      setSaved(true);
      router.refresh();
    });
  }

  const full = v.items.length >= testimonialLimits.items;

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto grid max-w-5xl gap-5">
      {/* Title, with the on/off switch, preview and save on the right */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium">Testimonials</h2>
          <p className="text-sm text-chocolate/60">The &ldquo;{heading.title}&rdquo; reviews on the home page.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-full border py-1.5 pl-4 pr-1.5 text-sm ${
              v.enabled ? "border-green-700/30 bg-green-700/5 text-green-900" : "border-chocolate/20 text-chocolate/70"
            }`}
          >
            {v.enabled ? "Shown on home page" : "Hidden from home page"}
            <input type="checkbox" checked={v.enabled} onChange={(e) => update({ enabled: e.target.checked })} className="peer sr-only" />
            <span
              aria-hidden="true"
              className="relative h-7 w-12 shrink-0 rounded-full bg-chocolate/20 transition-colors peer-checked:bg-green-700 peer-focus-visible:ring-2 peer-focus-visible:ring-gold peer-focus-visible:ring-offset-2 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
            />
          </label>
          <button
            type="button"
            onClick={() => preview.current?.showModal()}
            disabled={!v.items.length}
            className="btn btn-outline disabled:pointer-events-none disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Preview
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending && <Spinner />}
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {hasTestimonialErrors(errors) ? (
        <p className="rounded-xl bg-red-700/10 px-4 py-3 text-sm text-red-800" role="alert">
          {errors.form ?? "Please fix the highlighted reviews."}
        </p>
      ) : saved ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm ${v.enabled ? "bg-green-700/10 text-green-800" : "bg-amber-100 text-amber-900"}`}
          role="status"
        >
          {v.enabled ? "Saved. The home page is updated." : "Saved. The section is hidden, so customers don't see it."}
        </p>
      ) : null}

      {/* 1. Reviews */}
      <Step n={1} title={`Reviews (${v.items.length})`}>
        <p className="-mt-2 mb-4 text-sm text-chocolate/60">
          A photo, the review, and who wrote it. They show in this order; use the arrows to move one up or down.
        </p>
        <div ref={list} className="grid gap-4">
          {v.items.map((r, i) => (
            <ReviewRow
              key={r.id}
              n={i + 1}
              review={r}
              errors={errors.items?.[i]}
              onChange={(patch) => setReview(i, patch)}
              actions={
                <>
                  <button type="button" onClick={() => moveReview(i, i - 1)} disabled={i === 0} className={iconButton} aria-label={`Move review ${i + 1} up`} title="Move up">
                    <Glyph d="m6 15 6-6 6 6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveReview(i, i + 1)}
                    disabled={i === v.items.length - 1}
                    className={iconButton}
                    aria-label={`Move review ${i + 1} down`}
                    title="Move down"
                  >
                    <Glyph d="m6 9 6 6 6-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeReview(i)}
                    className={`${iconButton} hover:!bg-red-700/10 hover:!text-red-700`}
                    aria-label={`Delete review ${i + 1}`}
                    title="Delete"
                  >
                    <Glyph d="M5 7h14M10 7V5h4v2m-7 0 1 12h8l1-12" />
                  </button>
                </>
              }
            />
          ))}
          {!v.items.length && <p className="rounded-xl bg-ivory/60 px-4 py-8 text-center text-sm text-chocolate/50">No reviews yet.</p>}
        </div>
        <button
          type="button"
          onClick={addReview}
          disabled={full}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-chocolate/20 py-4 text-sm text-chocolate/70 hover:border-gold hover:text-chocolate disabled:pointer-events-none disabled:opacity-50"
        >
          <span className="text-lg leading-none text-gold">+</span>
          {full ? `Up to ${testimonialLimits.items} reviews` : "Add a review"}
        </button>
      </Step>

      {/* 2. Display */}
      <Step n={2} title="How they're shown">
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Layout">
          <button type="button" role="radio" aria-checked={v.layout === "grid"} onClick={() => update({ layout: "grid" })} className={card(v.layout === "grid")}>
            <span className="grid grid-cols-3 gap-1.5 rounded-lg bg-ivory/80 p-3" aria-hidden="true">
              {Array.from({ length: 6 }, (_, k) => (
                <span key={k} className="h-7 rounded-md bg-sand/80" />
              ))}
            </span>
            <span className="flex items-start justify-between gap-2 px-0.5">
              <span>
                <span className="block text-sm font-medium">Grid</span>
                <span className="text-xs text-chocolate/60">All reviews at once, three to a row. Best for a few.</span>
              </span>
              <Check on={v.layout === "grid"} />
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={v.layout === "slider"}
            onClick={() => update({ layout: "slider" })}
            className={card(v.layout === "slider")}
          >
            <span className="flex flex-col items-center gap-2 overflow-hidden rounded-lg bg-ivory/80 p-3" aria-hidden="true">
              <span className="flex w-full gap-1.5">
                <span className="h-7 flex-1 rounded-md bg-sand/80" />
                <span className="h-7 flex-1 rounded-md bg-sand/80" />
                <span className="h-7 flex-1 rounded-md bg-sand/80" />
                <span className="-mr-6 h-7 w-6 rounded-md bg-sand/40" />
              </span>
              <span className="flex gap-1.5 text-[0.6rem] text-chocolate/50">
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-chocolate/30">‹</span>
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-chocolate/30">›</span>
              </span>
            </span>
            <span className="flex items-start justify-between gap-2 px-0.5">
              <span>
                <span className="block text-sm font-medium">Slider</span>
                <span className="text-xs text-chocolate/60">One row customers scroll sideways, with arrows. Best for many.</span>
              </span>
              <Check on={v.layout === "slider"} />
            </span>
          </button>
        </div>

        <p className="mt-3 text-xs text-chocolate/60">On phones, reviews always glide past in a slow, endless row. Customers can also swipe it or use the ‹ › arrows.</p>

        {v.layout === "slider" && (
          <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-ivory/60 px-4 py-3">
            <span>
              <span className="block text-sm font-medium">Scroll by itself</span>
              <span className="text-xs text-chocolate/60">Moves to the next review every 5 seconds, and stops while a customer is reading.</span>
            </span>
            <input type="checkbox" checked={v.autoScroll} onChange={(e) => update({ autoScroll: e.target.checked })} className="h-5 w-5 shrink-0 accent-gold" />
          </label>
        )}
      </Step>

      {/* Preview, opened from the button at the top */}
      <dialog
        ref={preview}
        onClick={(e) => e.target === preview.current && preview.current?.close()}
        className="m-auto max-h-[92vh] w-[min(96vw,80rem)] rounded-3xl bg-cream p-0 text-chocolate backdrop:bg-espresso/70 backdrop:backdrop-blur-sm"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-chocolate/10 bg-cream px-5 py-4">
          <h3 className="font-medium">Preview</h3>
          <button
            type="button"
            onClick={() => preview.current?.close()}
            aria-label="Close preview"
            className="flex h-9 w-9 items-center justify-center rounded-full text-chocolate/60 hover:bg-chocolate/10 hover:text-chocolate"
          >
            <Glyph d="M6 6l12 12M18 6 6 18" />
          </button>
        </div>
        <div inert>
          <Testimonials data={v} eyebrow={heading.eyebrow} title={heading.title} />
        </div>
      </dialog>
    </form>
  );
}

function ReviewRow({
  n,
  review: r,
  errors,
  onChange,
  actions,
}: {
  n: number;
  review: Testimonial;
  errors?: TestimonialRowErrors;
  onChange: (patch: Partial<Testimonial>) => void;
  actions: ReactNode;
}) {
  const L = testimonialLimits;
  const id = (field: string) => `review-${r.id}-${field}`;
  return (
    <div data-review className={`rounded-2xl border p-4 ${errors ? "border-red-700/40 bg-red-700/[0.03]" : "border-chocolate/15 bg-white/30"}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.15em] text-chocolate/50">Review {n}</p>
        <div className="flex">{actions}</div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <PhotoPicker photo={r.photo} name={r.name} error={errors?.photo} onChange={(photo) => onChange({ photo })} />
        <div className="grid gap-3">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={id("message")} className={label}>
                Review
              </label>
              <span className={`text-xs tabular-nums ${r.message.length > L.message ? "text-red-700" : "text-chocolate/40"}`}>
                {r.message.length}/{L.message}
              </span>
            </div>
            <textarea
              id={id("message")}
              value={r.message}
              onChange={(e) => onChange({ message: e.target.value })}
              rows={3}
              placeholder="What the customer said, e.g. The body lotion absorbs in seconds…"
              aria-invalid={!!errors?.message}
              className={`${input} resize-y`}
            />
            {errors?.message && <p className="mt-1 text-xs text-red-700">{errors.message}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={id("name")} className={label}>
                Name
              </label>
              <input
                id={id("name")}
                value={r.name}
                onChange={(e) => onChange({ name: e.target.value })}
                maxLength={L.name}
                placeholder="e.g. Priya R."
                aria-invalid={!!errors?.name}
                className={input}
              />
              {errors?.name && <p className="mt-1 text-xs text-red-700">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor={id("place")} className={label}>
                City <span className="normal-case tracking-normal text-chocolate/40">(optional)</span>
              </label>
              <input
                id={id("place")}
                value={r.place}
                onChange={(e) => onChange({ place: e.target.value })}
                maxLength={L.place}
                placeholder="e.g. Chennai"
                aria-invalid={!!errors?.place}
                className={input}
              />
              {errors?.place && <p className="mt-1 text-xs text-red-700">{errors.place}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// The customer's photo, shown round: click to upload or change it
function PhotoPicker({ photo, name, error, onChange }: { photo: string | null; name: string; error?: string; onChange: (photo: string | null) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function handleFile(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    setUploadError("");
    if (!IMAGE_TYPES.includes(file.type)) return setUploadError("Use a JPG, PNG or WebP photo.");
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return setUploadError(`Photos can be up to ${MAX_IMAGE_MB} MB.`);
    setUploading(true);
    try {
      onChange((await uploadToCloudinary(await shrink(file, PHOTO_MAX_SIDE), "testimonial")).url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const problem = uploadError || error;
  const initials = name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex flex-row items-center gap-4 sm:w-28 sm:flex-col sm:gap-2">
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={uploading}
        aria-label={photo ? "Change photo" : "Add photo"}
        className={`group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition-colors ${
          problem ? "border-red-700/50" : photo ? "border-gold/60" : "border-chocolate/25 hover:border-gold"
        } bg-ivory/70`}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- an admin thumbnail of a Cloudinary photo
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : initials ? (
          <span className="text-xl font-light text-chocolate/40">{initials}</span>
        ) : (
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-chocolate/30" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="12" cy="9" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-espresso/60 text-[0.65rem] uppercase tracking-[0.15em] text-ivory opacity-0 transition-opacity group-hover:opacity-100">
          {photo ? "Change" : "Add photo"}
        </span>
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-cream/85">
            <Spinner />
          </span>
        )}
      </button>
      <input ref={fileInput} type="file" accept={IMAGE_TYPES.join(",")} className="sr-only" tabIndex={-1} onChange={(e) => handleFile(e.target.files?.[0])} />
      <div className="text-xs sm:text-center">
        {photo && !uploading ? (
          <button type="button" onClick={() => onChange(null)} className="uppercase tracking-[0.15em] text-chocolate/50 hover:text-red-700">
            Remove
          </button>
        ) : (
          <span className="text-chocolate/50">{uploading ? "Uploading…" : "Photo (optional)"}</span>
        )}
        {problem && (
          <p className="mt-1 text-red-700" role="alert">
            {problem}
          </p>
        )}
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-chocolate/15 p-5">
      <h3 className="mb-4 flex items-center gap-3 font-medium">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold text-sm text-espresso">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${on ? "bg-gold text-espresso" : "border border-chocolate/25"}`}
    >
      {on && (
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 12 5 5 9-10" />
        </svg>
      )}
    </span>
  );
}

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
