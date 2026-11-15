import { lazy, Suspense, Component, ReactNode, ErrorInfo } from "react";
import { Loading } from "./components";
import type { Point, RoutePolyline, AmbulanceMarkerProps, IncidentMarkerProps } from "./MapView";
export type { Point, RoutePolyline, AmbulanceMarkerProps, IncidentMarkerProps } from "./MapView";

class MapErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("Leaflet Map warning caught gracefully:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", textAlign: "center", background: "rgba(15, 23, 42, 0.04)", borderRadius: "8px", color: "var(--muted)" }}>
          <p style={{ margin: 0, fontWeight: 500 }}>Interactive map display in fallback mode</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const MapView = lazy(() =>
  import("./MapView").then((module) => ({ default: module.Map })),
);

export function Map({
  points = [],
  routes = [],
  ambulance = null,
  incident = null,
  onLocationSelect,
  interactive = true,
}: {
  points?: Point[];
  routes?: RoutePolyline[];
  ambulance?: AmbulanceMarkerProps | null;
  incident?: IncidentMarkerProps | null;
  onLocationSelect?: (lat: number, lng: number) => void;
  interactive?: boolean;
}) {
  return (
    <MapErrorBoundary>
      <Suspense fallback={<Loading />}>
        <MapView
          points={points}
          routes={routes}
          ambulance={ambulance}
          incident={incident}
          onLocationSelect={onLocationSelect}
          interactive={interactive}
        />
      </Suspense>
    </MapErrorBoundary>
  );
}
