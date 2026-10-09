"use client";

import { useState, type FormEvent } from "react";
import { site } from "@/data/site";
import Select from "./Select";

// Static site has no backend, so the form opens the visitor's email app
// pre-filled. Swap for Formspree / a serverless endpoint later if needed.
export default function ContactForm() {
  const [sent, setSent] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const subject = `${data.get("topic")} — ${data.get("name")}`;
    const body = `${data.get("message")}\n\nName: ${data.get("name")}\nEmail: ${data.get("email")}\nPhone: ${data.get("phone") || "-"}`;
    window.location.href = `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  const field =
    "w-full rounded-xl border border-ivory/20 bg-transparent px-4 py-3 text-sm text-ivory placeholder:text-ivory/40 outline-none focus:border-gold";

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-5 sm:grid-cols-2">
      <input name="name" required placeholder="Your name" className={field} />
      <input name="email" type="email" required placeholder="Email address" className={field} />
      <input name="phone" type="tel" placeholder="Phone (optional)" className={field} />
      <Select
        name="topic"
        options={["General enquiry", "Product question", "Wholesale / retail", "Corporate gifting"]}
      />
      <textarea name="message" required rows={5} placeholder="How can we help?" className={`${field} sm:col-span-2`} />
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button type="submit" className="btn btn-gold">Send Message</button>
        {sent && <p className="text-sm text-ivory/70">Your email app should open now — thank you!</p>}
      </div>
    </form>
  );
}
