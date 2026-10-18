import type { Snapshot } from "./models";
export const seedData = (): Snapshot => ({
  version: 1,
  users: [
    {
      id: "admin",
      name: "Quản trị TrọGọn",
      email: "admin@trogon.demo",
      phone: "",
      role: "admin",
      active: true,
    },
    {
      id: "owner",
      name: "Nguyễn Minh Anh",
      email: "chutro@trogon.demo",
      phone: "0900000001",
      role: "owner",
      active: true,
    },
    {
      id: "tenant",
      name: "Trần Hoàng Nam",
      email: "nguoithue@trogon.demo",
      phone: "0900000002",
      role: "tenant",
      active: true,
    },
    {
      id: "tenant2",
      name: "Lê Thảo Vy",
      email: "thaovy@trogon.demo",
      phone: "0900000003",
      role: "tenant",
      active: true,
    },
    {
      id: "owner2",
      name: "Phạm Quang Huy",
      email: "quanghuy@trogon.demo",
      phone: "0900000004",
      role: "owner",
      active: true,
    },
  ],
  buildings: [
    {
      id: "b1",
      ownerId: "owner",
      name: "The Nest Bình Thạnh",
      address: "Khu vực đường Nguyễn Gia Trí",
      area: "Bình Thạnh",
      city: "TP. Hồ Chí Minh",
      lat: 10.8035,
      lng: 106.7144,
      description:
        "Không gian sống nhiều ánh sáng, gần trường học và các tuyến xe buýt.",
    },
    {
      id: "b2",
      ownerId: "owner",
      name: "Mây House Thủ Đức",
      address: "Khu vực đường Võ Văn Ngân",
      area: "Thủ Đức",
      city: "TP. Hồ Chí Minh",
      lat: 10.8493,
      lng: 106.7717,
      description:
        "Nhà có chỗ để xe, cửa ra vào riêng và khu vực sinh hoạt chung.",
    },
    {
      id: "b3",
      ownerId: "owner2",
      name: "An Studio Cầu Giấy",
      address: "Khu vực đường Trần Thái Tông",
      area: "Cầu Giấy",
      city: "Hà Nội",
      lat: 21.0335,
      lng: 105.7897,
      description: "Studio gọn gàng, thuận tiện di chuyển đến khu văn phòng.",
    },
    {
      id: "b4",
      ownerId: "owner2",
      name: "Cozy Home Sơn Trà",
      address: "Khu vực đường Ngô Quyền",
      area: "Sơn Trà",
      city: "Đà Nẵng",
      lat: 16.0718,
      lng: 108.2394,
      description: "Phòng thoáng, có ban công và bếp riêng.",
    },
  ],
  rooms: Array.from({ length: 12 }, (_, i) => ({
    id: `r${i + 1}`,
    buildingId: i < 5 ? "b1" : i < 9 ? "b2" : i < 11 ? "b3" : "b4",
    name: `P${i < 5 ? "20" : "30"}${(i % 5) + 1}`,
    area: [25, 32, 22, 30, 28, 24, 35, 26, 20, 28, 32, 30][i],
    capacity: i % 3 ? 2 : 3,
    rent: [
      3500000, 4200000, 2800000, 3800000, 3200000, 2600000, 4500000, 3100000,
      2400000, 3800000, 4800000, 3600000,
    ][i],
    electricityRate: 3500,
    waterRate: 18000,
    serviceFee: 150000,
    deposit: 3000000,
    electricity: 1482 + i * 120,
    water: 120 + i * 12,
    status:
      i === 0 || i === 2 ? "occupied" : i === 8 ? "maintenance" : "available",
    amenities:
      i % 2
        ? ["Máy lạnh", "Nội thất", "Ban công", "Bếp riêng", "Wifi", "Chỗ để xe"]
        : ["Máy lạnh", "Gác lửng", "Giờ tự do", "Wifi", "Chỗ để xe"],
    images: [
      `/images/room-${(i % 5) + 1}.jpg`,
      `/images/room-${((i + 2) % 5) + 1}.jpg`,
      `/images/room-${((i + 3) % 5) + 1}.jpg`,
    ],
  })),
  listings: Array.from({ length: 12 }, (_, i) => ({
    id: `l${i + 1}`,
    roomId: `r${i + 1}`,
    title: [
      "Studio ngập nắng, đủ nội thất",
      "Không gian riêng, an tâm mỗi ngày",
      "Phòng có gác, thoáng và tiện nghi",
      "Một góc nhỏ để gọi là nhà",
      "Phòng sáng, gần trường và chợ",
    ][i % 5],
    description:
      "Căn phòng có ánh sáng tự nhiên, không gian sinh hoạt riêng và tiện ích thiết thực. Chủ trọ trực tiếp quản lý, công khai các khoản phí trước khi thuê. Liên hệ để thống nhất lịch xem và kiểm tra tình trạng thực tế.",
    status:
      i === 0 || i === 2
        ? "hidden"
        : i === 8
          ? "draft"
          : i === 7
            ? "pending"
            : "published",
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
  })),
  tenancies: [
    {
      id: "t1",
      roomId: "r1",
      tenantId: "tenant",
      startDate: "2026-08-01",
      endDate: "2027-08-01",
      active: true,
      people: 2,
      note: "Hồ sơ mẫu để trải nghiệm không gian người thuê.",
    },
    {
      id: "t2",
      roomId: "r3",
      tenantId: "tenant2",
      startDate: "2026-09-01",
      endDate: "2027-09-01",
      active: true,
      people: 1,
      note: "",
    },
  ],
  invoices: [
    {
      id: "i1",
      roomId: "r1",
      tenantId: "tenant",
      period: new Date().toISOString().slice(0, 7),
      oldElectricity: 1391,
      newElectricity: 1482,
      oldWater: 115,
      newWater: 120,
      electricityRate: 3500,
      waterRate: 18000,
      rent: 3500000,
      serviceFee: 150000,
      status: "issued",
      paymentStatus: "unpaid",
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    },
  ],
  appointments: [],
  requests: [],
  conversations: [],
  favorites: [],
  tickets: [
    {
      id: "s1",
      authorId: "tenant",
      roomId: "r1",
      title: "Kiểm tra vòi nước trong phòng",
      content:
        "Vòi nước có dấu hiệu rò nhẹ. Nhờ chủ trọ sắp xếp kiểm tra giúp.",
      category: "repair",
      status: "open",
      createdAt: new Date().toISOString(),
    },
  ],
  audit: [],
  settings: {
    siteName: "TrọGọn",
    supportEmail: "hotro@example.com",
    electricityRate: 3500,
    waterRate: 18000,
    serviceFee: 150000,
    maintenance: false,
  },
});
