import { ClientOnly, createFileRoute, Outlet } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const PhoneStageHost = lazy(() => import("../phone/PhoneStageHost"));

export const Route = createFileRoute("/_phone")({ component: PhoneLayout });

function PhoneLayout() {
  return (
    <main className="page-wrap grid gap-8 px-4 py-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      {/* Persists across /, /menu, … — never remounts. Do NOT key this by
          pathname and never move the stage into a leaf route. */}
      <ClientOnly fallback={<div className="phone-skeleton" aria-hidden="true" />}>
        <Suspense fallback={<div className="phone-skeleton" aria-hidden="true" />}>
          <PhoneStageHost />
        </Suspense>
      </ClientOnly>
      <Outlet /> {/* only this subtree swaps on navigation */}
    </main>
  );
}
