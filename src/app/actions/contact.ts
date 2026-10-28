"use server";

// Sends the contact form to the shop's inbox through EmailJS (https://www.emailjs.com).
// The keys stay on the server (no NEXT_PUBLIC_), so visitors can't reuse them to send mail.
// EmailJS fills its template with `template_params`: {{name}}, {{email}}, {{phone}}, {{topic}},
// {{message}} and {{reply_to}} (the visitor's email, so "Reply" in your inbox answers them).

import { contactFields, validateContact, type ContactError, type ContactMessage } from "@/lib/contact";

export async function sendContactMessage(
  formData: FormData,
): Promise<
  | { ok: true }
  | { error: "invalid"; errors: Partial<Record<keyof ContactMessage, ContactError>> }
  | { error: "not_configured" | "failed" }
> {
  // Hidden field that people never see: bots that fill every box get a fake "sent"
  if (String(formData.get("website") ?? "").trim()) return { ok: true };

  // Same checks as the form, since a request can skip the browser
  const msg = Object.fromEntries(
    contactFields.map((f) => [f, String(formData.get(f) ?? "").trim()]),
  ) as ContactMessage;
  const errors = validateContact(msg);
  if (Object.keys(errors).length) return { error: "invalid", errors };
  const params = { ...msg, phone: msg.phone || "-" };

  const { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY } = process.env;
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY || !EMAILJS_PRIVATE_KEY) {
    return { error: "not_configured" };
  }

  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        accessToken: EMAILJS_PRIVATE_KEY,
        template_params: { ...params, reply_to: params.email },
      }),
    });
    if (!res.ok) {
      console.error("EmailJS error", res.status, await res.text());
      return { error: "failed" };
    }
    return { ok: true };
  } catch (err) {
    console.error("EmailJS error", err);
    return { error: "failed" };
  }
}
