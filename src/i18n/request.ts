import { getRequestConfig } from "next-intl/server";
import { defaultLocale, timeZone } from "./config";
import { messages } from "./messages";

// Picked up by the next-intl plugin in next.config.ts; runs for every server render.
// Only English exists for now, so the locale is fixed. Reading a cookie or header here
// would make every page dynamic, so when a second language is added prefer a /[locale]
// route segment (keeps pages cacheable) and return `await requestLocale` instead.
export default getRequestConfig(async () => {
  const locale = defaultLocale;
  return { locale, messages: messages[locale], timeZone };
});
