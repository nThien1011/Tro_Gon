import { lazy, Suspense, useMemo, useState } from "react";
import {
  ArrowRight,
  Search,
  MapPin,
  Navigation,
  SlidersHorizontal,
  Grid2X2,
  Map,
  Check,
  Sparkles,
  ShieldCheck,
  Home,
  Heart,
} from "lucide-react";
import { useApp } from "../../app/provider";
import { appConfig } from "../../config/app";
import { buildingOf } from "../../domain/selectors";
import { distanceKm, normalize } from "../../lib/format";
import { Empty, Modal, Select, Field } from "../../components/ui";
import RoomCard from "./RoomCard";
const RoomMap = lazy(() => import("./RoomMap"));
export default function ExplorePage({ saved = false }: { saved?: boolean }) {
  const { data, user, toast } = useApp();
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [price, setPrice] = useState(0);
  const [sort, setSort] = useState("newest");
  const [map, setMap] = useState(false);
  const [filters, setFilters] = useState(false);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [area, setArea] = useState(0);
  const [locating, setLocating] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lng: number }>();
  const items = useMemo(
    () =>
      data.listings
        .filter(
          (l) =>
            l.status === "published" &&
            (!saved ||
              data.favorites.some(
                (f) => f.userId === user?.id && f.listingId === l.id,
              )),
        )
        .map((listing) => {
          const room = data.rooms.find((r) => r.id === listing.roomId)!;
          const building = buildingOf(data, room);
          return {
            listing,
            room,
            building,
            distance: position ? distanceKm(position, building) : undefined,
          };
        })
        .filter(
          (x) =>
            x.room.status === "available" &&
            (!city || x.building.city === city) &&
            (!price || x.room.rent <= price) &&
            x.room.area >= area &&
            amenities.every((a) => x.room.amenities.includes(a)) &&
            normalize(
              `${x.building.area} ${x.building.city} ${x.building.name} ${x.listing.title} ${x.building.address}`,
            ).includes(normalize(query)),
        )
        .sort((a, b) =>
          sort === "priceAsc"
            ? a.room.rent - b.room.rent
            : sort === "priceDesc"
              ? b.room.rent - a.room.rent
              : sort === "distance"
                ? (a.distance || 0) - (b.distance || 0)
                : b.listing.createdAt.localeCompare(a.listing.createdAt),
        ),
    [data, user, saved, query, city, price, sort, position, amenities, area],
  );
  const locate = () => {
    if (!navigator.geolocation) {
      toast("Thiết bị không hỗ trợ định vị. Bạn có thể chọn khu vực.", true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
        setSort("distance");
        setLocating(false);
        toast("Đã sắp xếp theo khoảng cách từ vị trí của bạn.");
      },
      () => {
        setLocating(false);
        toast(
          "Chưa lấy được vị trí. Cấp quyền định vị hoặc chọn khu vực thủ công.",
          true,
        );
      },
      { timeout: 10000 },
    );
  };
  return (
    <main>
      {!saved ? (
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">
                <span className="live-dot" />
                KẾT NỐI NGƯỜI THUÊ VÀ CHỦ TRỌ
              </span>
              <h1>
                Tìm một nơi ở.
                <br />
                <span>Vừa vặn với bạn.</span>
              </h1>
              <p>
                Một căn phòng đúng ý, một khu vực thân quen.
                <br />
                Khám phá không gian sống tiếp theo cùng TrọGọn.
              </p>
              <div className="hero-trust">
                <span>
                  <Check size={15} />
                  Chi phí hiển thị rõ ràng
                </span>
                <span>
                  <Check size={15} />
                  Liên hệ trực tiếp chủ trọ
                </span>
              </div>
            </div>
            <div className="hero-visual">
              <img
                src="/images/room-1.jpg"
                alt="Không gian phòng ở sáng và ấm áp minh họa"
              />
              <div className="hero-image-label">
                <span className="sparkle-icon">
                  <Sparkles size={20} />
                </span>
                <div>
                  <strong>Không gian nhỏ. Cuộc sống lớn.</strong>
                  <small>Ảnh minh họa không gian sống</small>
                </div>
              </div>
              <div className="hero-float">
                <Home size={19} />
                <span>
                  Một nơi để gọi là <b>nhà.</b>
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="saved-heading container">
          <span className="eyebrow">
            <Heart size={16} />
            BỘ SƯU TẬP CỦA BẠN
          </span>
          <h1>Những nơi bạn muốn trở về.</h1>
          <p>
            Các phòng yêu thích được lưu cùng tài khoản của bạn trên thiết bị
            này.
          </p>
        </section>
      )}
      <section className="container search-section">
        <div className="search-panel">
          <label className="main-search">
            <MapPin size={21} />
            <div>
              <span>BẠN MUỐN Ở ĐÂU?</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Khu vực, tên đường hoặc tòa nhà"
                aria-label="Khu vực, tên đường hoặc tòa nhà"
              />
            </div>
          </label>
          <label className="search-select">
            <span>THÀNH PHỐ</span>
            <select
              aria-label="Thành phố"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              <option value="">Tất cả thành phố</option>
              {[
                ...new Set([
                  ...appConfig.cities,
                  ...data.buildings.map((b) => b.city),
                ]),
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="search-select">
            <span>NGÂN SÁCH / THÁNG</span>
            <select
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              aria-label="Ngân sách"
            >
              <option value={0}>Mọi mức giá</option>
              <option value={3000000}>Dưới 3 triệu</option>
              <option value={4000000}>Dưới 4 triệu</option>
              <option value={5000000}>Dưới 5 triệu</option>
            </select>
          </label>
          <button
            className="btn primary search-submit"
            onClick={() =>
              document
                .getElementById("results")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <Search size={19} />
            Tìm phòng
          </button>
        </div>
        <div className="popular-areas">
          <span>Khu vực gợi ý</span>
          {["Bình Thạnh", "Thủ Đức", "Cầu Giấy", "Sơn Trà"].map((a) => (
            <button
              className={query === a ? "active" : ""}
              key={a}
              onClick={() => {
                setQuery(a === query ? "" : a);
                setCity("");
              }}
            >
              {a}
            </button>
          ))}
          <button className="nearby-link" disabled={locating} onClick={locate}>
            <Navigation size={14} />
            {locating ? "Đang định vị…" : "Gần tôi"}
          </button>
        </div>
      </section>
      <section className="container results-section" id="results">
        <div className="results-head">
          <div>
            <span className="eyebrow">KHÔNG GIAN DÀNH CHO BẠN</span>
            <h2>
              {saved ? "Phòng đã lưu" : "Khám phá phòng còn trống"}
              <span className="result-count">{items.length}</span>
            </h2>
            <p>
              {saved && !user
                ? "Đăng nhập bằng tài khoản người thuê để lưu các phòng bạn quan tâm."
                : "Các tin dưới đây là dữ liệu mẫu để trải nghiệm tính năng."}
            </p>
          </div>
          <div className="result-controls">
            <button className="btn secondary" onClick={() => setFilters(true)}>
              <SlidersHorizontal size={16} />
              Bộ lọc
              {amenities.length + (area ? 1 : 0) > 0 && (
                <b>{amenities.length + (area ? 1 : 0)}</b>
              )}
            </button>
            <select
              aria-label="Sắp xếp phòng"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">Mới cập nhật</option>
              <option value="priceAsc">Giá tăng dần</option>
              <option value="priceDesc">Giá giảm dần</option>
              {position && <option value="distance">Gần bạn nhất</option>}
            </select>
            <div className="view-toggle">
              <button
                className={!map ? "active" : ""}
                onClick={() => setMap(false)}
                aria-label="Xem dạng lưới"
              >
                <Grid2X2 size={18} />
              </button>
              <button
                className={map ? "active" : ""}
                onClick={() => setMap(true)}
                aria-label="Xem bản đồ"
              >
                <Map size={18} />
              </button>
            </div>
          </div>
        </div>
        {items.length ? (
          <div className={map ? "map-results" : ""}>
            <div className="room-grid">
              {items.map((x) => (
                <RoomCard
                  key={x.listing.id}
                  listing={x.listing}
                  distance={x.distance}
                />
              ))}
            </div>
            {map && (
              <Suspense fallback={<div className="empty">Đang mở bản đồ…</div>}>
                <RoomMap items={items} position={position} />
              </Suspense>
            )}
          </div>
        ) : (
          <Empty
            title={
              saved ? "Chưa có phòng trong danh sách" : "Chưa có phòng phù hợp"
            }
            description={
              saved
                ? "Bấm biểu tượng trái tim trên phòng bạn thích để lưu lại."
                : "Thử đổi khu vực, tăng ngân sách hoặc bớt tiện ích."
            }
            action={
              <button
                className="btn primary"
                onClick={() => {
                  setQuery("");
                  setCity("");
                  setPrice(0);
                  setAmenities([]);
                  setArea(0);
                }}
              >
                Xóa bộ lọc
              </button>
            }
          />
        )}
      </section>
      {!saved && (
        <>
          <section className="container benefits-strip">
            <div>
              <span className="benefit-icon">
                <Search size={23} />
              </span>
              <h3>Tìm đúng nhu cầu</h3>
              <p>
                Khu vực, ngân sách và tiện ích.
                <br />
                Chọn những gì quan trọng với bạn.
              </p>
            </div>
            <div>
              <span className="benefit-icon">
                <ShieldCheck size={23} />
              </span>
              <h3>Rõ ràng trước khi thuê</h3>
              <p>
                Giá phòng, điện nước và phí dịch vụ
                <br />
                được hiển thị cùng nhau.
              </p>
            </div>
            <div>
              <span className="benefit-icon">
                <Home size={23} />
              </span>
              <h3>Gọn cả khi đã ở</h3>
              <p>
                Theo dõi thông tin phòng, hóa đơn
                <br />
                và gửi yêu cầu hỗ trợ một chỗ.
              </p>
            </div>
          </section>
          <section className="container owner-banner">
            <div>
              <span className="eyebrow light">DÀNH CHO CHỦ TRỌ</span>
              <h2>
                Phòng trống sẵn sàng.
                <br />
                Khách thuê đang tìm.
              </h2>
              <p>Đăng tin cho thuê và quản lý tòa nhà theo cách gọn hơn.</p>
            </div>
            <a className="btn white" href="#/register?role=owner">
              Bắt đầu cùng TrọGọn <ArrowRight size={18} />
            </a>
            <div className="banner-line-art" aria-hidden="true">
              <Home size={160} strokeWidth={0.6} />
            </div>
          </section>
        </>
      )}
      {filters && (
        <Modal title="Tìm không gian phù hợp" onClose={() => setFilters(false)}>
          <div className="modal-body">
            <Field
              label="Diện tích tối thiểu m²"
              type="number"
              min={0}
              value={area}
              onChange={(e) => setArea(Number(e.target.value))}
            />
            <h3>Tiện ích bạn cần</h3>
            <div className="checkbox-grid">
              {appConfig.amenities.map((a) => (
                <label key={a}>
                  <input
                    type="checkbox"
                    checked={amenities.includes(a)}
                    onChange={() =>
                      setAmenities((v) =>
                        v.includes(a) ? v.filter((x) => x !== a) : [...v, a],
                      )
                    }
                  />
                  {a}
                </label>
              ))}
            </div>
            <div className="form-actions">
              <button
                className="btn secondary"
                onClick={() => {
                  setAmenities([]);
                  setArea(0);
                }}
              >
                Đặt lại
              </button>
              <button className="btn primary" onClick={() => setFilters(false)}>
                Xem {items.length} phòng
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
