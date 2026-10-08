import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>Scentia · proyecto personal de aprendizaje</p>
      <p>
        Datos de la comunidad de Fragrantica vía Kaggle (CC BY-NC-SA 4.0) · <Link href="/creditos">Créditos</Link>
      </p>
    </footer>
  );
}
