// Languages the site is available in. To add one, e.g. Tamil:
//   1. add "ta" here
//   2. copy messages/en.json to messages/ta.json, translate the values (keep the keys) and register it in messages/index.ts
//   3. pick the visitor's locale in request.ts (cookie, or a /[locale] route segment)
export const locales = ["en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

// Dates and times are shown in Indian time wherever the server runs
export const timeZone = "Asia/Kolkata";
