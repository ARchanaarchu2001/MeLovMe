"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import { sendContactMessage } from "@/app/actions/contact";
import { site } from "@/data/site";
import { contactFields, contactLimits, MESSAGE_MIN, validateContact, type ContactMessage } from "@/lib/contact";
import Select from "./Select";
import Spinner from "./Spinner";

type Errors = Partial<Record<keyof ContactMessage, string>>;

// Sends the message to the shop's inbox by email (EmailJS, see src/app/actions/contact.ts).
// Until EmailJS is set up in .env, it falls back to opening the visitor's email app pre-filled.
export default function ContactForm() {
  const t = useTranslations("contact.form");
  const [status, setStatus] = useState<"idle" | "sent" | "opened" | "error">("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();

  // Error codes from validateContact -> messages in contact.form.errors
  const messages = (found: ReturnType<typeof validateContact>): Errors =>
    Object.fromEntries(
      Object.entries(found).map(([f, code]) => [
        f,
        t(`errors.${code}`, { max: contactLimits[f as keyof ContactMessage], min: MESSAGE_MIN }),
      ]),
    );

  function openEmailApp(data: FormData) {
    const subject = `${data.get("topic")} — ${data.get("name")}`;
    const body = t("emailBody", {
      message: String(data.get("message")),
      name: String(data.get("name")),
      email: String(data.get("email")),
      phone: String(data.get("phone") || "-"),
    });
    window.location.href = `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setStatus("idle");

    // Validate every field up front so all problems are shown together, not one at a time
    const msg = Object.fromEntries(contactFields.map((f) => [f, String(data.get(f) ?? "").trim()])) as ContactMessage;
    const found = validateContact(msg);
    setErrors(messages(found));
    const firstInvalid = contactFields.find((f) => found[f]);
    if (firstInvalid) return (form.elements.namedItem(firstInvalid) as HTMLElement | null)?.focus();

    startTransition(async () => {
      const res = await sendContactMessage(data).catch(() => ({ error: "failed" as const }));
      if ("ok" in res) {
        form.reset();
        setStatus("sent");
      } else if (res.error === "invalid") {
        setErrors(messages(res.errors));
      } else if (res.error === "not_configured") {
        openEmailApp(data);
        setStatus("opened");
      } else {
        setStatus("error");
      }
    });
  }

  const field =
    "w-full rounded-xl border border-ivory/20 bg-transparent px-4 py-3 text-sm text-ivory placeholder:text-ivory/40 outline-none focus:border-gold";

  // Shared props for a text field: error styling, screen-reader links, and clearing the error on edit
  const props = (name: "name" | "email" | "phone" | "message") => ({
    name,
    "aria-label": t(name),
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `contact-${name}-error` : undefined,
    className: `${field} ${errors[name] ? "!border-red-300" : ""}`,
    onChange: () => errors[name] && setErrors({ ...errors, [name]: undefined }),
  });
  const error = (name: keyof ContactMessage) =>
    errors[name] && (
      <p id={`contact-${name}-error`} className="mt-1.5 text-xs text-red-300">
        {errors[name]}
      </p>
    );

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 grid gap-5 sm:grid-cols-2">
      <div>
        <input {...props("name")} required autoComplete="name" maxLength={contactLimits.name} placeholder={t("name")} />
        {error("name")}
      </div>
      <div>
        <input
          {...props("email")}
          type="email"
          required
          autoComplete="email"
          maxLength={contactLimits.email}
          placeholder={t("email")}
        />
        {error("email")}
      </div>
      <div>
        {/* Optional, but if given: a 10-digit Indian mobile number (digits only) */}
        <input
          {...props("phone")}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={contactLimits.phone}
          onInput={(e) => (e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 10))}
          placeholder={t("phone")}
        />
        {error("phone")}
      </div>
      <Select
        name="topic"
        options={(["general", "product", "wholesale", "corporate"] as const).map((k) => t(`topics.${k}`))}
      />
      <div className="sm:col-span-2">
        <textarea
          {...props("message")}
          required
          maxLength={contactLimits.message}
          rows={5}
          placeholder={t("message")}
        />
        {error("message")}
      </div>
      {/* Spam trap: hidden from people, filled in by bots */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button type="submit" className="btn btn-gold" disabled={pending}>
          {pending && <Spinner />}
          {pending ? t("sending") : t("submit")}
        </button>
        <p className="text-sm text-ivory/70" role="status">
          {status === "sent" && t("sent")}
          {status === "opened" && t("opened")}
        </p>
        {status === "error" && (
          <p className="w-full text-sm text-red-300" role="alert">
            {t("failed", { email: site.email })}
          </p>
        )}
      </div>
    </form>
  );
}
