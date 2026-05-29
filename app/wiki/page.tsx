import { Suspense } from "react";
import WikiPageClient from "./WikiPageClient";

export default function WikiPage() {
  return (
    <Suspense fallback={null}>
      <WikiPageClient />
    </Suspense>
  );
}
