import { Suspense } from "react";
import { Studio } from "@/components/studio/studio";

export default function Home() {
  return (
    <Suspense fallback={<div className="pm-shimmer h-dvh" />}>
      <Studio />
    </Suspense>
  );
}
