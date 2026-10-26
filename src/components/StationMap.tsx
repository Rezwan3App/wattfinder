"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Ranked } from "@/lib/recommend";

const COLOR = { free: "#1b7248", "short-wait": "#a8650f", busy: "#ad3b33" } as const;

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [lat, lng, map]);
  return null;
}

export default function StationMap({
  ranked,
  origin,
  selectedId,
  onSelect,
}: {
  ranked: Ranked[];
  origin: { lat: number; lng: number };
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const selected = ranked.find((r) => r.station.ocmId === selectedId);
  // Draw the selected marker last so it sits on top.
  const ordered = [...ranked].sort(
    (a, b) => Number(a.station.ocmId === selectedId) - Number(b.station.ocmId === selectedId),
  );
  return (
    <MapContainer
      center={[origin.lat, origin.lng]}
      zoom={13}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Stations: <a href="https://openchargemap.org">OpenChargeMap</a> (CC BY-SA 4.0)'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CircleMarker
        center={[origin.lat, origin.lng]}
        radius={7}
        pathOptions={{ color: "#12261d", fillColor: "#ffffff", fillOpacity: 1, weight: 3 }}
      >
        <Tooltip>Start</Tooltip>
      </CircleMarker>
      {ordered.map((r) => {
        const isTop = ranked[0] === r;
        const isSel = r.station.ocmId === selectedId;
        return (
          <CircleMarker
            key={r.station.ocmId}
            center={[r.station.lat, r.station.lng]}
            radius={isTop ? 14 : isSel ? 11 : 8}
            pathOptions={{
              color: isSel ? "#12261d" : "#ffffff",
              weight: isSel || isTop ? 3 : 2,
              fillColor: COLOR[r.availability.status],
              fillOpacity: 0.95,
              dashArray: isTop && !isSel ? "3 3" : undefined,
            }}
            eventHandlers={{ click: () => onSelect(r.station.ocmId) }}
            bubblingMouseEvents={false}
          >
            <Tooltip>
              {isTop ? "Best: " : ""}
              {r.station.name}
            </Tooltip>
          </CircleMarker>
        );
      })}
      {selected && <FlyTo lat={selected.station.lat} lng={selected.station.lng} />}
    </MapContainer>
  );
}
