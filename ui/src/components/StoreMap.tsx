// ui/src/components/StoreMap.tsx
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";

export type MapPoint = {
  member_id: number;
  lat: number;
  lon: number;
  tier: "active" | "lapsed" | "at_risk";
};

const TIER_COLOR: Record<MapPoint["tier"], string> = {
  active: "#00A972",
  lapsed: "#9CA3AF",
  at_risk: "#FF3621",
};

export function StoreMap({
  center, points,
}: {
  center: { lat: number; lon: number };
  points: MapPoint[];
}) {
  return (
    <div className="h-[420px] overflow-hidden rounded-lg border border-[color:var(--color-hairline)]">
      <MapContainer center={[center.lat, center.lon]} zoom={11} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution="&copy; OSM"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle
          center={[center.lat, center.lon]}
          radius={8000}
          pathOptions={{ color: "#0B2026", weight: 1, fillOpacity: 0.04 }}
        />
        {points.map((p) => (
          <CircleMarker
            key={p.member_id}
            center={[p.lat, p.lon]}
            radius={4}
            pathOptions={{
              color: TIER_COLOR[p.tier],
              fillColor: TIER_COLOR[p.tier],
              fillOpacity: 0.75,
              weight: 0,
            }}
          >
            <Tooltip>{p.tier} · #{p.member_id}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
