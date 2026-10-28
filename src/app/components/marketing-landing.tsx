import Link from "next/link";
import Image from "next/image";
import {
  IconArrowUpRight,
  IconCheck,
  IconCpu,
  IconDatabase,
  IconFileText,
  IconKeyOff,
  IconLock,
  IconMail,
  IconSearch,
  IconShieldCheck
} from "@tabler/icons-react";

import type { Translator } from "@/i18n/translator";

export function MarketingLanding({ t }: { t: Translator["t"] }) {
  return (
    <main className="pw-main pw-marketing-main">
      <div className="pw-marketing">
        <section className="pw-marketing-hero" aria-labelledby="marketing-heading">
          <div className="pw-marketing-copy">
            <p className="pw-marketing-kicker">{t("marketing.kicker")}</p>
            <h1 id="marketing-heading">{t("marketing.heading")}</h1>
            <p className="pw-marketing-lede">{t("marketing.lede")}</p>
            <div className="pw-marketing-actions">
              <Link className="pw-marketing-primary" href="/login">
                {t("marketing.cta")}
                <IconArrowUpRight aria-hidden="true" size={19} />
              </Link>
              <a className="pw-marketing-secondary" href="#how-it-works">{t("marketing.learnMore")}</a>
            </div>
            <p className="pw-marketing-trust">
              <IconShieldCheck aria-hidden="true" size={17} />
              {t("marketing.trust")}
            </p>
          </div>

          <div className="pw-marketing-visual">
            <figure className="pw-marketing-screenshot">
              <Image
                src="/marketing/dashboard-demo.png"
                alt={t("marketing.dashboardAlt")}
                width={1440}
                height={900}
                unoptimized
                priority
              />
              <figcaption>{t("marketing.demoCaption")}</figcaption>
            </figure>
          </div>
        </section>

        <section className="pw-marketing-how" id="how-it-works" aria-labelledby="marketing-how-heading">
          <div className="pw-marketing-section-heading">
            <p className="pw-marketing-kicker">{t("marketing.howEyebrow")}</p>
            <h2 id="marketing-how-heading">{t("marketing.howHeading")}</h2>
            <p>{t("marketing.howLede")}</p>
          </div>
          <div className="pw-marketing-features">
            <article className="pw-marketing-feature">
              <span className="pw-marketing-feature-number">01</span>
              <h3>{t("marketing.featureVerifyTitle")}</h3>
              <p>{t("marketing.featureVerifyBody")}</p>
            </article>
            <article className="pw-marketing-feature">
              <span className="pw-marketing-feature-number">02</span>
              <h3>{t("marketing.featureOrganizeTitle")}</h3>
              <p>{t("marketing.featureOrganizeBody")}</p>
            </article>
            <article className="pw-marketing-feature">
              <span className="pw-marketing-feature-number">03</span>
              <h3>{t("marketing.featureImportTitle")}</h3>
              <p>{t("marketing.featureImportBody")}</p>
            </article>
          </div>
        </section>

        <section className="pw-marketing-automation" aria-labelledby="marketing-automation-heading">
          <div className="pw-marketing-section-heading">
            <p className="pw-marketing-kicker">{t("marketing.automationEyebrow")}</p>
            <h2 id="marketing-automation-heading">{t("marketing.automationHeading")}</h2>
            <p>{t("marketing.automationLede")}</p>
          </div>

          <div className="pw-marketing-automation-grid">
            <article className="pw-marketing-automation-card">
              <div className="pw-marketing-automation-card-top">
                <span className="pw-marketing-automation-icon"><IconFileText aria-hidden="true" size={23} /></span>
                <span className="pw-marketing-automation-tag">{t("marketing.mcpTag")}</span>
              </div>
              <h3>{t("marketing.mcpTitle")}</h3>
              <p>{t("marketing.mcpBody")}</p>
              <p className="pw-marketing-plain-note">{t("marketing.mcpExplainer")}</p>
              <div className="pw-marketing-mcp-query">
                <span aria-hidden="true"><IconSearch size={20} stroke={1.9} /></span>
                <div>
                  <strong>{t("marketing.mcpQueryTitle")}</strong>
                  <p>{t("marketing.mcpQueryBody")}</p>
                  <small>{t("marketing.mcpQueryPrivacy")}</small>
                </div>
              </div>
              <ol className="pw-marketing-steps">
                <li><span>1</span>{t("marketing.mcpStepOne")}</li>
                <li><span>2</span>{t("marketing.mcpStepTwo")}</li>
                <li><span>3</span>{t("marketing.mcpStepThree")}</li>
              </ol>
              <p className="pw-marketing-automation-note">
                <IconShieldCheck aria-hidden="true" size={18} />
                {t("marketing.mcpPrivacy")}
              </p>
            </article>

            <article className="pw-marketing-automation-card pw-marketing-automation-card--email">
              <div className="pw-marketing-automation-card-top">
                <span className="pw-marketing-automation-icon"><IconMail aria-hidden="true" size={23} /></span>
                <span className="pw-marketing-automation-tag">{t("marketing.emailTag")}</span>
              </div>
              <h3>{t("marketing.emailTitle")}</h3>
              <p>{t("marketing.emailBody")}</p>
              <p className="pw-marketing-plain-note">{t("marketing.emailExplainer")}</p>
              <ol className="pw-marketing-steps">
                <li><span>1</span>{t("marketing.emailStepOne")}</li>
                <li><span>2</span>{t("marketing.emailStepTwo")}</li>
                <li><span>3</span>{t("marketing.emailStepThree")}</li>
              </ol>
              <p className="pw-marketing-automation-note">
                <IconShieldCheck aria-hidden="true" size={18} />
                {t("marketing.emailPrivacy")}
              </p>
            </article>
          </div>

          <div className="pw-marketing-control">
            <div className="pw-marketing-control-heading">
              <span><IconLock aria-hidden="true" size={22} /></span>
              <div>
                <h3>{t("marketing.controlHeading")}</h3>
                <p>{t("marketing.controlLede")}</p>
              </div>
            </div>
            <ul>
              <li><IconCheck aria-hidden="true" size={17} />{t("marketing.controlNoPassword")}</li>
              <li><IconCheck aria-hidden="true" size={17} />{t("marketing.controlReview")}</li>
              <li><IconCheck aria-hidden="true" size={17} />{t("marketing.controlDuplicates")}</li>
            </ul>
          </div>
        </section>

        <section className="pw-marketing-privacy" id="privacy" aria-labelledby="marketing-privacy-heading">
          <div className="pw-marketing-section-heading">
            <p className="pw-marketing-kicker">{t("marketing.privacyEyebrow")}</p>
            <h2 id="marketing-privacy-heading">{t("marketing.privacyHeading")}</h2>
            <p>{t("marketing.privacyLede")}</p>
          </div>

          <div className="pw-marketing-privacy-grid">
            <article className="pw-marketing-privacy-main">
              <div className="pw-marketing-privacy-card-top">
                <span className="pw-marketing-privacy-icon" aria-hidden="true">
                  <IconDatabase size={24} stroke={1.8} />
                </span>
                <span className="pw-marketing-privacy-tag">{t("marketing.selfHostedTag")}</span>
              </div>
              <h3>{t("marketing.selfHostedTitle")}</h3>
              <p>{t("marketing.selfHostedBody")}</p>
              <a
                className="pw-marketing-github-link"
                href="https://github.com/vishal3152/Money-Watch"
              >
                {t("marketing.selfHostedLink")}
                <IconArrowUpRight aria-hidden="true" size={18} />
              </a>
              <ul>
                <li><IconCheck size={18} stroke={2.2} aria-hidden="true" />{t("marketing.selfHostedNoAccount")}</li>
                <li><IconCheck size={18} stroke={2.2} aria-hidden="true" />{t("marketing.selfHostedNoTelemetry")}</li>
                <li><IconCheck size={18} stroke={2.2} aria-hidden="true" />{t("marketing.selfHostedNetwork")}</li>
              </ul>
            </article>

            <div className="pw-marketing-privacy-stack">
              <article className="pw-marketing-privacy-card">
                <div className="pw-marketing-privacy-card-heading">
                  <span className="pw-marketing-privacy-card-icon" aria-hidden="true">
                    <IconKeyOff size={22} stroke={1.8} />
                  </span>
                  <h3>{t("marketing.bankPrivacyTitle")}</h3>
                </div>
                <p>{t("marketing.bankPrivacyBody")}</p>
              </article>

              <article className="pw-marketing-privacy-card">
                <div className="pw-marketing-privacy-card-heading">
                  <span className="pw-marketing-privacy-card-icon" aria-hidden="true">
                    <IconCpu size={22} stroke={1.8} />
                  </span>
                  <h3>{t("marketing.localLlmTitle")}</h3>
                </div>
                <p>{t("marketing.localLlmBody")}</p>
                <p className="pw-marketing-privacy-boundary">{t("marketing.localLlmBoundary")}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="pw-marketing-bottom-cta" aria-labelledby="marketing-bottom-heading">
          <div>
            <p className="pw-marketing-kicker">{t("marketing.bottomEyebrow")}</p>
            <h2 id="marketing-bottom-heading">{t("marketing.bottomHeading")}</h2>
          </div>
          <Link className="pw-marketing-primary" href="/login">
            {t("marketing.cta")}
            <IconArrowUpRight aria-hidden="true" size={19} />
          </Link>
        </section>
        <footer className="pw-marketing-footer">
          <span>{t("marketing.footer")}</span>
          <span>{t("marketing.footerLine")}</span>
        </footer>
      </div>
    </main>
  );
}
