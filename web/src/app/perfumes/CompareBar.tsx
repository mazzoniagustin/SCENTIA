"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

export function CompareBar() {
  const searchParams = useSearchParams();
  const selected = searchParams.get("compare")?.split(",") ?? [];
  const n = selected.length;

  if (n < 2) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        background: "var(--surface)",
        padding: "12px 20px",
        borderRadius: "8px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        zIndex: 10,
        border: "1px solid var(--border)",
      }}
    >
      <span>{n} perfumes seleccionados</span>
      <Link
        href={`/perfumes/compare?ids=${selected.join(",")}`}
        className="button"
        style={{
          background: "var(--accent)",
          color: "var(--accent-contrast)",
          padding: "8px 16px",
          borderRadius: "4px",
          textDecoration: "none",
        }}
      >
        Comparar ({n})
      </Link>
    </div>
  );
}
