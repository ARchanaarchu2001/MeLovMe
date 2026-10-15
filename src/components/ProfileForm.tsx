"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateProfile } from "@/app/actions/auth";
import { field } from "./AddressForm";

const label = "mb-2 block text-xs uppercase tracking-[0.2em] text-chocolate/60";

export default function ProfileForm({ name: initialName, phone }: { name: string; phone: string }) {
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(initialName);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateProfile(name);
      if ("error" in res) return setMessage({ text: res.error, error: true });
      setSaved(name.trim());
      setMessage({ text: "Saved." });
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className={label}>Name</label>
        <input
          id="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setMessage(null);
          }}
          autoComplete="name"
          required
          className={field}
        />
      </div>
      <div>
        <label htmlFor="phone" className={label}>Phone number</label>
        {/* The phone number is the login ID, so it can't be changed here */}
        <input id="phone" value={`+91 ${phone}`} readOnly className={`${field} bg-transparent text-chocolate/70`} />
      </div>
      <div className="flex items-center gap-6">
        <button type="submit" className="btn btn-primary" disabled={pending || name.trim() === saved}>
          {pending ? "Saving…" : "Save"}
        </button>
        {message && (
          <p className={`text-sm ${message.error ? "text-red-700" : "text-chocolate/70"}`} role="status">
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
