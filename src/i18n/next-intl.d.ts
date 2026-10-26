import type { Locale } from "./config";
import type { Messages } from "./messages";

// Type-checks translation keys: t("missing.key") is a compile error
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
