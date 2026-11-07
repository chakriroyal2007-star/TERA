import { lazy, Suspense } from "react";
import { Loading } from "./components";
import type { Point } from "./MapView";
export type { Point } from "./MapView";

const MapView = lazy(() =>
  import("./MapView").then((module) => ({ default: module.Map })),
);

export function Map({
  points = [],
  onLocationSelect,
  interactive = true,
}: {
  points?: Point[];
  onLocationSelect?: (lat: number, lng: number) => void;
  interactive?: boolean;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <MapView
        points={points}
        onLocationSelect={onLocationSelect}
        interactive={interactive}
      />
    </Suspense>
  );
}
