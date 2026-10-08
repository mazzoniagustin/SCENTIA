"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function CompareCheckbox({ perfumeId, perfumeName }: { perfumeId: string; perfumeName: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("compare")?.split(",") ?? [];
  const checked = current.includes(perfumeId);

  const toggle = () => {
    const next = checked
      ? current.filter((id) => id !== perfumeId)
      : [...current, perfumeId];

    const params = new URLSearchParams(searchParams);
    if (next.length > 0) params.set("compare", next.join(","));
    else params.delete("compare");

    router.replace(`?${params.toString()}`);
  };

  return (
    <label className="compare-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={toggle}
        aria-label={`Comparar ${perfumeName}`}
      />
      Comparar
    </label>
  );
}
