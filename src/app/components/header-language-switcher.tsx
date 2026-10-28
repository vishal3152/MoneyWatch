"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { IconLanguage } from "@tabler/icons-react";

import { setLocale } from "@/app/settings/locale-actions";
import { finishAppPending, startAppPending } from "@/app/components/app-pending-events";
import { useTranslator } from "@/i18n/client";
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from "@/i18n/locales";

/**
 * Header-level icon-only language switcher — shows the active locale to assistive
 * technology and opens the same
 * bottom-sheet pattern as `SheetSelect` rather than duplicating it wholesale:
 * this trigger has no form field label/error state to carry, so it composes
 * the `.pw-sheet-*` classes directly instead of going through that component.
 *
 * The sheet is portaled to `document.body` rather than rendered inline:
 * `.pw-header` has `backdrop-filter`, and a `backdrop-filter`/`transform`/
 * `filter` ancestor becomes the containing block for a `position: fixed`
 * descendant per spec — so a `fixed; inset: 0` sheet left nested under the
 * header sizes itself to the ~72px header box instead of the viewport.
 * `SheetSelect` portals for the same reason (`.pw-card` also has
 * `backdrop-filter`) — see the comment there.
 */
export function HeaderLanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const { t } = useTranslator();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    function updateHeaderActions() {
      if (!window.matchMedia("(min-width: 641px)").matches) {
        document.documentElement.removeAttribute("data-header-actions-hidden");
        return;
      }

      const scrollY = window.scrollY;
      if (scrollY > lastScrollY && scrollY > 0) {
        document.documentElement.setAttribute("data-header-actions-hidden", "true");
      } else if (scrollY < lastScrollY || scrollY === 0) {
        document.documentElement.removeAttribute("data-header-actions-hidden");
      }
      lastScrollY = scrollY;
    }

    window.addEventListener("scroll", updateHeaderActions, { passive: true });
    window.addEventListener("resize", updateHeaderActions);
    return () => {
      window.removeEventListener("scroll", updateHeaderActions);
      window.removeEventListener("resize", updateHeaderActions);
      document.documentElement.removeAttribute("data-header-actions-hidden");
    };
  }, []);

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

  function handleSelect(locale: Locale) {
    setOpen(false);
    if (locale !== currentLocale) {
      startTransition(async () => {
        const pendingId = startAppPending();
        try {
          await setLocale(locale);
        } finally {
          finishAppPending(pendingId);
        }
      });
    }
  }

  return (
    <>
      <button
        type="button"
        className="pw-menu pw-lang-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${t("settings.language.label")}, ${LOCALE_LABELS[currentLocale]}`}
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        <IconLanguage aria-hidden="true" className="pw-lang-icon" stroke={1.8} />
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
                  <h2 id={titleId}>{t("settings.language.heading")}</h2>
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
                  {SUPPORTED_LOCALES.map((locale) => {
                    const isSelected = locale === currentLocale;
                    return (
                      <li key={locale}>
                        <button
                          type="button"
                          className={
                            isSelected ? "pw-sheet-option is-selected" : "pw-sheet-option"
                          }
                          aria-current={isSelected ? "true" : undefined}
                          onClick={() => handleSelect(locale)}
                        >
                          {LOCALE_LABELS[locale]}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
