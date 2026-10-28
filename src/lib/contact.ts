export type ContactMessage = { name: string; email: string; phone: string; topic: string; message: string };

export const contactFields = ["name", "email", "phone", "topic", "message"] as const;

export const contactLimits = { name: 100, email: 200, phone: 10, topic: 100, message: 5000 } as const;
export const MESSAGE_MIN = 10;

// Why a field is invalid; the message for each is in contact.form.errors
export type ContactError =
  | "required"
  | "nameShort"
  | "nameInvalid"
  | "invalidEmail"
  | "invalidPhone"
  | "messageShort"
  | "tooLong";

// Returns an error code per invalid field (empty object when the message is valid).
// The phone number is optional, but if given must be a 10-digit Indian mobile number.
export function validateContact(m: ContactMessage) {
  const errors: Partial<Record<keyof ContactMessage, ContactError>> = {};
  for (const f of contactFields) if (m[f].length > contactLimits[f]) errors[f] = "tooLong";

  if (!m.name) errors.name = "required";
  else if (m.name.length < 2) errors.name = "nameShort";
  else if (!/^\p{L}[\p{L}\p{M}\s.'-]*$/u.test(m.name)) errors.name = "nameInvalid";

  if (!m.email) errors.email = "required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m.email)) errors.email = "invalidEmail";

  if (m.phone && !/^[6-9]\d{9}$/.test(m.phone)) errors.phone = "invalidPhone";

  if (!m.topic) errors.topic = "required";

  if (!m.message) errors.message = "required";
  else if (m.message.length < MESSAGE_MIN) errors.message = "messageShort";
  else if (m.message.length > contactLimits.message) errors.message = "tooLong";

  return errors;
}
