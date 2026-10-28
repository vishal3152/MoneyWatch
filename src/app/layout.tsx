import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { AppHeader } from "@/app/components/app-header";
import { AppPendingIndicator } from "@/app/components/app-pending-indicator";
import { LocaleProvider } from "@/i18n/client";
import { LOCALE_TAGS, localeDirection } from "@/i18n/locales";
import { getLocale } from "@/i18n/server";
import { getCatalog } from "@/i18n/translator";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Money Watch",
  description:
    "Track money across institutions and currencies, record what moves, and reconcile your records with reported balances."
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#db9366"
};

type RootLayoutProps = {
  children: ReactNode;
};

export default async function RootLayout({ children }: RootLayoutProps) {
  const locale = await getLocale();

  return (
    <html
      lang={LOCALE_TAGS[locale]}
      dir={localeDirection(locale)}
      className={inter.variable}
    >
      <body>
        <LocaleProvider locale={locale} catalog={getCatalog(locale)}>
          <div className="pw-shell">
            <AppHeader />
            {children}
            <Suspense fallback={null}>
              <AppPendingIndicator />
            </Suspense>
          </div>
        </LocaleProvider>
      </body>
    </html>
  );
}
