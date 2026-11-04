import Link from "next/link";
import { IconCloud, IconDeviceDesktop } from "@tabler/icons-react";

import { BrandMark } from "@/app/components/brand-mark";
import { HeaderLanguageSwitcher } from "@/app/components/header-language-switcher";
import { NavTabs } from "@/app/components/nav-tabs";
import { shouldShowNavTabs } from "@/app/components/nav-tabs-visibility";
import { isCloudMode } from "@/config/deployment-mode";
import { getLocale, getTranslator } from "@/i18n/server";
import { getCurrentOwnerId } from "@/lib/cloud-auth/current-owner";

export async function AppHeader() {
  const locale = await getLocale();
  const { t } = await getTranslator();
  const cloudMode = isCloudMode();
  const ownerId = await getCurrentOwnerId();
  const publicCloud = cloudMode && ownerId === null;
  const showNavTabs = shouldShowNavTabs({ isCloudMode: cloudMode, hasSession: ownerId !== null });

  let ownerControls = null;
  if (cloudMode) {
    const { CloudOwnerControls } = await import("@/app/components/cloud-owner-controls");
    ownerControls = <CloudOwnerControls />;
  }

  return (
    <header className={publicCloud ? "pw-header pw-header--public" : "pw-header"}>
      <div className="pw-header-start">
        <Link className="pw-brand" href="/" prefetch={false} aria-label="Money Watch">
          <BrandMark />
          <span className="pw-brand-name">
            <span className="pw-brand-name-lead">Money</span>{" "}
            <span className="pw-brand-name-tail">Watch</span>
          </span>
        </Link>
        {showNavTabs ? <NavTabs /> : null}
      </div>
      <div className="pw-header-actions">
        <HeaderLanguageSwitcher currentLocale={locale} />
        {publicCloud ? (
          <>
            <a
              className="pw-header-download"
              href="https://github.com/vishal3152/MoneyWatch/releases"
              aria-label={`${t("nav.downloadTier")}: ${t("nav.download")}`}
            >
              <IconDeviceDesktop className="pw-header-cta-icon" aria-hidden="true" stroke={1.8} />
              <span className="pw-header-cta-label">{t("nav.download")}</span>
            </a>
            <Link
              className="pw-header-sign-in"
              href="/login"
              aria-label={`${t("nav.signInTier")}: ${t("nav.signIn")}`}
            >
              <IconCloud className="pw-header-cta-icon" aria-hidden="true" stroke={1.8} />
              <span className="pw-header-cta-label">{t("nav.signIn")}</span>
            </Link>
          </>
        ) : null}
        {ownerControls}
      </div>
    </header>
  );
}
