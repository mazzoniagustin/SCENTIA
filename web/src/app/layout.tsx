import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Perfumes",
  description: "Descubrí, compará y organizá perfumes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
