"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type DragEvent, type FormEvent, type ReactNode, type RefObject } from "react";
import { saveBanner } from "@/app/actions/admin";
import HeroBanner from "@/components/HeroBanner";
import Spinner from "@/components/Spinner";
import { MAX_IMAGE_MB, hasBannerErrors, validateBanner, type BannerErrors } from "@/lib/admin-validation";
import {
  BANNER_ALT_MAX,
  bannerButtonLimits,
  type Banner,
  type BannerButton,
  type BannerButtonPosition,
  type BannerImage,
  type LinkGroup,
} from "@/lib/banner";
import { IMAGE_TYPES, shrink, uploadToCloudinary } from "@/lib/upload";

const input = "w-full rounded-xl border border-chocolate/20 bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-gold";
const pill = (on: boolean) =>
  `rounded-full px-4 py-2 text-xs uppercase tracking-[0.12em] transition-colors ${
    on ? "bg-chocolate text-ivory" : "border border-chocolate/20 hover:border-gold"
  }`;
// A choice card: gold ring when picked
const card = (on: boolean) =>
  `grid gap-2 rounded-2xl border p-2.5 text-left transition-all ${
    on ? "border-gold bg-white/70 ring-2 ring-gold/60" : "border-chocolate/15 hover:-translate-y-0.5 hover:border-gold/60 hover:bg-white/40"
  }`;

// Banners are shown full width, so they keep more pixels than product photos
const MAX_SIDE = 2400;

// The button choices offered here; any other saved position still works in the shop
const placements: { value: BannerButtonPosition | "none"; name: string; align: string }[] = [
  { value: "bottom-left", name: "Bottom left", align: "justify-start" },
  { value: "bottom-center", name: "Bottom centre", align: "justify-center" },
  { value: "bottom-right", name: "Bottom right", align: "justify-end" },
  { value: "none", name: "No buttons", align: "" },
];

const buttonColours = [
  { value: "light", name: "Light buttons", hint: "For dark pictures", bg: "bg-espresso", main: "bg-gold text-espresso", other: "border-ivory text-ivory" },
  { value: "dark", name: "Dark buttons", hint: "For light pictures", bg: "bg-ivory", main: "bg-chocolate text-ivory", other: "border-chocolate text-chocolate" },
] as const;

type Labels = { heading: string; explore: string; ourStory: string };

// Uploads the home page banner, places the shop's buttons on it and sets their text and links
export default function BannerForm({ initial, labels, links }: { initial: Banner; labels: Labels; links: LinkGroup[] }) {
  const router = useRouter();
  // Buttons without their own text start with the usual wording, ready to edit
  const [v, setV] = useState<Banner>(() => ({
    ...initial,
    primaryButton: { ...initial.primaryButton, label: initial.primaryButton.label || labels.explore },
    secondaryButton: { ...initial.secondaryButton, label: initial.secondaryButton.label || labels.ourStory },
  }));
  const [errors, setErrors] = useState<BannerErrors>({});
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const preview = useRef<HTMLDialogElement>(null);
  const placement = v.showButtons ? v.buttonPosition : "none";
  // The buttons' text as customers will see it
  const shown = { explore: v.primaryButton.label.trim() || labels.explore, ourStory: v.secondaryButton.label.trim() || labels.ourStory };

  const update = (patch: Partial<Banner>) => {
    setV((prev) => ({ ...prev, ...patch }));
    setSaved(false);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.form;
      for (const k of Object.keys(patch)) delete next[k as keyof BannerErrors];
      // "Upload a picture, or switch the banner off"
      if ("enabled" in patch) delete next.image;
      if ("primaryButton" in patch || "showButtons" in patch) {
        delete next.primaryLabel;
        delete next.primaryLink;
      }
      if ("secondaryButton" in patch || "showButtons" in patch) {
        delete next.secondaryLabel;
        delete next.secondaryLink;
      }
      return next;
    });
  };

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateBanner(v);
    if (hasBannerErrors(found)) return setErrors(found);
    startTransition(async () => {
      const res = await saveBanner(v);
      if ("errors" in res) return setErrors(res.errors);
      setErrors({});
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto grid max-w-5xl gap-5">
      {/* Title, with the on/off switch, preview and save on the right */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-medium">Home banner</h2>
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
            disabled={!v.image}
            title={v.image ? undefined : "Upload a computer picture first"}
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

      {hasBannerErrors(errors) ? (
        <p className="rounded-xl bg-red-700/10 px-4 py-3 text-sm text-red-800" role="alert">
          {errors.form ??
            errors.image ??
            errors.mobileImage ??
            errors.alt ??
            (errors.primaryLabel || errors.primaryLink || errors.secondaryLabel || errors.secondaryLink
              ? "Please fix the button text and links below."
              : null)}
        </p>
      ) : saved ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm ${v.enabled ? "bg-green-700/10 text-green-800" : "bg-amber-100 text-amber-900"}`}
          role="status"
        >
          {v.enabled ? "Saved. The home page now shows the banner." : "Saved. The banner is hidden, so customers don't see it."}
        </p>
      ) : null}

      {/* 1. Pictures */}
      <Step n={1} title="Pictures">
        <div className="grid gap-4 sm:grid-cols-[3fr_2fr]">
          <ImageTile
            title="Computer"
            hint="Wide, e.g. 1920 × 800 px"
            image={v.image}
            error={errors.image}
            // Uploading the first picture switches the banner on: that's nearly always why it's uploaded
            onChange={(image) => update(image && !v.image ? { image, enabled: true } : { image })}
          />
          <ImageTile
            title="Phone (optional)"
            hint="Tall, e.g. 1080 × 1350 px. Without one, phones show the computer picture."
            image={v.mobileImage}
            error={errors.mobileImage}
            onChange={(mobileImage) => update({ mobileImage })}
          />
        </div>
        <div className="mt-5">
          <label htmlFor="banner-alt" className="block text-sm">
            Picture description <span className="text-chocolate/50">(optional, not shown on the page)</span>
          </label>
          <p className="mb-2 text-xs text-chocolate/60">
            Describes the picture in words for Google and for blind customers using screen readers.
          </p>
          <input
            id="banner-alt"
            value={v.alt}
            onChange={(e) => update({ alt: e.target.value })}
            maxLength={BANNER_ALT_MAX}
            placeholder="e.g. MELOVME body lotion and gift set: more than just a scent"
            aria-invalid={!!errors.alt}
            className={`${input} aria-invalid:border-red-700`}
          />
          {errors.alt && <p className="mt-1.5 text-xs text-red-700">{errors.alt}</p>}
        </div>
      </Step>

      {/* 2. Buttons */}
      <Step n={2} title="Buttons">
        <p className="mb-3 text-sm text-chocolate/60">
          Where should &ldquo;{shown.explore}&rdquo; and &ldquo;{shown.ourStory}&rdquo; sit on the picture?
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" role="radiogroup" aria-label="Button position">
          {placements.map((p) => {
            const on = placement === p.value;
            return (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => update(p.value === "none" ? { showButtons: false } : { showButtons: true, buttonPosition: p.value })}
                className={card(on)}
              >
                {/* A small banner with the buttons drawn where they'd go */}
                <span
                  className="relative flex aspect-[12/5] items-end overflow-hidden rounded-lg bg-espresso bg-cover bg-center p-2"
                  style={v.image ? { backgroundImage: `url("${v.image.url}")` } : undefined}
                >
                  {p.value !== "none" ? (
                    <span className={`flex w-full gap-1 ${p.align}`}>
                      <span className={`h-2 w-7 rounded-full ${v.buttonStyle === "light" ? "bg-gold" : "bg-chocolate"}`} />
                      <span className={`h-2 w-5 rounded-full border ${v.buttonStyle === "light" ? "border-ivory" : "border-chocolate"}`} />
                    </span>
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center bg-espresso/50 text-ivory">
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <circle cx="12" cy="12" r="8" />
                        <path d="m6.5 6.5 11 11" />
                      </svg>
                    </span>
                  )}
                </span>
                <span className="flex items-center justify-between gap-2 px-0.5 text-sm">
                  {p.name}
                  <Check on={on} />
                </span>
              </button>
            );
          })}
        </div>

        {v.showButtons && (
          <>
            <p className="mb-3 mt-6 text-sm text-chocolate/60">Button colour: pick the one that stands out on your picture.</p>
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Button colour">
              {buttonColours.map((s) => {
                const on = v.buttonStyle === s.value;
                return (
                  <button key={s.value} type="button" role="radio" aria-checked={on} onClick={() => update({ buttonStyle: s.value })} className={card(on)}>
                    <span className={`flex items-center justify-center gap-2 rounded-lg px-3 py-5 ${s.bg}`}>
                      <span className={`rounded-full px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.15em] ${s.main}`}>{shown.explore}</span>
                      <span className={`rounded-full border px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.15em] ${s.other}`}>{shown.ourStory}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2 px-0.5 text-sm">
                      <span>
                        {s.name} <span className="text-chocolate/50">· {s.hint}</span>
                      </span>
                      <Check on={on} />
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mb-3 mt-6 text-sm text-chocolate/60">Button text and links: what each button says and where it takes customers.</p>
            <div className="grid gap-3 md:grid-cols-2">
              <ButtonFields
                id="primary"
                title="Main button"
                hint="Filled"
                button={v.primaryButton}
                defaultLabel={labels.explore}
                links={links}
                errors={{ label: errors.primaryLabel, link: errors.primaryLink }}
                onChange={(primaryButton) => update({ primaryButton })}
              />
              <ButtonFields
                id="secondary"
                title="Second button"
                hint="Outlined"
                button={v.secondaryButton}
                defaultLabel={labels.ourStory}
                links={links}
                errors={{ label: errors.secondaryLabel, link: errors.secondaryLink }}
                onChange={(secondaryButton) => update({ secondaryButton })}
              />
            </div>
          </>
        )}
      </Step>

      {/* Preview, opened from the button at the top */}
      <PreviewDialog dialog={preview} banner={v} labels={labels} />
    </form>
  );
}

// One button's text and link
function ButtonFields({
  id,
  title,
  hint,
  button,
  defaultLabel,
  links,
  errors,
  onChange,
}: {
  id: string;
  title: string;
  hint: string;
  button: BannerButton;
  defaultLabel: string;
  links: LinkGroup[];
  errors: { label?: string; link?: string };
  onChange: (button: BannerButton) => void;
}) {
  return (
    <fieldset className="grid gap-3 rounded-2xl border border-chocolate/15 p-4">
      <legend className="px-1 text-sm font-medium">
        {title} <span className="font-normal text-chocolate/50">· {hint}</span>
      </legend>
      <div>
        <label htmlFor={`${id}-label`} className="mb-1.5 block text-xs text-chocolate/70">
          Button text
        </label>
        <input
          id={`${id}-label`}
          value={button.label}
          onChange={(e) => onChange({ ...button, label: e.target.value })}
          maxLength={bannerButtonLimits.label}
          placeholder={defaultLabel}
          aria-invalid={!!errors.label}
          aria-describedby={`${id}-label-hint`}
          className={`${input} aria-invalid:border-red-700`}
        />
        <p id={`${id}-label-hint`} className={`mt-1 text-xs ${errors.label ? "text-red-700" : "text-chocolate/50"}`}>
          {errors.label ?? <>Leave empty to show &ldquo;{defaultLabel}&rdquo;.</>}
        </p>
      </div>
      <LinkPicker id={`${id}-link`} value={button.link} groups={links} error={errors.link} onChange={(link) => onChange({ ...button, link })} />
    </fieldset>
  );
}

const CUSTOM_LINK = "custom";

// Every page of the shop to pick from (pages, categories, products), or any other link typed in
function LinkPicker({
  id,
  value,
  groups,
  error,
  onChange,
}: {
  id: string;
  value: string;
  groups: LinkGroup[];
  error?: string;
  onChange: (link: string) => void;
}) {
  const listed = groups.flatMap((g) => g.options).find((o) => o.href === value);
  // A saved link that isn't in the list (another site, or a page since removed) opens as a typed link
  const [custom, setCustom] = useState(!!value && !listed);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs text-chocolate/70">
        Goes to
      </label>
      <select
        id={id}
        value={custom ? CUSTOM_LINK : listed ? value : ""}
        onChange={(e) => {
          const picked = e.target.value;
          setCustom(picked === CUSTOM_LINK);
          if (picked !== CUSTOM_LINK) onChange(picked);
        }}
        aria-invalid={!!error && !custom}
        className={`${input} aria-invalid:border-red-700`}
      >
        <option value="" disabled>
          Choose a page…
        </option>
        {groups.map((g) => (
          <optgroup key={g.name} label={g.name}>
            {g.options.map((o) => (
              <option key={o.href} value={o.href}>
                {o.name}
              </option>
            ))}
          </optgroup>
        ))}
        <optgroup label="Other">
          <option value={CUSTOM_LINK}>Another link…</option>
        </optgroup>
      </select>
      {custom && (
        <input
          aria-label="Link address"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={bannerButtonLimits.link}
          placeholder="/products/ or https://instagram.com/…"
          aria-invalid={!!error}
          className={`${input} mt-2 aria-invalid:border-red-700`}
        />
      )}
      <p className={`mt-1 break-all text-xs ${error ? "text-red-700" : "text-chocolate/50"}`}>
        {error ?? (value ? `Link: ${value}` : "Pick a page, category or product.")}
      </p>
    </div>
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

// How the banner will look, on a computer or a phone. Closes with ×, Escape or a click outside.
function PreviewDialog({ dialog, banner, labels }: { dialog: RefObject<HTMLDialogElement | null>; banner: Banner; labels: Labels }) {
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  return (
    <dialog
      ref={dialog}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      className="m-auto max-h-[92vh] w-[min(94vw,72rem)] rounded-3xl bg-cream p-0 text-chocolate backdrop:bg-espresso/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-chocolate/10 px-5 py-4">
        <h3 className="font-medium">Preview</h3>
        <div className="flex items-center gap-2">
          {(["desktop", "mobile"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setView(k)} aria-pressed={view === k} className={pill(view === k)}>
              {k === "desktop" ? "Computer" : "Phone"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close preview"
            className="ml-2 flex h-9 w-9 items-center justify-center rounded-full text-chocolate/60 hover:bg-chocolate/10 hover:text-chocolate"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      </div>
      <div className="overflow-auto bg-ivory/50 p-4 md:p-6">
        {banner.image && (
          // inert: the preview's buttons are only for show
          <div
            inert
            className={
              view === "desktop"
                ? "min-w-3xl overflow-hidden rounded-xl shadow-lg"
                : "mx-auto w-[360px] overflow-hidden rounded-[2rem] border-[6px] border-espresso shadow-xl"
            }
          >
            <HeroBanner key={view} banner={{ ...banner, image: banner.image }} labels={labels} view={view} />
          </div>
        )}
        {!banner.enabled && (
          <p className="mt-4 text-center text-sm text-amber-900">The banner is hidden: switch it on at the top and save to show it to customers.</p>
        )}
      </div>
    </dialog>
  );
}

// One picture: click or drop a file to upload it; replace or remove it once there
function ImageTile({
  title,
  hint,
  image,
  error,
  onChange,
}: {
  title: string;
  hint: string;
  image: BannerImage | null;
  error?: string;
  onChange: (image: BannerImage | null) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function handleFile(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    setUploadError("");
    if (!IMAGE_TYPES.includes(file.type)) return setUploadError(`${file.name} is not a JPG, PNG or WebP picture.`);
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      return setUploadError(`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. Pictures can be up to ${MAX_IMAGE_MB} MB.`);
    }
    setUploading(true);
    try {
      onChange(await uploadToCloudinary(await shrink(file, MAX_SIDE), "banner"));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (!uploading) handleFile(e.dataTransfer.files[0]);
  }

  const problem = uploadError || error;
  return (
    <div className="flex flex-col">
      <p className="mb-2 text-sm font-medium">{title}</p>
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        disabled={uploading}
        aria-label={image ? `Replace the ${title.toLowerCase()} picture` : `Upload the ${title.toLowerCase()} picture`}
        className={`group relative flex min-h-40 flex-1 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors ${
          dragOver ? "border-gold bg-gold/10" : problem ? "border-red-700/50" : "border-chocolate/20 hover:border-gold"
        } ${image ? "bg-espresso" : "bg-white/50"}`}
      >
        {image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- an admin thumbnail of a Cloudinary picture */}
            <img src={image.url} alt="" className="max-h-56 w-full object-contain" />
            <span className="absolute inset-0 flex items-center justify-center bg-espresso/60 text-xs uppercase tracking-[0.15em] text-ivory opacity-0 transition-opacity group-hover:opacity-100">
              Change picture
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-2 px-4 py-6 text-center text-chocolate/60">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-gold" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </svg>
            <span className="text-sm">Click or drop a picture here</span>
            <span className="text-xs text-chocolate/50">{hint}</span>
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center gap-2 bg-cream/85 text-sm">
            <Spinner /> Uploading…
          </span>
        )}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <div className="mt-2 flex min-h-5 items-center justify-between gap-3 text-xs">
        <span className="text-chocolate/50">
          {image ? `${image.width} × ${image.height} px` : `JPG, PNG or WebP, up to ${MAX_IMAGE_MB} MB`}
        </span>
        {image && !uploading && (
          <button type="button" onClick={() => onChange(null)} className="uppercase tracking-[0.15em] text-chocolate/60 hover:text-red-700">
            Remove
          </button>
        )}
      </div>
      {problem && (
        <p className="mt-1 text-xs text-red-700" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
