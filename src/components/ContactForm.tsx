"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { site } from "@/data/site";
import Select from "./Select";

// Static site has no backend, so the form opens the visitor's email app
// pre-filled. Swap for Formspree / a serverless endpoint later if needed.
export default function ContactForm() {
  const t = useTranslations("contact.form");
  const [sent, setSent] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const subject = `${data.get("topic")} — ${data.get("name")}`;
    const body = t("emailBody", {
      message: String(data.get("message")),
      name: String(data.get("name")),
      email: String(data.get("email")),
      phone: String(data.get("phone") || "-"),
    });
    window.location.href = `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  const field =
    "w-full rounded-xl border border-ivory/20 bg-transparent px-4 py-3 text-sm text-ivory placeholder:text-ivory/40 outline-none focus:border-gold";

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-5 sm:grid-cols-2">
      <input name="name" required placeholder={t("name")} className={field} />
      <input name="email" type="email" required placeholder={t("email")} className={field} />
      <input name="phone" type="tel" placeholder={t("phone")} className={field} />
      <Select
        name="topic"
        options={(["general", "product", "wholesale", "corporate"] as const).map((k) => t(`topics.${k}`))}
      />
      <textarea name="message" required rows={5} placeholder={t("message")} className={`${field} sm:col-span-2`} />
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button type="submit" className="btn btn-gold">{t("submit")}</button>
        {sent && <p className="text-sm text-ivory/70">{t("sent")}</p>}
      </div>
    </form>
  );
}
