import en from "./modules/i18n/messages/en.json";

// en.json is the reference: a wrong message key is a type error. de.json must
// still be kept in sync by hand.
declare module "next-intl" {
  interface AppConfig {
    Messages: typeof en;
    Locale: "en" | "de";
  }
}
