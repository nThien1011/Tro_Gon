import {
  Heart,
  MapPin,
  MoveUpRight,
  Ruler,
  Users,
  BedDouble,
} from "lucide-react";
import { useApp } from "../../app/provider";
import { navigate } from "../../app/router";
import type { Listing } from "../../domain/models";
import { buildingOf } from "../../domain/selectors";
import { compactMoney } from "../../lib/format";
import { buildingAddress } from "../../config/locations";
import { appConfig } from "../../config/app";
export default function RoomCard({
  listing,
  distance,
}: {
  listing: Listing;
  distance?: number;
}) {
  const { data, user, execute, toast } = useApp();
  const room = data.rooms.find((r) => r.id === listing.roomId);
  if (!room) return null;
  const building = buildingOf(data, room);
  const saved = data.favorites.some(
    (f) => f.userId === user?.id && f.listingId === listing.id,
  );
  return (
    <article className="room-card">
      <div className="room-card-photo">
        <a href={`#/room/${listing.id}`}>
          <img
            src={room.images[0] || "/images/room-1.jpg"}
            alt={listing.title}
            loading="lazy"
          />
        </a>
        <span className="photo-badge">
          {distance !== undefined
            ? `${distance.toFixed(1)} km từ bạn`
            : appConfig.dataSource === "local"
              ? "Phòng mẫu · Còn trống"
              : "Còn trống"}
        </span>
        <button
          className={`favorite-btn ${saved ? "saved" : ""}`}
          aria-label={saved ? "Bỏ lưu phòng" : "Lưu phòng"}
          onClick={() => {
            if (!user) {
              navigate("/login");
              return;
            }
            if (user.role !== "tenant") {
              toast("Tính năng lưu phòng dành cho người thuê.");
              return;
            }
            execute(
              { type: "favorite.toggle", payload: { id: listing.id } },
              saved ? "Đã bỏ lưu phòng." : "Đã lưu vào danh sách yêu thích.",
            );
          }}
        >
          <Heart size={19} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="room-card-body">
        <p className="room-card-location">
          <MapPin size={14} />
          {buildingAddress(building, false)}
        </p>
        <h3>
          <a href={`#/room/${listing.id}`}>{listing.title}</a>
        </h3>
        <div className="room-specs">
          <span>
            <Ruler size={15} />
            {room.area} m²
          </span>
          <span>
            <Users size={15} />
            {room.capacity} người
          </span>
          <span>
            <BedDouble size={15} />
            {room.amenities.includes("Nội thất") ? "Đủ nội thất" : "Tiện nghi"}
          </span>
        </div>
        <div className="amenity-tags">
          {room.amenities.slice(0, 3).map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
        <div className="room-card-bottom">
          <div>
            <strong>{compactMoney(room.rent)}</strong>
            <span> / tháng</span>
          </div>
          <a
            href={`#/room/${listing.id}`}
            className="circle-link"
            aria-label="Xem chi tiết phòng"
          >
            <MoveUpRight size={19} />
          </a>
        </div>
      </div>
    </article>
  );
}
