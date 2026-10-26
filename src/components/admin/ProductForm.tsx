"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { saveProduct, type ProductErrors, type ProductInput } from "@/app/actions/admin";
import { formatPrice } from "@/lib/format";
import { priceOf } from "@/lib/product";
import Spinner from "@/components/Spinner";

const input = "w-full rounded-xl border border-chocolate/20 bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-gold";
const label = "mb-1.5 block text-xs uppercase tracking-[0.15em] text-chocolate/60";

const toSlug = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

// Shrinks a photo to at most 1600px wide/high and re-encodes it as WebP, so uploads stay small
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process the image"))), "image/webp", 0.85),
  );
}

// Uploads straight from the browser to Cloudinary, using a one-time signature from our server
// (the API secret stays there). Returns the image's link, which is all the product stores.
async function uploadToCloudinary(image: Blob) {
  const signRes = await fetch("/api/admin/images/", { method: "POST" });
  const sign = (await signRes.json()) as {
    cloudName?: string;
    apiKey?: string;
    signature?: string;
    timestamp?: string;
    folder?: string;
    error?: string;
  };
  if (!signRes.ok || !sign.signature) throw new Error(sign.error ?? "Upload failed");

  const body = new FormData();
  body.append("file", image, "image.webp");
  body.append("api_key", sign.apiKey!);
  body.append("timestamp", sign.timestamp!);
  body.append("signature", sign.signature);
  body.append("folder", sign.folder!);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, { method: "POST", body });
  const data = (await res.json()) as { secure_url?: string; error?: { message?: string } };
  if (!res.ok || !data.secure_url) throw new Error(data.error?.message ?? "Upload failed");
  // f_auto,q_auto: Cloudinary picks the best format (WebP/AVIF) and quality for each device
  return data.secure_url.replace("/image/upload/", "/image/upload/f_auto,q_auto/");
}

type FormValues = Omit<ProductInput, "highlights" | "ingredients" | "price" | "offer"> & {
  price: string;
  highlights: string; // one per line
  ingredients: string; // one per line
  offerType: "none" | "percent" | "flat";
  offerValue: string;
  offerStart: string;
  offerEnd: string;
};

export type ProductFormInitial = ProductInput;

export default function ProductForm({ initial, isNew }: { initial: ProductFormInitial; isNew: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<FormValues>({
    ...initial,
    price: initial.price ? String(initial.price) : "",
    highlights: initial.highlights.join("\n"),
    ingredients: initial.ingredients.join("\n"),
    offerType: initial.offer?.type ?? "none",
    offerValue: initial.offer ? String(initial.offer.value) : "",
    offerStart: initial.offer?.startDate ?? "",
    offerEnd: initial.offer?.endDate ?? "",
  });
  // On a new product the URL name follows the name until it's edited by hand
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [errors, setErrors] = useState<ProductErrors>({});
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormValues>(k: K, value: FormValues[K]) => {
    setV((prev) => ({
      ...prev,
      [k]: value,
      ...(k === "name" && !slugTouched && { slug: toSlug(String(value)) }),
    }));
    setSaved(false);
  };
  const field = (k: keyof FormValues) => ({
    value: String(v[k]),
    onChange: (e: { target: { value: string } }) => set(k, e.target.value as never),
  });

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploadError("");
    for (const file of Array.from(files).slice(0, 8 - v.images.length)) {
      setUploading((n) => n + 1);
      try {
        const url = await uploadToCloudinary(await shrink(file));
        setV((prev) => ({ ...prev, images: [...prev.images, url] }));
        setSaved(false);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading((n) => n - 1);
      }
    }
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
      slug: v.slug,
      name: v.name,
      category: v.category,
      size: v.size,
      price: Number(v.price),
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
          : { type: v.offerType, value: Number(v.offerValue), startDate: v.offerStart, endDate: v.offerEnd },
    };
    startTransition(async () => {
      const res = await saveProduct(payload, isNew);
      if ("errors" in res) {
        setErrors(res.errors);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setErrors({});
      setSaved(true);
      if (isNew) router.push(`/admin/products/${res.slug}/`);
      router.refresh();
    });
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="grid h-fit gap-5">
        {hasErrors && (
          <p className="rounded-xl bg-red-700/10 px-4 py-3 text-sm text-red-800" role="alert">
            Please fix the highlighted fields.
          </p>
        )}
        <Field label="Name" error={errors.name}>
          <input {...field("name")} className={input} required />
        </Field>
        <Field
          label="URL name"
          error={errors.slug}
          hint={isNew ? `Shop page: /products/${v.slug || "…"}/ — can't be changed later.` : `/products/${v.slug}/ (fixed)`}
        >
          <input
            value={v.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", toSlug(e.target.value));
            }}
            readOnly={!isNew}
            className={`${input} ${isNew ? "" : "bg-transparent text-chocolate/60"}`}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Category" error={errors.category}>
            <input {...field("category")} placeholder="Body Care" className={input} />
          </Field>
          <Field label="Size" error={errors.size}>
            <input {...field("size")} placeholder="50 ml" className={input} />
          </Field>
          <Field label="Price (₹)" error={errors.price}>
            <input {...field("price")} inputMode="numeric" className={input} />
          </Field>
        </div>
        <Field label="Short description" error={errors.shortDescription} hint="Shown on product cards.">
          <textarea {...field("shortDescription")} rows={2} className={input} />
        </Field>
        <Field label="Description" error={errors.description}>
          <textarea {...field("description")} rows={5} className={input} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Highlights" hint="One per line.">
            <textarea {...field("highlights")} rows={5} className={input} />
          </Field>
          <Field label="Key ingredients" hint="One per line.">
            <textarea {...field("ingredients")} rows={5} className={input} />
          </Field>
        </div>
        <Field label="How to use">
          <textarea {...field("howToUse")} rows={3} className={input} />
        </Field>

        <Field label="Images" group error={errors.images || uploadError} hint="The first image is the main one. Up to 8.">
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
              <Field label={v.offerType === "percent" ? "Discount (%)" : "Discount (₹)"} error={errors.offerValue}>
                <input {...field("offerValue")} inputMode="numeric" className={input} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts">
                  <input type="date" {...field("offerStart")} className={input} />
                </Field>
                <Field label="Ends">
                  <input type="date" {...field("offerEnd")} className={input} />
                </Field>
              </div>
              {errors.offerDates && <p className="-mt-2 text-xs text-red-700">{errors.offerDates}</p>}
              <p className="-mt-1 text-xs text-chocolate/60">Leave dates empty to start now and run until you turn it off.</p>
              {preview && (
                <p className="rounded-xl bg-ivory px-4 py-3 text-sm">
                  Customers pay <strong className="text-gold">{formatPrice(preview.price)}</strong>{" "}
                  <s className="text-chocolate/50">{formatPrice(preview.mrp)}</s> · {preview.off}% off
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" className="btn btn-primary" disabled={pending || uploading > 0}>
            {pending && <Spinner />}
            {pending ? "Saving…" : isNew ? "Create product" : "Save changes"}
          </button>
          <Link href="/admin/products/" className="text-xs uppercase tracking-[0.15em] text-chocolate/60 hover:text-gold">
            Back to products
          </Link>
        </div>
        {saved && !isNew && <p className="text-sm text-green-800" role="status">Saved. The shop is updated.</p>}
        {!isNew && v.enabled && (
          <Link href={`/products/${v.slug}/`} target="_blank" className="text-xs uppercase tracking-[0.15em] text-gold hover:underline">
            View in shop ↗
          </Link>
        )}
      </div>
    </form>
  );
}

// A titled field. It is a <label> (tapping the title focuses the input) except for groups of
// buttons like the image picker, where a label would trigger its first button.
function Field({ label: text, error, hint, group, children }: {
  label: string;
  error?: string;
  hint?: string;
  group?: boolean;
  children: ReactNode;
}) {
  const Wrapper = group ? "div" : "label";
  return (
    <div>
      <Wrapper className="block">
        <span className={label}>{text}</span>
        {children}
      </Wrapper>
      {error ? <p className="mt-1.5 text-xs text-red-700">{error}</p> : hint && <p className="mt-1.5 text-xs text-chocolate/60">{hint}</p>}
    </div>
  );
}
