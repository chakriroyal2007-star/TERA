import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface Point {
  latitude: number | null;
  longitude: number | null;
  name: string;
  detail?: string;
}

export interface RoutePolyline {
  coordinates: [number, number][];
  color?: string;
  weight?: number;
  opacity?: number;
  dashArray?: string;
  label?: string;
}

interface MapProps {
  points?: Point[];
  routes?: RoutePolyline[];
  onLocationSelect?: (lat: number, lng: number) => void;
  interactive?: boolean;
}

function ClickHandler({ onLocationSelect }: { onLocationSelect?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onLocationSelect) {
        onLocationSelect(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
      }
    },
  });
  return null;
}

export function Map({ points = [], routes = [], onLocationSelect, interactive = true }: MapProps) {
  const valid = (points || [])
    .map((p) => {
      const rawLat = (p as any)?.latitude;
      const rawLng = (p as any)?.longitude;
      const lat = rawLat !== null && rawLat !== undefined && rawLat !== "" ? Number(rawLat) : NaN;
      const lng = rawLng !== null && rawLng !== undefined && rawLng !== "" ? Number(rawLng) : NaN;
      return {
        ...p,
        lat,
        lng,
        isValid: !isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180,
      };
    })
    .filter((p) => p.isValid);

  const allCoords: [number, number][] = [
    ...valid.map((p) => [p.lat, p.lng] as [number, number]),
    ...(routes || []).flatMap((r) => r.coordinates || []),
  ];

  const centerLat = allCoords.length > 0 ? allCoords[0][0] : 13.6288;
  const centerLng = allCoords.length > 0 ? allCoords[0][1] : 79.4192;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "340px" }}>
      <MapContainer
        key={`${centerLat}-${centerLng}-${valid.length}-${(routes || []).length}`}
        center={[centerLat, centerLng]}
        zoom={valid.length > 0 || (routes && routes.length > 0) ? 13 : 11}
        className="map"
        style={{ width: "100%", height: "100%", minHeight: "340px", borderRadius: "10px" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {interactive && <ClickHandler onLocationSelect={onLocationSelect} />}
        {(routes || []).map((r, i) => {
          if (!r.coordinates || r.coordinates.length < 2) return null;
          return (
            <Polyline
              key={`route-${i}`}
              positions={r.coordinates}
              pathOptions={{
                color: r.color || "#0284c7",
                weight: r.weight || 5,
                opacity: r.opacity || 0.85,
                dashArray: r.dashArray,
              }}
            >
              {r.label && (
                <Popup>
                  <strong>{r.label}</strong>
                </Popup>
              )}
            </Polyline>
          );
        })}
        {valid.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lng]}
            radius={9}
            pathOptions={{ color: "#dc2626", fillColor: "#ef4444", fillOpacity: 0.9, weight: 2 }}
          >
            <Popup>
              <strong>{p.name || "Incident location"}</strong>
              {p.detail && (
                <>
                  <br />
                  <span>{p.detail}</span>
                </>
              )}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {interactive && (
        <div
          style={{
            position: "absolute",
            bottom: "8px",
            left: "8px",
            background: "rgba(15, 23, 42, 0.85)",
            color: "#f8fafc",
            padding: "4px 8px",
            borderRadius: "6px",
            fontSize: "11px",
            zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          📍 Click map to set pin
        </div>
      )}
    </div>
  );
}
