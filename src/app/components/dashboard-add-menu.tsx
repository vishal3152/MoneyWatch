"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconPlus } from "@tabler/icons-react";

import { useTranslator } from "@/i18n/client";

/**
 * Dashboard create trigger — the header opens Institution/FixedDeposit/
 * ShareTradingAccount choices, while the Cash Accounts button opens Account/
 * FixedDeposit choices. Mirrors
 * `InstitutionAddMenu` so the Owner finds the same pattern on both screens;
 * Transfer stays on the dashboard's sticky bottom action instead.
 */
export function DashboardAddMenu({ type = "all", iconOnly = false }: { type?: "all" | "account"; iconOnly?: boolean }) {
  const { t } = useTranslator();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerLabel = type === "account" ? t("dashboard.account") : t("dashboard.addMenu");
  const triggerClassName = iconOnly
    ? "pw-dashboard-inline-add"
    : type === "account"
    ? "pw-button pw-button-subtle pw-account-add"
    : "pw-text-link-trigger";
  const sheetHeading = t("dashboard.addSectionHeading");

  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const options = type === "account"
    ? [
        { href: "/accounts/new", label: t("dashboard.cashAccount") },
        { href: "/fixed-deposits/new", label: t("dashboard.fixedDeposit") }
      ]
    : [
        { href: "/institutions/new", label: t("dashboard.addInstitution") },
        { href: "/fixed-deposits/new", label: t("dashboard.addFixedDeposit") },
        { href: "/share-trading-accounts/new", label: t("dashboard.addShareTradingAccount") }
      ];

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        aria-label={iconOnly ? t("dashboard.addAccount") : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <IconPlus aria-hidden="true" className="pw-dashboard-action-icon" stroke={1.8} />
        {iconOnly ? <span className="pw-visually-hidden">{t("dashboard.addAccount")}</span> : <span>{triggerLabel}</span>}
      </button>
      {open
        ? createPortal(
            <div className="pw-sheet-root" role="presentation">
              <button
                type="button"
                className="pw-sheet-backdrop"
                aria-label={t("select.close")}
                onClick={() => setOpen(false)}
              />
              <div className="pw-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
                <div className="pw-sheet-header">
                  <h2 id={titleId}>{sheetHeading}</h2>
                  <button
                    ref={closeRef}
                    type="button"
                    className="pw-sheet-close"
                    onClick={() => setOpen(false)}
                  >
                    {t("select.done")}
                  </button>
                </div>
                <ul className="pw-sheet-list">
                  {options.map((option) => (
                    <li key={option.href}>
                      <Link className="pw-sheet-option" href={option.href}>
                        {option.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
