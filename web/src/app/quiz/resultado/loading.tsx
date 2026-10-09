import { AnalyzingLoader } from "@/components/AnalyzingLoader";

export default function Loading() {
  return (
    <main className="catalog" aria-busy="true">
      <AnalyzingLoader />
    </main>
  );
}
