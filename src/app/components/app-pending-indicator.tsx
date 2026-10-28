"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  PENDING_END_EVENT,
  PENDING_START_EVENT,
  type PendingEventDetail
} from "@/app/components/app-pending-events";
import { useTranslator } from "@/i18n/client";

function isInternalNavigation(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }

  const link = target.closest<HTMLAnchorElement>("a[href]");
  if (!link || link.target || link.hasAttribute("download")) {
    return false;
  }

  const url = new URL(link.href, window.location.href);
  return (
    url.origin === window.location.origin &&
    (url.pathname !== window.location.pathname || url.search !== window.location.search)
  );
}

/**
 * Shows one app-wide loader while a link, Server Action form, or explicit client request is pending.
 * Forms already expose their own button label; this supplies the missing visual signal for page changes.
 */
export function AppPendingIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslator();
  const [pending, setPending] = useState(false);
  const navigationPending = useRef(false);
  const formPending = useRef(false);
  const manualPendingIds = useRef(new Set<string>());

  const syncPending = useCallback(() => {
    setPending(
      navigationPending.current || formPending.current || manualPendingIds.current.size > 0
    );
  }, []);

  useEffect(() => {
    navigationPending.current = false;
    formPending.current = false;
    syncPending();
  }, [pathname, searchParams, syncPending]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (isInternalNavigation(event)) {
        navigationPending.current = true;
        syncPending();
      }
    }

    function onSubmit(event: SubmitEvent) {
      if (!(event.target instanceof HTMLFormElement)) {
        return;
      }

      const form = event.target;
      formPending.current = true;
      syncPending();

      let observedPendingControl = false;
      const observer = new MutationObserver(() => {
        if (!form.isConnected) {
          observer.disconnect();
          formPending.current = false;
          syncPending();
          return;
        }

        const hasDisabledSubmitControl = Array.from(
          form.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
            'button[type="submit"], input[type="submit"]'
          )
        ).some((control) => control.disabled);

        if (hasDisabledSubmitControl) {
          observedPendingControl = true;
          return;
        }

        if (observedPendingControl) {
          observer.disconnect();
          formPending.current = false;
          syncPending();
        }
      });

      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["disabled"],
        childList: true,
        subtree: true
      });
    }

    function onManualStart(event: Event) {
      manualPendingIds.current.add((event as CustomEvent<PendingEventDetail>).detail.id);
      syncPending();
    }

    function onManualEnd(event: Event) {
      manualPendingIds.current.delete((event as CustomEvent<PendingEventDetail>).detail.id);
      syncPending();
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener(PENDING_START_EVENT, onManualStart);
    window.addEventListener(PENDING_END_EVENT, onManualEnd);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener(PENDING_START_EVENT, onManualStart);
      window.removeEventListener(PENDING_END_EVENT, onManualEnd);
    };
  }, [syncPending]);

  if (!pending) {
    return null;
  }

  return (
    <div className="pw-pending-indicator" role="status" aria-live="polite" aria-label={t("loading.label")}>
      <span className="pw-spinner" aria-hidden="true" />
    </div>
  );
}
