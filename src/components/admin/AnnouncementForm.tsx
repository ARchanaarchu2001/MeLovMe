"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { saveAnnouncement } from "@/app/actions/admin";
import AnnouncementBar from "@/components/AnnouncementBar";
import Spinner from "@/components/Spinner";
import { hasAnnouncementErrors, validateAnnouncement, type AnnouncementErrors } from "@/lib/admin-validation";
import { HEX_COLOR, announcementSpeeds, defaultAnnouncement, type Announcement } from "@/lib/announcement";

const input = "w-full rounded-xl border border-chocolate/20 bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-gold";
const label = "mb-1.5 block text-xs uppercase tracking-[0.15em] text-chocolate/60";

// Ready-made colour pairs from the brand palette (the first is the default)
const themes = [
  { name: "Espresso & gold", background: "#2e1a11", textColor: "#c9a36a" },
  { name: "Chocolate & ivory", background: "#462b1b", textColor: "#eee1ca" },
  { name: "Ivory & chocolate", background: "#eee1ca", textColor: "#462b1b" },
  { name: "Gold & espresso", background: "#c9a36a", textColor: "#2e1a11" },
  { name: "Charcoal & white", background: "#2b2b2b", textColor: "#ffffff" },
];

const MAX_MESSAGES = 10;

// Edits the announcement bar, with a live preview of how it looks in the shop
export default function AnnouncementForm({ initial }: { initial: Announcement }) {
  const router = useRouter();
  const [v, setV] = useState<Announcement>(initial.messages.length ? initial : { ...initial, messages: [{ text: "" }] });
  const [errors, setErrors] = useState<AnnouncementErrors>({});
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const list = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const update = (patch: Partial<Announcement>) => {
    setV((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };
  const setMessage = (i: number, patch: { text?: string; link?: string }) => {
    update({ messages: v.messages.map((m, k) => (k === i ? { ...m, ...patch } : m)) });
    setErrors((prev) => ({ ...prev, form: undefined, messages: prev.messages?.map((e, k) => (k === i ? undefined : e)) }));
  };
  const moveMessage = (i: number, to: number) => {
    setV((prev) => {
      const messages = [...prev.messages];
      const [m] = messages.splice(i, 1);
      messages.splice(to, 0, m);
      return { ...prev, messages };
    });
    // Row errors belong to rows by position, so they'd point at the wrong ones after a move
    setErrors((prev) => ({ ...prev, messages: undefined }));
    setSaved(false);
  };

  // Drag a row by its handle (mouse or finger): rows swap as it passes their middle
  function startDrag(e: ReactPointerEvent, i: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    let from = i;
    setDragging(i);
    const onMove = (ev: PointerEvent) => {
      const rows = [...(list.current?.querySelectorAll<HTMLElement>("[data-row]") ?? [])];
      const to = rows.filter((row, k) => {
        if (k === from) return false;
        const box = row.getBoundingClientRect();
        return ev.clientY > box.top + box.height / 2;
      }).length;
      if (to !== from) {
        moveMessage(from, to);
        from = to;
        setDragging(to);
      }
    };
    const onUp = () => {
      setDragging(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  // Keyboard: focus the handle, then ↑ / ↓ moves the row
  function handleKey(e: KeyboardEvent, i: number) {
    const to = e.key === "ArrowUp" ? i - 1 : e.key === "ArrowDown" ? i + 1 : -1;
    if (to < 0 || to >= v.messages.length) return;
    e.preventDefault();
    moveMessage(i, to);
    requestAnimationFrame(() => list.current?.querySelectorAll<HTMLElement>("[data-handle]")[to]?.focus());
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateAnnouncement(v);
    if (hasAnnouncementErrors(found)) return setErrors(found);
    startTransition(async () => {
      const res = await saveAnnouncement(v);
      if ("errors" in res) return setErrors(res.errors);
      setErrors({});
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-6">
      {/* Live preview */}
      <section className="grid gap-2">
        <p className={label}>Preview</p>
        <div className="overflow-hidden rounded-2xl border border-chocolate/15 bg-white/40">
          {v.messages.some((m) => m.text.trim()) ? (
            <AnnouncementBar announcement={v} preview />
          ) : (
            <p className="px-5 py-2.5 text-center text-xs text-chocolate/50">Add a message to see the preview.</p>
          )}
          <div className="h-10 border-t border-chocolate/10 bg-cream/90" aria-hidden="true" />
        </div>
        {!v.enabled && <p className="text-xs text-chocolate/60">The bar is switched off: customers won&apos;t see it.</p>}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="grid h-fit gap-4 rounded-2xl border border-chocolate/15 p-5">
          <div>
            <p className="text-sm font-medium">Messages</p>
            <p className="text-xs text-chocolate/60">
              They scroll one after another, e.g. &ldquo;Free shipping above ₹999&rdquo;. A link is optional: a shop page like
              /products/, or a full https:// link. Drag <span aria-hidden="true">⠿</span> to change the order, then save.
            </p>
          </div>
          <div ref={list} className="grid gap-3">
            {v.messages.map((m, i) => {
              const rowErrors = errors.messages?.[i];
              return (
                <div
                  key={i}
                  data-row
                  className={`rounded-xl p-3 transition-shadow ${
                    dragging === i ? "relative z-10 bg-white shadow-[0_12px_30px_-12px_rgba(46,26,17,0.45)] ring-1 ring-gold/60" : "bg-ivory/60"
                  }`}
                >
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:grid-cols-[auto_1fr_12rem_auto]">
                    {/* Drag handle */}
                    <button
                      type="button"
                      data-handle
                      onPointerDown={(e) => startDrag(e, i)}
                      onKeyDown={(e) => handleKey(e, i)}
                      aria-label={`Message ${i + 1}: drag, or press up and down arrows, to change the order`}
                      title="Drag to reorder"
                      className={`flex h-9 w-7 touch-none items-center justify-center rounded-lg text-chocolate/40 hover:bg-chocolate/5 hover:text-chocolate ${
                        dragging === i ? "cursor-grabbing text-gold" : "cursor-grab"
                      }`}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                        <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
                        <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
                        <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
                      </svg>
                    </button>
                    <input
                      value={m.text}
                      onChange={(e) => setMessage(i, { text: e.target.value })}
                      maxLength={120}
                      placeholder="Message, e.g. Flat 30% off | Summer Collection"
                      aria-label={`Message ${i + 1}`}
                      aria-invalid={!!rowErrors?.text}
                      className={`${input} aria-invalid:border-red-700`}
                    />
                    <input
                      value={m.link ?? ""}
                      onChange={(e) => setMessage(i, { link: e.target.value })}
                      maxLength={300}
                      placeholder="Link (optional)"
                      aria-label={`Link for message ${i + 1}`}
                      aria-invalid={!!rowErrors?.link}
                      className={`${input} col-start-2 row-start-2 aria-invalid:border-red-700 sm:col-start-auto sm:row-start-auto`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        update({ messages: v.messages.filter((_, k) => k !== i) });
                        setErrors((prev) => ({ ...prev, messages: undefined }));
                      }}
                      className="col-start-3 row-start-1 flex h-9 w-9 items-center justify-center rounded-full text-chocolate/50 hover:bg-red-700/10 hover:text-red-700 sm:col-start-auto"
                      aria-label={`Remove message ${i + 1}`}
                      title="Remove"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6 6 18" />
                      </svg>
                    </button>
                  </div>
                  {(rowErrors?.text || rowErrors?.link) && (
                    <p className="mt-1.5 pl-9 text-xs text-red-700">{[rowErrors.text, rowErrors.link].filter(Boolean).join(" ")}</p>
                  )}
                </div>
              );
            })}
          </div>
          {v.messages.length < MAX_MESSAGES && (
            <button
              type="button"
              onClick={() => update({ messages: [...v.messages, { text: "" }] })}
              className="justify-self-start rounded-full border border-dashed border-chocolate/30 px-5 py-2 text-xs uppercase tracking-[0.12em] text-chocolate/70 hover:border-gold hover:text-gold"
            >
              + Add message
            </button>
          )}
        </section>

        <div className="grid h-fit gap-5 lg:sticky lg:top-28">
          <div className="rounded-2xl border border-chocolate/15 p-5">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-medium">Show in shop</span>
                <span className="text-xs text-chocolate/60">Shows the bar above the header on every shop page.</span>
              </span>
              <input type="checkbox" checked={v.enabled} onChange={(e) => update({ enabled: e.target.checked })} className="h-5 w-5 accent-gold" />
            </label>
          </div>

          <div className="grid gap-4 rounded-2xl border border-chocolate/15 p-5">
            <p className="text-sm font-medium">Colours</p>
            <div className="flex flex-wrap gap-2">
              {themes.map((t) => {
                const active = t.background === v.background.toLowerCase() && t.textColor === v.textColor.toLowerCase();
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => update({ background: t.background, textColor: t.textColor })}
                    title={t.name}
                    aria-label={`Use ${t.name}`}
                    aria-pressed={active}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold ${active ? "ring-2 ring-gold ring-offset-2 ring-offset-cream" : ""}`}
                    style={{ background: t.background, color: t.textColor, borderColor: `${t.textColor}55` }}
                  >
                    A
                  </button>
                );
              })}
            </div>
            <ColorField label="Background" value={v.background} error={errors.background} onChange={(background) => update({ background })} />
            <ColorField label="Text" value={v.textColor} error={errors.textColor} onChange={(textColor) => update({ textColor })} />
            <button
              type="button"
              onClick={() => update({ background: defaultAnnouncement.background, textColor: defaultAnnouncement.textColor })}
              className="justify-self-start text-xs uppercase tracking-[0.15em] text-chocolate/60 hover:text-gold"
            >
              Reset to brand colours
            </button>
          </div>

          <div className="grid gap-3 rounded-2xl border border-chocolate/15 p-5">
            <p className="text-sm font-medium">Scroll speed</p>
            <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.12em]">
              {announcementSpeeds.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => update({ speed: s })}
                  aria-pressed={v.speed === s}
                  className={`rounded-full px-4 py-1.5 ${v.speed === s ? "bg-chocolate text-ivory" : "border border-chocolate/20 hover:border-gold"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {hasAnnouncementErrors(errors) && (
            <p className="rounded-xl bg-red-700/10 px-4 py-3 text-sm text-red-800" role="alert">
              {errors.form ?? "Please fix the highlighted fields."}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending && <Spinner />}
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
          {saved && <p className="text-sm text-green-800" role="status">Saved. The shop is updated.</p>}
        </div>
      </div>
    </form>
  );
}

// A colour picker with the hex code next to it (either can be edited)
function ColorField({ label: text, value, error, onChange }: { label: string; value: string; error?: string; onChange: (v: string) => void }) {
  const [typed, setTyped] = useState(value);
  // Keep the text box in step when the colour changes elsewhere (picker, theme buttons)
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setTyped(value);
  }
  return (
    <div>
      <span className={label}>{text}</span>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={HEX_COLOR.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${text} colour`}
          className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-chocolate/20 bg-white/60 p-1"
        />
        <input
          value={typed}
          onChange={(e) => {
            const t = e.target.value.trim();
            setTyped(t);
            const hex = t.startsWith("#") ? t : `#${t}`;
            if (HEX_COLOR.test(hex)) onChange(hex.toLowerCase());
          }}
          maxLength={7}
          spellCheck={false}
          aria-label={`${text} colour code`}
          aria-invalid={!!error}
          className={`${input} font-mono uppercase aria-invalid:border-red-700`}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}
    </div>
  );
}
