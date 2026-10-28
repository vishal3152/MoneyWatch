import Script from "next/script";

import { TURNSTILE_SCRIPT_ID, TURNSTILE_SCRIPT_SRC } from "@/app/login/turnstile";

/** Start Turnstile download with the login HTML so the widget is not gated on React hydration. */
export function TurnstilePreload() {
  return (
    <>
      <link rel="preconnect" href="https://challenges.cloudflare.com" />
      <link rel="preload" href={TURNSTILE_SCRIPT_SRC} as="script" />
      <Script id={TURNSTILE_SCRIPT_ID} src={TURNSTILE_SCRIPT_SRC} strategy="afterInteractive" />
    </>
  );
}
