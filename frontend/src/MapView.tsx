import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Empty } from "./components";
export interface Point {
  latitude: number | null;
  longitude: number | null;
  name: string;
  detail?: string;
}
export function Map({ points }: { points: Point[] }) {
  const valid = points.filter(
    (p) => p.latitude !== null && p.longitude !== null,
  );
  if (!valid.length)
    return (
      <Empty title="No locations recorded">
        A map appears when a report or resource has actual coordinates.
      </Empty>
    );
  return (
    <MapContainer
      key={valid.map((p) => p.latitude + "," + p.longitude).join(";")}
      center={[valid[0].latitude!, valid[0].longitude!]}
      zoom={12}
      className="map"
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {valid.map((p, i) => (
        <CircleMarker
          key={i}
          center={[p.latitude!, p.longitude!]}
          radius={8}
          pathOptions={{ color: "#146653", fillOpacity: 0.8 }}
        >
          <Popup>
            <strong>{p.name}</strong>
            <br />
            {p.detail}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
