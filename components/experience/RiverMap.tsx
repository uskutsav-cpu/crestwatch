"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { STATIONS } from "@/lib/river-stations";
import { Layers, Scan } from "lucide-react";
type Props = {
  active?: string;
  onSelect?: (lid: string) => void;
  point?: { lat: number; lon: number };
  onMove?: (p: { lat: number; lon: number }) => void;
  compact?: boolean;
};
export function RiverMap({
  active = "VCKM6",
  onSelect,
  point,
  onMove,
  compact = false,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const move = useRef(onMove);
  move.current = onMove;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver;
    import("leaflet")
      .then((L) => {
        if (cancelled || !root.current) return;
        const m = L.map(root.current, {
          zoomControl: true,
          scrollWheelZoom: false,
          attributionControl: true,
        }).setView(
          point ? [point.lat, point.lon] : [32.91, -90.65],
          point ? 15 : 8,
        );
        map.current = m;
        setReady(true);
        let errors = 0;
        const layer = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
          },
        ).addTo(m);
        layer.on("tileerror", () => {
          errors++;
          if (errors > 6) setFailed(true);
        });
        layer.on("tileload", () => setFailed(false));
        if (point) {
          const marker = L.marker([point.lat, point.lon], {
            draggable: !!onMove,
            icon: L.divIcon({
              className: "place-map-marker",
              html: "<span></span>",
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            }),
          }).addTo(m);
          markerRef.current = marker;
          marker.on("dragend", () => {
            const p = marker.getLatLng();
            move.current?.({ lat: p.lat, lon: p.lng });
          });
          m.on("click", (e) => {
            if (move.current) {
              marker.setLatLng(e.latlng);
              move.current({ lat: e.latlng.lat, lon: e.latlng.lng });
            }
          });
        } else {
          for (const s of STATIONS) {
            const marker = L.marker([s.lat, s.lon], {
              title: `${s.name} at ${s.city}`,
              alt: `${s.name} at ${s.city}`,
              icon: L.divIcon({
                className: `station-marker ${s.lid === active ? "selected" : ""}`,
                html: `<span>${s.label}</span>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
              }),
            }).addTo(m);
            marker.bindTooltip(`${s.name} at ${s.city}`, {
              direction: "top",
              offset: [0, -15],
            });
            marker.on("click", () => select.current?.(s.lid));
          }
        }
        observer = new ResizeObserver(() => m.invalidateSize());
        observer.observe(root.current);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, [point?.lat === undefined, compact]);
  useEffect(() => {
    if (point && markerRef.current) {
      markerRef.current.setLatLng([point.lat, point.lon]);
    }
    if (!point && map.current) {
      const s = STATIONS.find((x) => x.lid === active);
      if (s) {
        map.current.eachLayer((l: any) => {
          const el = l.getElement?.();
          if (el?.classList?.contains("station-marker"))
            el.classList.toggle("selected", el.textContent === s.label);
        });
        map.current.panTo([s.lat + 0.18, s.lon + 0.12], { animate: false });
      }
    }
  }, [active, point]);
  return (
    <div className={`river-map ${compact ? "compact" : ""}`}>
      <div
        ref={root}
        className="map-canvas"
        role="region"
        aria-label={
          point
            ? onMove
              ? "Location confirmation map. Drag the pin or tap the map to adjust."
              : "Map of this saved location."
            : "Mississippi river gauge map. Select a numbered station."
        }
      />
      <div className="map-tag">
        <Layers size={13} />
        {point
          ? onMove
            ? "CONFIRM YOUR LOCATION"
            : "YOUR SAVED LOCATION"
          : "MISSISSIPPI RIVER NETWORK"}
      </div>
      {failed && (
        <div className="map-failure">
          Map tiles unavailable. All river information remains available below.
        </div>
      )}
      {!point && <button className="map-overview" disabled={!ready} onClick={() => map.current?.fitBounds(STATIONS.map(s => [s.lat, s.lon] as [number,number]), {padding:[42,42], maxZoom:8, animate:false})}><Scan size={15}/> All gauges</button>}
      {!point && (
        <div className="map-key">
          <span className="map-key-dot" /> River gauge{" "}
          <span className="map-key-line" /> Waterway
        </div>
      )}
    </div>
  );
}
