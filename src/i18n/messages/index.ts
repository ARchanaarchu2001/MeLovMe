import type { Locale } from "../config";
import en from "./en.json";

// All the site's text, one file per language, grouped by page (common, home, about…).
// English is the source language: every other locale must have the same keys.
export type Messages = typeof en;

export const messages: Record<Locale, Messages> = { en };
