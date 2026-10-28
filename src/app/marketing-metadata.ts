import { getCatalog } from "@/i18n/translator";
import type { Locale } from "@/i18n/locales";

export function getMarketingMetadata(locale: Locale) {
  const catalog = getCatalog(locale);
  return {
    title: catalog["marketing.metaTitle"],
    description: catalog["marketing.metaDescription"]
  };
}
