import Link from "next/link";

import { BackLink } from "@/app/components/back-link";
import { PageHeader } from "@/app/components/design-system";
import { getInstitutionRepository } from "@/db/repository-factory";
import { getTranslator } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function InstitutionsPage() {
  const { t } = await getTranslator();
  const institutions = await (await getInstitutionRepository()).listAll();

  return (
    <main className="pw-main">
      <section className="pw-dashboard" aria-labelledby="institutions-heading">
        <BackLink href="/" label={t("common.backToDashboard")} />
        <PageHeader
          id="institutions-heading"
          title={t("institutions.list.heading")}
          actions={(
            <Link className="pw-text-link-trigger" href="/institutions/new">
              {t("institutions.new.heading")}
            </Link>
          )}
        />
        {institutions.length > 0 ? (
          <ul className="pw-list">
            {institutions.map((institution) => (
              <li key={institution.id}>
                <Link href={`/institutions/${institution.id}`} prefetch={false}>
                  <span className="pw-item-title">{institution.name}</span>
                  <span className="pw-account-chevron" aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pw-empty">{t("institutions.list.empty")}</p>
        )}
      </section>
    </main>
  );
}
