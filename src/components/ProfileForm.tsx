"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { updateProfile } from "@/app/actions/auth";
import { field } from "./AddressForm";
import { PencilIcon } from "./Icons";
import Spinner from "./Spinner";

const label = "mb-2 block text-xs uppercase tracking-[0.2em] text-chocolate/60";
const readOnlyField = `${field} bg-transparent text-chocolate/70`;

export default function ProfileForm({ name: initialName, phone }: { name: string; phone: string }) {
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
    // Focus after the input becomes editable
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className={label}>{t("name")}</label>
        <div className="relative">
          <input
            id="name"
            ref={nameRef}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setMessage(null);
            }}
            readOnly={!editing}
            autoComplete="name"
            required
            className={editing ? field : `${readOnlyField} pr-12`}
          />
          {!editing && (
            <button
              type="button"
              onClick={startEditing}
              aria-label={t("editName")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-chocolate/60 transition-colors hover:bg-chocolate/5 hover:text-chocolate"
            >
              <PencilIcon />
            </button>
          )}
        </div>
      </div>
      <div>
        <label htmlFor="phone" className={label}>{t("phone")}</label>
        {/* The phone number is the login ID, so it can't be changed here */}
        <input id="phone" value={`+91 ${phone}`} readOnly className={readOnlyField} />
      </div>
      {(editing || message) && (
        <div className="flex items-center gap-6">
          {editing && (
            <>
              <button type="submit" className="btn btn-primary" disabled={pending || name.trim() === saved}>
                {pending && <Spinner />}
                {pending ? t("saving") : t("save")}
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                disabled={pending}
                className="text-sm uppercase tracking-[0.2em] text-chocolate/60 hover:text-chocolate"
              >
                {t("cancel")}
              </button>
            </>
          )}
          {message && (
            <p className={`text-sm ${message.error ? "text-red-700" : "text-chocolate/70"}`} role="status">
              {message.text}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
