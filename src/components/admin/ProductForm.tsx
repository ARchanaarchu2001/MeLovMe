"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { saveProduct } from "@/app/actions/admin";
import { MAX_IMAGE_MB, onlyDigits, productLimits, toSlug, validateProduct, type ProductErrors, type ProductInput } from "@/lib/admin-validation";
import { formatPrice } from "@/lib/format";
import type { Category } from "@/lib/category";
import { MAX_COMBOS, priceOf } from "@/lib/product";
import { MAX_QTY } from "@/lib/order";
import Spinner from "@/components/Spinner";
import { TrashIcon } from "@/components/admin/actions";
import CategoryPicker from "@/components/admin/CategoryPicker";
import { RequiredMark, StockBadge } from "@/components/admin/ui";
import { IMAGE_TYPES, shrink, uploadToCloudinary } from "@/lib/upload";

const input =
  "w-full rounded-xl border border-chocolate/20 bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-gold aria-invalid:border-red-700";
const label = "mb-1.5 block text-xs uppercase tracking-[0.15em] text-chocolate/60";

// One combo row as typed: pieces and total price (strings while editing), optional tag
type ComboRow = { qty: string; price: string; tag: "" | "popular" | "best" };
const comboTags: { value: ComboRow["tag"]; label: string }[] = [
  { value: "", label: "None" },
  { value: "popular", label: "Popular" },
  { value: "best", label: "Best value" },
];

type FormValues = Omit<ProductInput, "highlights" | "ingredients" | "price" | "stock" | "offer" | "combos"> & {
  price: string;
  stock: string;
  highlights: string; // one per line
  ingredients: string; // one per line
  offerType: "none" | "percent" | "flat";
  offerValue: string;
  offerDuration: "always" | "dates"; // runs until turned off, or only between two dates
  offerStart: string;
  offerEnd: string;
  combos: ComboRow[];
};

export type ProductFormInitial = ProductInput;

// Which error a form value shows (most have their own; the offer boxes share two)
const errorFor = (k: keyof FormValues): keyof ProductErrors =>
  k === "offerStart" || k === "offerEnd" || k === "offerDuration" ? "offerDates" : k === "offerType" ? "offerValue" : (k as keyof ProductErrors);

export default function ProductForm({ initial, isNew, categories }: {
  initial: ProductFormInitial;
  isNew: boolean;
  categories: Category[];
}) {
  const router = useRouter();
  // Grows when a category is added from the picker
  const [categoryList, setCategoryList] = useState(categories);
  const [v, setV] = useState<FormValues>({
    ...initial,
    price: initial.price ? String(initial.price) : "",
    stock: initial.stock === null ? "" : String(initial.stock),
    highlights: initial.highlights.join("\n"),
    ingredients: initial.ingredients.join("\n"),
    offerType: initial.offer?.type ?? "none",
    offerValue: initial.offer ? String(initial.offer.value) : "",
    offerDuration: initial.offer?.startDate || initial.offer?.endDate ? "dates" : "always",
    offerStart: initial.offer?.startDate ?? "",
    offerEnd: initial.offer?.endDate ?? "",
    combos: initial.combos.map((c) => ({ qty: String(c.qty), price: String(c.price), tag: c.tag ?? "" })),
  });
  const [errors, setErrors] = useState<ProductErrors>({});
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Bumped on each failed Save, so the page jumps to the first problem once the errors are shown
  const [errorJump, setErrorJump] = useState(0);

  useEffect(() => {
    if (!errorJump) return;
    const message = formRef.current?.querySelector("[data-error]");
    const box = message?.closest("[data-field]") ?? message?.parentElement;
    if (!box) return window.scrollTo({ top: 0, behavior: "smooth" }); // only the message at the top
    box.scrollIntoView({ behavior: "smooth", block: "center" });
    box.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus({ preventScroll: true });
  }, [errorJump]);

  // Editing a field clears its error; the rest stay until the next Save
  const clearError = (...keys: (keyof ProductErrors)[]) =>
    setErrors((prev) => {
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
  const set = <K extends keyof FormValues>(k: K, value: FormValues[K]) => {
    setV((prev) => ({ ...prev, [k]: value }));
    clearError(errorFor(k));
    setSaved(false);
  };
  const field = (k: keyof FormValues) => ({
    value: String(v[k]),
    onChange: (e: { target: { value: string } }) => set(k, e.target.value as never),
    "aria-invalid": !!errors[errorFor(k)],
  });
  // A box for whole numbers: anything but digits is dropped as it's typed
  const numberField = (k: "price" | "stock" | "offerValue", maxDigits?: number) => ({
    ...field(k),
    onChange: (e: { target: { value: string } }) => set(k, onlyDigits(e.target.value, maxDigits)),
    inputMode: "numeric" as const,
    autoComplete: "off",
  });

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploadError("");
    clearError("images");
    const problems: string[] = [];
    for (const file of Array.from(files).slice(0, 8 - v.images.length)) {
      if (!IMAGE_TYPES.includes(file.type)) {
        problems.push(`${file.name} is not a JPG, PNG or WebP photo.`);
        continue;
      }
      if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
        problems.push(`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. Photos can be up to ${MAX_IMAGE_MB} MB.`);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const { url } = await uploadToCloudinary(await shrink(file));
        setV((prev) => ({ ...prev, images: [...prev.images, url] }));
        setSaved(false);
      } catch (err) {
        problems.push(`${file.name}: ${err instanceof Error ? err.message : "Upload failed"}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    setUploadError(problems.join(" "));
    if (fileInput.current) fileInput.current.value = "";
  }

  const moveImage = (i: number, to: number) =>
    setV((prev) => {
      const images = [...prev.images];
      const [img] = images.splice(i, 1);
      images.splice(to, 0, img);
      return { ...prev, images };
    });
  const removeImage = (i: number) => setV((prev) => ({ ...prev, images: prev.images.filter((_, k) => k !== i) }));

  // Live price preview with the offer (ignores dates, so it shows the offer price itself)
  const preview =
    v.offerType !== "none" && Number(v.price) > 0 && Number(v.offerValue) > 0
      ? priceOf({ price: Number(v.price), offer: { type: v.offerType, value: Number(v.offerValue) } })
      : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload: ProductInput = {
      // A new product's URL name comes from its name (the server makes sure it's free)
      slug: isNew ? toSlug(v.name) : v.slug,
      name: v.name,
      categoryId: v.categoryId,
      size: v.size,
      price: Number(v.price),
      // Unchanged: send null so the server keeps the current count (orders may have changed it)
      stock: !isNew && initial.stock !== null && v.stock === String(initial.stock) ? null : v.stock.trim() === "" ? NaN : Number(v.stock),
      shortDescription: v.shortDescription,
      description: v.description,
      images: v.images,
      highlights: v.highlights.split("\n"),
      ingredients: v.ingredients.split("\n"),
      howToUse: v.howToUse,
      enabled: v.enabled,
      offer:
        v.offerType === "none"
          ? null
          : v.offerDuration === "always"
            ? { type: v.offerType, value: Number(v.offerValue), startDate: "", endDate: "" }
            : { type: v.offerType, value: Number(v.offerValue), startDate: v.offerStart, endDate: v.offerEnd },
      // Rows left completely empty are ignored
      combos: v.combos
        .filter((c) => c.qty.trim() || c.price.trim())
        .map((c) => ({ qty: Number(c.qty), price: Number(c.price), ...(c.tag && { tag: c.tag }) })),
    };
    const found = validateProduct(payload);
    if (v.offerType !== "none" && v.offerDuration === "dates" && !v.offerEnd && !found.offerDates) {
      found.offerDates = "Choose the last day of the offer, or pick “Always on”.";
    }
    const showErrors = (e: ProductErrors) => {
      setErrors(e);
      setErrorJump((n) => n + 1);
    };
    if (Object.keys(found).length) return showErrors(found);
    startTransition(async () => {
      const res = await saveProduct(payload, isNew);
      if ("errors" in res) return showErrors(res.errors);
      setErrors({});
      // A new product: back to the list, which says it was added (the form is left, so it starts empty next time)
      if (isNew) return router.push(`/admin/products/?added=${encodeURIComponent(res.slug)}`);
      setSaved(true);
      router.refresh();
    });
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="grid h-fit gap-5">
        {hasErrors && (
          <p className="rounded-xl bg-red-700/10 px-4 py-3 text-sm text-red-800" role="alert">
            {errors.slug ?? "Please fix the highlighted fields."}
          </p>
        )}
        <Field label="Name" required error={errors.name}>
          <input {...field("name")} maxLength={productLimits.name} className={input} required />
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          {/* Not a <label>: it would pass clicks in the menu on to the box and reopen it */}
          <Field label="Category" required group error={errors.categoryId}>
            <CategoryPicker
              categories={categoryList}
              value={v.categoryId}
              onChange={(id) => set("categoryId", id)}
              onCreated={(c) => setCategoryList((list) => [...list, c])}
              invalid={!!errors.categoryId}
              className={input}
            />
          </Field>
          <Field label="Size" required error={errors.size}>
            <input {...field("size")} maxLength={productLimits.size} placeholder="50 ml" className={input} />
          </Field>
          <Field label="Price (₹)" required error={errors.price}>
            <input {...numberField("price")} placeholder="899" className={input} />
          </Field>
        </div>
        <Field
          label="Short description"
          required
          error={errors.shortDescription}
          hint="Shown on product cards."
          count={<CharCount text={v.shortDescription} min={productLimits.minShortDescription} max={productLimits.shortDescription} />}
        >
          <textarea {...field("shortDescription")} maxLength={productLimits.shortDescription} rows={2} className={input} />
        </Field>
        <Field
          label="Description"
          required
          error={errors.description}
          hint="Shown on the product page."
          count={<CharCount text={v.description} min={productLimits.minDescription} max={productLimits.description} />}
        >
          <textarea {...field("description")} maxLength={productLimits.description} rows={5} className={input} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Highlights" error={errors.highlights} hint="One per line.">
            <textarea {...field("highlights")} rows={5} className={input} />
          </Field>
          <Field label="Key ingredients" error={errors.ingredients} hint="One per line.">
            <textarea {...field("ingredients")} rows={5} className={input} />
          </Field>
        </div>
        <Field label="How to use" error={errors.howToUse} count={<CharCount text={v.howToUse} max={productLimits.howToUse} />}>
          <textarea {...field("howToUse")} maxLength={productLimits.howToUse} rows={3} className={input} />
        </Field>

        <Field label="Images" group required error={errors.images || uploadError} hint={`JPG, PNG or WebP, up to ${MAX_IMAGE_MB} MB each. Up to 8 photos; the first is the main one.`}>
          <div className="flex flex-wrap gap-3">
            {v.images.map((src, i) => (
              <div key={src} className="w-28">
                <div className={`relative aspect-square overflow-hidden rounded-xl bg-ivory ${i === 0 ? "ring-2 ring-gold" : ""}`}>
                  <Image src={src} alt="" fill sizes="112px" className="object-cover" />
                  {i === 0 && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-gold px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-espresso">
                      Main
                    </span>
                  )}
                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    aria-label={`Remove image ${i + 1}`}
                    title="Remove"
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-espresso/75 text-ivory shadow transition-colors hover:bg-red-700"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>
                {/* Order: move left/right, or make this the main image */}
                <div className="mt-1.5 flex items-center justify-between text-chocolate/60">
                  <button type="button" onClick={() => moveImage(i, i - 1)} disabled={i === 0} className="px-1 hover:text-gold disabled:opacity-25" aria-label={`Move image ${i + 1} left`} title="Move left">←</button>
                  {i > 0 && (
                    <button type="button" onClick={() => moveImage(i, 0)} className="text-[0.6rem] uppercase tracking-[0.1em] hover:text-gold">
                      Set as main
                    </button>
                  )}
                  <button type="button" onClick={() => moveImage(i, i + 1)} disabled={i === v.images.length - 1} className="px-1 hover:text-gold disabled:opacity-25" aria-label={`Move image ${i + 1} right`} title="Move right">→</button>
                </div>
              </div>
            ))}
            {v.images.length < 8 && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading > 0}
                className="flex aspect-square w-28 flex-col items-center justify-center rounded-xl border-2 border-dashed border-chocolate/25 text-xs uppercase tracking-[0.1em] text-chocolate/60 hover:border-gold hover:text-gold disabled:opacity-60"
              >
                {uploading > 0 ? (
                  <>
                    <Spinner className="mb-2 h-5 w-5 text-gold" />
                    Uploading…
                  </>
                ) : (
                  <>+ Add<br />image</>
                )}
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        </Field>
      </div>

      <div className="grid h-fit gap-5 lg:sticky lg:top-28">
        <div className="rounded-2xl border border-chocolate/15 p-5">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-medium">Show in shop</span>
              <span className="text-xs text-chocolate/60">Disabled products are hidden and can&apos;t be bought.</span>
            </span>
            <input type="checkbox" checked={v.enabled} onChange={(e) => set("enabled", e.target.checked)} className="h-5 w-5 accent-gold" />
          </label>
          <div className="mt-4 border-t border-chocolate/10 pt-4">
            <Field label="Stock (units on hand)" required={isNew} error={errors.stock}>
              <input {...numberField("stock")} placeholder="e.g. 25" className={input} />
            </Field>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-chocolate/60">
              <StockBadge stock={v.stock.trim() === "" ? null : Number(v.stock)} />
              Goes down by itself as orders are paid. At 0 the product stays in the shop, but can&apos;t be bought.
            </p>
          </div>
        </div>

        <div className="grid gap-4 rounded-2xl border border-chocolate/15 p-5">
          <p className="text-sm font-medium">Offer</p>
          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.12em]">
            {(["none", "percent", "flat"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set("offerType", t)}
                className={`rounded-full px-4 py-1.5 ${v.offerType === t ? "bg-chocolate text-ivory" : "border border-chocolate/20 hover:border-gold"}`}
              >
                {t === "none" ? "No offer" : t === "percent" ? "% off" : "₹ off"}
              </button>
            ))}
          </div>
          {v.offerType !== "none" && (
            <>
              <Field label={v.offerType === "percent" ? "Discount (%)" : "Discount (₹)"} required error={errors.offerValue}>
                <input {...numberField("offerValue", v.offerType === "percent" ? 2 : undefined)} className={input} />
              </Field>
              <div>
                <span className={label}>Runs</span>
                <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.12em]">
                  {(["always", "dates"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => set("offerDuration", d)}
                      aria-pressed={v.offerDuration === d}
                      className={`rounded-full px-4 py-1.5 ${v.offerDuration === d ? "bg-chocolate text-ivory" : "border border-chocolate/20 hover:border-gold"}`}
                    >
                      {d === "always" ? "Always on" : "Set dates"}
                    </button>
                  ))}
                </div>
              </div>
              {v.offerDuration === "dates" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Starts">
                    <input type="date" {...field("offerStart")} className={input} />
                  </Field>
                  <Field label="Ends">
                    <input type="date" {...field("offerEnd")} min={v.offerStart || undefined} className={input} />
                  </Field>
                </div>
              )}
              {errors.offerDates && <p data-error className="-mt-2 text-xs text-red-700">{errors.offerDates}</p>}
              <p className="-mt-1 text-xs text-chocolate/60">
                {v.offerDuration === "always"
                  ? "Starts now and runs until you turn it off."
                  : "Runs from the start of the first day to the end of the last day (India time). Leave Starts empty to begin today. Customers see how many days are left."}
              </p>
              {preview && (
                <p className="rounded-xl bg-ivory px-4 py-3 text-sm">
                  Customers pay <strong className="text-gold">{formatPrice(preview.price)}</strong>{" "}
                  <s className="text-chocolate/50">{formatPrice(preview.mrp)}</s> · {preview.off}% off
                </p>
              )}
            </>
          )}
        </div>

        <CombosBox
          rows={v.combos}
          price={Number(v.price)}
          error={errors.combos}
          onChange={(combos) => set("combos", combos)}
        />

        <div className="grid gap-3 text-center">
          <button type="submit" className="btn btn-primary w-full justify-center" disabled={pending || uploading > 0}>
            {pending && <Spinner />}
            {pending ? "Saving…" : isNew ? "Create product" : "Save changes"}
          </button>
          {saved && !isNew && <p className="text-sm text-green-800" role="status">Saved. The shop is updated.</p>}
          <Link href="/admin/products/" className="text-xs uppercase tracking-[0.15em] text-chocolate/60 hover:text-gold">
            ← Back to products
          </Link>
        </div>
      </div>
    </form>
  );
}

// A titled field. It is a <label> (tapping the title focuses the input) except for groups of
// buttons like the image picker, where a label would trigger its first button.
function Field({ label: text, error, hint, count, group, required, children }: {
  label: string;
  error?: string;
  hint?: string;
  count?: ReactNode; // a character counter, shown on the right under the box
  group?: boolean;
  required?: boolean;
  children: ReactNode;
}) {
  const Wrapper = group ? "div" : "label";
  const note = error ? <p data-error className="text-xs text-red-700">{error}</p> : hint && <p className="text-xs text-chocolate/60">{hint}</p>;
  return (
    <div data-field>
      <Wrapper className="block">
        <span className={label}>{text}{required && <RequiredMark />}</span>
        {children}
      </Wrapper>
      {(note || count) && (
        <div className="mt-1.5 flex items-start justify-between gap-4">
          {note || <span />}
          {count}
        </div>
      )}
    </div>
  );
}

// "12 more characters needed" until the minimum is reached, then "120 / 5,000"
function CharCount({ text, min = 0, max }: { text: string; min?: number; max: number }) {
  const n = text.trim().length;
  const short = n > 0 && n < min ? min - n : 0;
  return (
    <p className={`shrink-0 text-xs tabular-nums ${short ? "text-amber-800" : n >= max ? "text-red-700" : "text-chocolate/50"}`} aria-live="polite">
      {n === 0 && min
        ? `At least ${min} characters`
        : short
          ? `${short} more character${short === 1 ? "" : "s"} needed`
          : `${n.toLocaleString("en-IN")} / ${max.toLocaleString("en-IN")}`}
    </p>
  );
}

// "Buy more, pay less": up to MAX_COMBOS rows of pieces + total price, with the saving worked out
function CombosBox({ rows, price, error, onChange }: {
  rows: ComboRow[];
  price: number; // the regular price of one piece, as typed above
  error?: string;
  onChange: (rows: ComboRow[]) => void;
}) {
  const update = (i: number, patch: Partial<ComboRow>) => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const small = "w-full rounded-xl border border-chocolate/20 bg-white/60 px-3 py-2 text-sm outline-none focus:border-gold";

  return (
    <div className="grid gap-4 rounded-2xl border border-chocolate/15 p-5">
      <div>
        <p className="text-sm font-medium">Combo offers</p>
        <p className="text-xs text-chocolate/60">Buy more, pay less, e.g. 2 pieces for ₹3,000. Customers choose them on the product page.</p>
      </div>
      {rows.map((r, i) => {
        const qty = Number(r.qty);
        const total = Number(r.price);
        const regular = price > 0 && qty >= 2 ? price * qty : 0;
        const saving = regular && total > 0 ? regular - total : null;
        return (
          <div key={i} className="grid gap-2 rounded-xl bg-ivory/60 p-3">
            <div className="grid grid-cols-[4.5rem_1fr_auto] items-end gap-2">
              <label>
                <span className={label}>Pieces</span>
                <input value={r.qty} onChange={(e) => update(i, { qty: onlyDigits(e.target.value, String(MAX_QTY).length) })} inputMode="numeric" placeholder="2" className={small} />
              </label>
              <label>
                <span className={label}>Total price (₹)</span>
                <input value={r.price} onChange={(e) => update(i, { price: onlyDigits(e.target.value) })} inputMode="numeric" placeholder="3000" className={small} />
              </label>
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, k) => k !== i))}
                className="flex h-9 w-9 items-center justify-center rounded-full text-chocolate/50 hover:bg-red-700/10 hover:text-red-700"
                aria-label={`Remove combo ${i + 1}`}
                title="Remove"
              >
                <TrashIcon />
              </button>
            </div>
            <div>
              <span className={label}>Tag</span>
              {/* One-row switch: the chosen tag sits on a white tab */}
              <div className="grid grid-cols-3 gap-1 rounded-full bg-chocolate/[0.07] p-1" role="group" aria-label={`Tag for combo ${i + 1}`}>
                {comboTags.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => update(i, { tag: t.value })}
                    aria-pressed={r.tag === t.value}
                    className={`truncate rounded-full px-2 py-1.5 text-xs transition-all ${
                      r.tag === t.value ? "bg-white font-medium text-chocolate shadow-sm" : "text-chocolate/60 hover:text-chocolate"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            {saving !== null &&
              (saving > 0 ? (
                <p className="text-xs text-green-800">
                  Customer saves {formatPrice(saving)} ({Math.round((saving / regular) * 100)}%) vs {qty} × {formatPrice(price)}
                </p>
              ) : (
                <p className="text-xs text-red-700">Must be less than {formatPrice(regular)} to be a deal.</p>
              ))}
          </div>
        );
      })}
      {error && <p data-error className="text-xs text-red-700">{error}</p>}
      {rows.length < MAX_COMBOS && (
        <button
          type="button"
          onClick={() => onChange([...rows, { qty: String(Math.min(MAX_QTY, (Math.max(1, ...rows.map((r) => Number(r.qty) || 1))) + 1)), price: "", tag: "" }])}
          className="justify-self-start rounded-full border border-dashed border-chocolate/30 px-5 py-2 text-xs uppercase tracking-[0.12em] text-chocolate/70 hover:border-gold hover:text-gold"
        >
          + Add combo
        </button>
      )}
      <p className="text-xs text-chocolate/60">
        The cart uses combos by itself: with 2- and 3-piece combos, 5 pieces cost one of each. While an offer makes single pieces
        cheaper than a combo, that combo is hidden.
      </p>
    </div>
  );
}
