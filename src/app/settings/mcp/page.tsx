import { headers } from "next/headers";

import { BackLink } from "@/app/components/back-link";
import { PageHeader } from "@/app/components/design-system";
import { resolveMcpEndpointUrl, resolveMcpRequestProtocol } from "@/app/settings/mcp-connection";
import { McpSetupGuide } from "@/app/settings/mcp-setup-section";
import { getMcpAccessTokenSummary } from "@/app/settings/mcp-token-actions";
import { isCloudMode } from "@/config/deployment-mode";
import { getTranslator } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function McpSettingsPage() {
  const { t } = await getTranslator();
  const cloud = isCloudMode();
  const requestHeaders = await headers();
  const endpointUrl = resolveMcpEndpointUrl(
    requestHeaders.get("host"),
    resolveMcpRequestProtocol({ "x-forwarded-proto": requestHeaders.get("x-forwarded-proto") })
  );

  return (
    <main className="pw-main">
      <section className="pw-card" aria-labelledby="mcp-heading">
        <BackLink href="/" label={t("common.backToDashboard")} />
        <PageHeader
          id="mcp-heading"
          title={t("settings.mcp.heading")}
          description={cloud ? t("settings.mcp.ledeCloud") : t("settings.mcp.ledeLocal")}
        />
        <McpSetupGuide
          endpointUrl={endpointUrl}
          cloud={cloud}
          initialSummary={cloud ? await getMcpAccessTokenSummary() : null}
        />
      </section>
    </main>
  );
}
