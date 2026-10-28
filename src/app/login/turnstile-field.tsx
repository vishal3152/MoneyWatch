"use client";

import { useEffect, useRef, useState } from "react";

import {
  TURNSTILE_RESPONSE_FIELD,
  TURNSTILE_SCRIPT_ID,
  TURNSTILE_SCRIPT_SRC,
  runWhenTurnstileApiReady
} from "@/app/login/turnstile";
import { useTranslator } from "@/i18n/client";

type TurnstileRenderOptions = {
  sitekey: string;
  theme: "light" | "dark" | "auto";
  size: "normal" | "compact" | "flexible";
  "response-field": boolean;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

type TurnstileApi = {
  render: (element: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
  ready?: (callback: () => void) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileFieldProps = {
  siteKey: string;
};

/**
 * Managed/normal/light Turnstile widget. Remount (via parent form `key`) or mode
 * switch tears the widget down so the next submit gets a fresh single-use token.
 * The shared Cloudflare script stays in the document — removing it on unmount
 * (e.g. React Strict Mode) forced a full re-download and made the widget feel late.
 */
export function TurnstileField({ siteKey }: TurnstileFieldProps) {
  const { t } = useTranslator();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let script: HTMLScriptElement | null = null;

    function clearWidget() {
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    }

    function renderWidget() {
      if (cancelled || !containerRef.current || !window.turnstile) {
        return;
      }
      clearWidget();
      setToken("");
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "light",
        size: "normal",
        "response-field": false,
        callback: (next) => setToken(next),
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken("")
      });
    }

    function onScriptLoad() {
      if (window.turnstile) {
        runWhenTurnstileApiReady(window.turnstile, renderWidget);
      }
    }

    function onScriptError() {
      setLoadFailed(true);
    }

    if (window.turnstile) {
      runWhenTurnstileApiReady(window.turnstile, renderWidget);
    } else {
      script = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = TURNSTILE_SCRIPT_ID;
        script.src = TURNSTILE_SCRIPT_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", onScriptLoad);
      script.addEventListener("error", onScriptError);
      // next/script (or a prior mount) may already have finished before we subscribed.
      if (window.turnstile) {
        runWhenTurnstileApiReady(window.turnstile, renderWidget);
      }
    }

    return () => {
      cancelled = true;
      script?.removeEventListener("load", onScriptLoad);
      script?.removeEventListener("error", onScriptError);
      clearWidget();
    };
  }, [siteKey, attempt]);

  return (
    <div className="pw-field">
      <div className="pw-login-turnstile" aria-label={t("login.captchaLabel")} ref={containerRef} />
      {loadFailed ? (
        <>
          <p className="pw-field-error" role="alert">
            {t("login.captchaLoadFailed")}
          </p>
          <button
            className="pw-button pw-button-secondary"
            type="button"
            onClick={() => {
              setLoadFailed(false);
              setAttempt((current) => current + 1);
            }}
          >
            {t("login.retryCaptcha")}
          </button>
        </>
      ) : null}
      <input type="hidden" name={TURNSTILE_RESPONSE_FIELD} value={token} readOnly />
    </div>
  );
}
