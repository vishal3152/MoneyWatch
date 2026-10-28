import Link from "next/link";
import { headers } from "next/headers";

import { BackLink } from "@/app/components/back-link";
import { CollapsibleSection } from "@/app/components/collapsible-section";
import { PageHeader, SectionHeader } from "@/app/components/design-system";
import { SettingsForm } from "@/app/settings/settings-form";
import { getConfiguredDatabasePath } from "@/app/settings/actions";
import { getEmailSyncSettingsSummary } from "@/app/settings/email-sync-actions";
import { EmailSyncSettingsForm } from "@/app/settings/email-sync-settings-form";
import { shouldEnforceLlmHostSafety } from "@/app/settings/llm-host-safety-policy";
import { resolveSettingsLede } from "@/app/settings/settings-copy";
import { isCloudMode } from "@/config/deployment-mode";
import { isDesktopApp } from "@/config/is-desktop-app";
import { LanguageForm } from "@/app/settings/language-form";
import { renderMessage } from "@/i18n/rich-text";
import { getLocale, getTranslator } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { t } = await getTranslator();
  const locale = await getLocale();
  const desktop = isDesktopApp();
  const cloud = isCloudMode();
  const requestHeaders = await headers();
  const enforceLlmHostSafety = shouldEnforceLlmHostSafety(cloud, requestHeaders.get("host"));

  return (
    <main className="pw-main">
      <section className="pw-card" aria-labelledby="settings-heading">
        <BackLink href="/" label={t("common.backToDashboard")} />
        <PageHeader
          id="settings-heading"
          title={t("settings.heading")}
          description={cloud ? t(resolveSettingsLede(desktop, cloud)) : undefined}
        />
        <section className="pw-section" aria-labelledby="language-heading">
          <SectionHeader id="language-heading" title={t("settings.language.heading")} />
          <p className="pw-detail-lede">{t("settings.language.help")}</p>
          <LanguageForm currentLocale={locale} />
        </section>
        {!cloud ? (
          <section className="pw-section" aria-label={t("settings.database.label")}>
            <p className="pw-detail-lede">{t(resolveSettingsLede(desktop, cloud))}</p>
            <SettingsForm currentDatabasePath={await getConfiguredDatabasePath()} />
          </section>
        ) : null}
        <section className="pw-section">
          <Link href="/settings/mcp">{t("settings.mcp.heading")}</Link>
        </section>
        <section className="pw-section">
          <CollapsibleSection
            headingId="email-sync-heading"
            heading={t("settings.emailSync.heading")}
            toggleLabel={t("settings.emailSync.heading")}
            defaultExpanded={false}
          >
            <p className="pw-detail-lede">
              {renderMessage(t("settings.emailSync.lede"), {
                importsLink: <Link href="/imports">/imports</Link>
              })}
              {cloud ? ` ${t("settings.emailSync.cronNote")}` : null}
            </p>
            <EmailSyncSettingsForm
              currentSettings={await getEmailSyncSettingsSummary()}
              isCloudMode={cloud}
              enforceLlmHostSafety={enforceLlmHostSafety}
            />
          </CollapsibleSection>
        </section>
      </section>
    </main>
  );
}
