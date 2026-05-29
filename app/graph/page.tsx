import { Suspense } from "react";
import GraphPageClient from "./GraphPageClient";

export default function GraphPage() {
  return (
    <Suspense fallback={null}>
      <GraphPageClient />
    </Suspense>
  );
}
