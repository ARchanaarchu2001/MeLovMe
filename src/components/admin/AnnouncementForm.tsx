"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { saveAnnouncement } from "@/app/actions/admin";
import AnnouncementBar from "@/components/AnnouncementBar";
import Spinner from "@/components/Spinner";
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
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const update = (patch: Partial<Announcement>) => {
    setV((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };
  const setMessage = (i: number, patch: { text?: string; link?: string }) =>
    update({ messages: v.messages.map((m, k) => (k === i ? { ...m, ...patch } : m)) });
  const moveMessage = (i: number, to: number) => {
    const messages = [...v.messages];
    const [m] = messages.splice(i, 1);
    messages.splice(to, 0, m);
    update({ messages });
  };

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveAnnouncement(v);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setError("");
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
              /products/, or a full https:// link.
            </p>
          </div>
          {v.messages.map((m, i) => (
            <div key={i} className="grid gap-2 rounded-xl bg-ivory/60 p-3 sm:grid-cols-[1fr_12rem_auto] sm:items-center">
              <input
                value={m.text}
                onChange={(e) => setMessage(i, { text: e.target.value })}
                maxLength={120}
                placeholder="Message, e.g. Flat 30% off | Summer Collection"
                aria-label={`Message ${i + 1}`}
                className={input}
              />
              <input
                value={m.link ?? ""}
                onChange={(e) => setMessage(i, { link: e.target.value })}
                maxLength={300}
                placeholder="Link (optional)"
                aria-label={`Link for message ${i + 1}`}
                className={input}
              />
              <div className="flex items-center justify-end gap-1 text-chocolate/60">
                <button type="button" onClick={() => moveMessage(i, i - 1)} disabled={i === 0} className="px-2 py-1 hover:text-gold disabled:opacity-25" aria-label={`Move message ${i + 1} up`} title="Move up">↑</button>
                <button type="button" onClick={() => moveMessage(i, i + 1)} disabled={i === v.messages.length - 1} className="px-2 py-1 hover:text-gold disabled:opacity-25" aria-label={`Move message ${i + 1} down`} title="Move down">↓</button>
                <button
                  type="button"
                  onClick={() => update({ messages: v.messages.filter((_, k) => k !== i) })}
                  className="px-2 py-1 hover:text-red-700"
                  aria-label={`Remove message ${i + 1}`}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
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
            <ColorField label="Background" value={v.background} onChange={(background) => update({ background })} />
            <ColorField label="Text" value={v.textColor} onChange={(textColor) => update({ textColor })} />
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

          {error && (
            <p className="rounded-xl bg-red-700/10 px-4 py-3 text-sm text-red-800" role="alert">
              {error}
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
function ColorField({ label: text, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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
          className={`${input} font-mono uppercase`}
        />
      </div>
    </div>
  );
}
