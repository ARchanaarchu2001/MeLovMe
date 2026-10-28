"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { updateProfile } from "@/app/actions/auth";
import { field } from "./AddressForm";
import { PencilIcon } from "./Icons";
import Spinner from "./Spinner";

// Initials for the round avatar, e.g. "Archana M" → "AM"
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => [...w][0] ?? "")
    .join("")
    .toUpperCase() || "?";

// The account card at the top of the profile page: avatar, name (editable in place) and phone
export default function ProfileForm({ name: initialName, phone, memberSince }: { name: string; phone: string; memberSince: string }) {
  const t = useTranslations("account.profileForm");
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  function startEditing() {
    setEditing(true);
    setMessage(null);
    // Focus after the input appears
    requestAnimationFrame(() => nameRef.current?.focus());
  }

  function cancelEditing() {
    setName(saved);
    setEditing(false);
    setMessage(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateProfile(name);
      if ("error" in res) return setMessage({ text: res.error, error: true });
      setSaved(name.trim());
      setName(name.trim());
      setEditing(false);
      setMessage({ text: t("saved") });
    });
  }

  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-ivory p-6 sm:p-8">
      {/* Soft gold glow in the corner */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold/20 blur-3xl" />

      <div className="relative flex items-center gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-espresso text-xl font-medium tracking-wide text-gold ring-4 ring-cream sm:h-20 sm:w-20 sm:text-2xl">
          {initials(saved)}
        </div>

        {editing ? (
          <form onSubmit={handleSubmit} className="min-w-0 flex-1">
            <label htmlFor="name" className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-chocolate/60">{t("name")}</label>
            <input
              id="name"
              ref={nameRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setMessage(null);
              }}
              onKeyDown={(e) => e.key === "Escape" && cancelEditing()}
              autoComplete="name"
              required
              className={field}
            />
            <div className="mt-3 flex items-center gap-5">
              <button type="submit" className="btn btn-primary !px-6 !py-2.5" disabled={pending || name.trim() === saved}>
                {pending && <Spinner />}
                {pending ? t("saving") : t("save")}
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                disabled={pending}
                className="text-xs uppercase tracking-[0.2em] text-chocolate/60 hover:text-chocolate"
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        ) : (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <h2 className="truncate text-2xl font-light sm:text-3xl">{saved}</h2>
              <button
                type="button"
                onClick={startEditing}
                aria-label={t("editName")}
                title={t("editName")}
                className="shrink-0 rounded-full p-2 text-chocolate/50 transition-colors hover:bg-chocolate/5 hover:text-gold"
              >
                <PencilIcon />
              </button>
            </div>
            {/* The phone number is the login ID, so it can't be changed here */}
            <p className="mt-1 flex items-center gap-2 text-sm text-chocolate/70">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-gold" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
              </svg>
              <span>
                <span className="sr-only">{t("phone")}: </span>+91 {phone}
              </span>
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-chocolate/50">{memberSince}</p>
          </div>
        )}
      </div>

      {message && (
        <p className={`relative mt-4 text-sm ${message.error ? "text-red-700" : "text-green-800"}`} role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}
