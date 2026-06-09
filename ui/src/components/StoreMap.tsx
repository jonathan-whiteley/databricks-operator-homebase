// ui/src/components/StoreMap.tsx
import { useEffect } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";

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

// Snap the viewport to the actual cloud of points (plus the store) so the
// dots fill the map instead of looking like a tiny cluster in the middle of
// a 30-mile zoom-11 view.
function FitToPoints({
  center,
  points,
}: {
  center: { lat: number; lon: number };
  points: MapPoint[];
}) {
  const map = useMap();
  useEffect(() => {
    const coords: [number, number][] = points.map((p) => [p.lat, p.lon]);
    coords.push([center.lat, center.lon]);
    if (coords.length < 2) {
      map.setView([center.lat, center.lon], 13);
      return;
    }
    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14, animate: false });
  }, [map, center.lat, center.lon, points]);
  return null;
}

export function StoreMap({
  center,
  points,
}: {
  center: { lat: number; lon: number };
  points: MapPoint[];
}) {
  return (
    <div className="h-[420px] overflow-hidden rounded-lg border border-[color:var(--color-hairline)]">
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OSM"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle
          center={[center.lat, center.lon]}
          radius={1600}
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
        <FitToPoints center={center} points={points} />
      </MapContainer>
    </div>
  );
}
