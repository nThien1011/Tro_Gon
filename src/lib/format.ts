export const money = (n: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
export const compactMoney = (n: number) =>
  `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} triệu`;
export const dateText = (s: string) =>
  s ? new Date(s).toLocaleDateString("vi-VN") : "Chưa có";
export const initials = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
export const periodNow = () => new Date().toISOString().slice(0, 7);
export const uid = () => crypto.randomUUID();
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
export const normalizeContact = (s: string) =>
  s.includes("@")
    ? s.trim().toLowerCase()
    : s.replace(/[\s().-]/g, "").replace(/^\+84/, "0");
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat),
    dLng = rad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export function downloadFile(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
