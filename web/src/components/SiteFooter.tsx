import Link from "next/link";

import { BrandImage } from "@/components/BrandImage";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <BrandImage slot="footerMark" className="site-footer-mark" />
      <p>© {new Date().getFullYear()} Scentia · Tu guía de perfumería</p>
      <p>
        Datos de la comunidad de Fragrantica vía Kaggle (CC BY-NC-SA 4.0) · <Link href="/creditos">Créditos</Link>
      </p>
    </footer>
  );
}
