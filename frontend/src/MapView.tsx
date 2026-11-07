import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface Point {
  latitude: number | null;
  longitude: number | null;
  name: string;
  detail?: string;
}

interface MapProps {
  points?: Point[];
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

export function Map({ points = [], onLocationSelect, interactive = true }: MapProps) {
  const valid = points.filter((p) => p.latitude !== null && p.longitude !== null);
  const centerLat = valid.length ? valid[0].latitude! : 13.6288;
  const centerLng = valid.length ? valid[0].longitude! : 79.4192;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "340px" }}>
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={valid.length ? 14 : 11}
        className="map"
        style={{ width: "100%", height: "100%", minHeight: "340px", borderRadius: "10px" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {interactive && <ClickHandler onLocationSelect={onLocationSelect} />}
        {valid.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.latitude!, p.longitude!]}
            radius={9}
            pathOptions={{ color: "#dc2626", fillColor: "#ef4444", fillOpacity: 0.9, weight: 2 }}
          >
            <Popup>
              <strong>{p.name}</strong>
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
