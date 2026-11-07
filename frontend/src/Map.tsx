import { lazy, Suspense } from "react";
import { Empty, Loading } from "./components";
import type { Point } from "./MapView";
export type { Point } from "./MapView";
const MapView = lazy(() =>
  import("./MapView").then((module) => ({ default: module.Map })),
);
export function Map({ points }: { points: Point[] }) {
  if (!points.some((p) => p.latitude !== null && p.longitude !== null))
    return (
      <Empty title="No locations recorded">
        A map appears when a report or resource has actual coordinates.
      </Empty>
    );
  return (
    <Suspense fallback={<Loading />}>
      <MapView points={points} />
    </Suspense>
  );
}
