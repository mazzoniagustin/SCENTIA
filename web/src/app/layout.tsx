import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Perfumes", template: "%s — Perfumes" },
  description: "Descubrí, compará y organizá perfumes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
