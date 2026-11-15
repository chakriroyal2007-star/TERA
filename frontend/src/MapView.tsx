import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents, useMap, Polyline, Marker } from "react-leaflet";
import L from "leaflet";
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

export interface AmbulanceMarkerProps {
  latitude: number;
  longitude: number;
  label?: string;
  driverName?: string;
  driverPhone?: string;
  registration?: string;
  stale?: boolean;
  ageSeconds?: number;
  speed?: number;
  heading?: number;
}

export interface IncidentMarkerProps {
  latitude: number;
  longitude: number;
  label?: string;
  address?: string;
}

interface MapProps {
  points?: Point[];
  routes?: RoutePolyline[];
  ambulance?: AmbulanceMarkerProps | null;
  incident?: IncidentMarkerProps | null;
  trail?: [number, number][];
  onLocationSelect?: (lat: number, lng: number) => void;
  interactive?: boolean;
}

function getAmbulanceIcon(stale?: boolean) {
  const borderColor = stale ? "#f59e0b" : "#ef4444";
  const badgeColor = stale ? "#f59e0b" : "#10b981";
  const shadowColor = stale ? "rgba(245, 158, 11, 0.45)" : "rgba(239, 68, 68, 0.45)";
  return L.divIcon({
    className: "custom-ambulance-marker",
    html: `
      <div style="
        position: relative;
        background: #ffffff;
        border: 2px solid ${borderColor};
        border-radius: 50%;
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 16px ${shadowColor};
        font-size: 24px;
        cursor: pointer;
        transform: translate3d(0, 0, 0);
        transition: all 0.5s ease;
      ">
        🚑
        <span style="
          position: absolute;
          top: -2px;
          right: -2px;
          width: 12px;
          height: 12px;
          background: ${badgeColor};
          border: 2px solid #ffffff;
          border-radius: 50%;
        "></span>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -24],
  });
}

const incidentIcon = L.divIcon({
  className: "custom-incident-marker",
  html: `
    <div style="
      background: #dc2626;
      border: 2px solid #ffffff;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(220, 38, 38, 0.5);
      font-size: 20px;
    ">
      🚨
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -22],
});

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

function SmoothFollowAmbulance({ lat, lng }: { lat?: number; lng?: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
      map.panTo([lat, lng], { animate: true, duration: 0.8 });
    }
  }, [lat, lng, map]);
  return null;
}

export function Map({
  points = [],
  routes = [],
  ambulance = null,
  incident = null,
  trail = [],
  onLocationSelect,
  interactive = true,
}: MapProps) {
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
    ...(incident?.latitude && incident?.longitude ? [[incident.latitude, incident.longitude] as [number, number]] : []),
    ...(ambulance?.latitude && ambulance?.longitude ? [[ambulance.latitude, ambulance.longitude] as [number, number]] : []),
    ...valid.map((p) => [p.lat, p.lng] as [number, number]),
    ...(routes || []).flatMap((r) => r.coordinates || []),
  ];

  const centerLat = allCoords.length > 0 ? allCoords[0][0] : 13.6288;
  const centerLng = allCoords.length > 0 ? allCoords[0][1] : 79.4192;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "360px" }}>
      <MapContainer
        key={`${incident?.latitude || centerLat}-${incident?.longitude || centerLng}`}
        center={[centerLat, centerLng]}
        zoom={13}
        className="map"
        style={{ width: "100%", height: "100%", minHeight: "360px", borderRadius: "10px" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {interactive && <ClickHandler onLocationSelect={onLocationSelect} />}

        {ambulance?.latitude && ambulance?.longitude && (
          <SmoothFollowAmbulance lat={ambulance.latitude} lng={ambulance.longitude} />
        )}

        {/* Polylines */}
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

        {/* Incident Marker (Emergency Beacon) */}
        {incident && incident.latitude && incident.longitude && (
          <Marker position={[incident.latitude, incident.longitude]} icon={incidentIcon}>
            <Popup>
              <strong>🚨 {incident.label || "Emergency Incident Scene"}</strong>
              {incident.address && (
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>{incident.address}</div>
              )}
            </Popup>
          </Marker>
        )}

        {/* Historical GPS breadcrumb trail */}
        {trail && trail.length > 1 && (
          <Polyline
            positions={trail}
            pathOptions={{
              color: "#64748b",
              weight: 3,
              opacity: 0.65,
              dashArray: "4, 6",
            }}
          />
        )}

        {/* Live Ambulance Marker with Custom Logo */}
        {ambulance && ambulance.latitude && ambulance.longitude && (
          <Marker position={[ambulance.latitude, ambulance.longitude]} icon={getAmbulanceIcon(ambulance.stale)}>
            <Popup>
              <div style={{ textAlign: "center", minWidth: "160px" }}>
                <strong style={{ fontSize: "13px", color: "#0f172a", display: "block" }}>
                  🚑 {ambulance.registration || "Active Ambulance"}
                </strong>
                {ambulance.stale && (
                  <span style={{ fontSize: "11px", color: "#b45309", background: "#fef3c7", padding: "2px 6px", borderRadius: "4px", display: "inline-block", marginTop: "3px" }}>
                    ⚠️ Telemetry delayed ({ambulance.ageSeconds ? `${ambulance.ageSeconds}s` : ">30s"})
                  </span>
                )}
                {ambulance.driverName && (
                  <div style={{ fontSize: "12px", color: "#475569", marginTop: "3px" }}>
                    Driver: <strong>{ambulance.driverName}</strong>
                  </div>
                )}
                {ambulance.driverPhone && (
                  <div style={{ marginTop: "8px" }}>
                    <a
                      href={`tel:${ambulance.driverPhone.replace(/[\s-]/g, "")}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        background: "#10b981",
                        color: "#ffffff",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        textDecoration: "none",
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      📞 Call {ambulance.driverPhone}
                    </a>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Other map points */}
        {valid.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lng]}
            radius={9}
            pathOptions={{ color: "#dc2626", fillColor: "#ef4444", fillOpacity: 0.9, weight: 2 }}
          >
            <Popup>
              <strong>{p.name || "Location pin"}</strong>
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
