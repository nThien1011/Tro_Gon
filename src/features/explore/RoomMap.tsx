import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Building, Listing, Room } from "../../domain/models";
import { compactMoney } from "../../lib/format";
import { hasCoordinates } from "../../config/locations";
export default function RoomMap({
  items,
  position,
}: {
  items: { room: Room; building: Building; listing: Listing }[];
  position?: { lat: number; lng: number };
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { scrollWheelZoom: false }).setView(
      position || [10.81, 106.72],
      12,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    const bounds: L.LatLngExpression[] = [];
    items.forEach(({ room, building, listing }) => {
      if (!hasCoordinates(building)) return;
      const latlng: L.LatLngExpression = [building.lat, building.lng];
      bounds.push(latlng);
      const icon = L.divIcon({
        className: "map-price-wrap",
        html: `<span class="map-price">${compactMoney(room.rent)}</span>`,
        iconSize: [108, 32],
        iconAnchor: [54, 16],
      });
      const marker = L.marker(latlng, { icon }).addTo(map);
      const popup = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = listing.title;
      const link = document.createElement("a");
      link.textContent = "Xem phòng →";
      link.href = `#/room/${listing.id}`;
      popup.append(title, document.createElement("br"), link);
      marker.bindPopup(popup);
    });
    if (position)
      L.circleMarker(position, { color: "#2673dc", radius: 7, fillOpacity: 1 })
        .addTo(map)
        .bindPopup("Vị trí của bạn");
    if (bounds.length && !position)
      map.fitBounds(L.latLngBounds(bounds), { padding: [45, 45], maxZoom: 14 });
    return () => {
      map.remove();
    };
  }, [items, position]);
  return (
    <div className="room-map" ref={ref} aria-label="Bản đồ vị trí phòng trọ" />
  );
}
