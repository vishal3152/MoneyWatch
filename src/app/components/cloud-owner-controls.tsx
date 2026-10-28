import { signOut } from "@/app/login/actions";
import { getCurrentOwnerEmail, getCurrentOwnerId } from "@/lib/cloud-auth/current-owner";
import { getTranslator } from "@/i18n/server";
import { IconLogout2, IconUserCircle } from "@tabler/icons-react";

/** Cloud-only header chrome. Dynamically imported so local/desktop never loads Supabase.
 * Gated on ownerId, not ownerEmail — both providers have an email today, but ownerId is
 * the one identity value every auth provider is guaranteed to resolve. */
export async function CloudOwnerControls() {
  const ownerId = await getCurrentOwnerId();
  const ownerEmail = await getCurrentOwnerEmail();
  const { t } = await getTranslator();

  if (!ownerId) {
    return null;
  }

  return (
    <details className="pw-owner-menu">
      <summary className="pw-owner-menu-trigger" aria-label={ownerEmail ?? t("nav.signOut")}>
        {ownerEmail ? (
          <span className="pw-owner-avatar" aria-hidden="true">
            {ownerEmail.slice(0, 2).toUpperCase()}
          </span>
        ) : (
          <IconUserCircle aria-hidden="true" className="pw-owner-avatar-icon" stroke={1.7} />
        )}
      </summary>
      <div className="pw-owner-menu-popover">
        <form action={signOut}>
          <button className="pw-owner-signout" type="submit">
            <IconLogout2 aria-hidden="true" className="pw-owner-signout-icon" stroke={1.8} />
            <span>{t("nav.signOut")}</span>
          </button>
        </form>
      </div>
    </details>
  );
}
