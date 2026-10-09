import type { Metadata } from "next";
import { Geist, Newsreader } from "next/font/google";

import { CompareBar } from "@/app/perfumes/CompareBar";
import { NavigationProgress } from "@/components/NavigationProgress";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Suspense } from "react";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: { default: "Scentia", template: "%s — Scentia" },
  description: "Descubrí, compará y organizá perfumes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${newsreader.variable} ${geist.variable}`}>
      <body>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <SiteHeader />
        {children}
        <SiteFooter />
        <CompareBar />
      </body>
    </html>
  );
}
