import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Geist, Newsreader } from "next/font/google";

import { CompareBar } from "@/app/perfumes/CompareBar";
import { NavigationProgress } from "@/components/NavigationProgress";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getBrandAsset } from "@/lib/brand-assets";
import { Suspense } from "react";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});
// Solo para el título de la portada: un peso, un subconjunto.
const barlowCondensed = Barlow_Condensed({ subsets: ["latin"], weight: "600", variable: "--font-barlow-condensed" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

// Dirección pública del sitio (la misma SITE_URL del enlace de acceso): base de las URLs absolutas de los metadatos.
function siteUrl(): URL {
  try {
    return new URL(process.env.SITE_URL ?? "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

// Imágenes de identidad (public/brand/): solo se declaran cuando el archivo ya está cargado (ver lib/brand-assets.ts).
const ogImage = getBrandAsset("ogImage");

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: "Scentia", template: "%s — Scentia" },
  description: "Descubrí, compará y organizá perfumes: más de 41.000 fragancias por acordes y notas, quiz olfativo y colección privada.",
  applicationName: "Scentia",
  openGraph: {
    type: "website",
    siteName: "Scentia",
    locale: "es_AR",
    title: "Scentia — catálogo editorial de perfumes",
    description: "Elegí un perfume con más contexto: acordes, notas, comparador y tu perfil olfativo.",
    ...(ogImage ? { images: [{ url: ogImage.src, width: ogImage.width, height: ogImage.height, alt: ogImage.alt }] } : {}),
  },
  twitter: {
    card: ogImage ? "summary_large_image" : "summary",
    title: "Scentia",
    description: "Elegí un perfume con más contexto.",
    ...(ogImage ? { images: [ogImage.src] } : {}),
  },
};

// Barra del navegador del celular en el color del fondo, y esquema oscuro para los controles nativos.
export const viewport: Viewport = {
  themeColor: "#0f1011",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${newsreader.variable} ${geist.variable} ${barlowCondensed.variable}`}>
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
