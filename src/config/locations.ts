import catalogue from "../data/locations.json" with { type: "json" };
import type { Building } from "../domain/models.ts";

export type Ward = { code: string; name: string };
export type District = { code: string; name: string; wards: Ward[] };
export type Province = { code: string; name: string; districts: District[] };
export type LocationSelection = {
  cityCode: string;
  districtCode: string;
  wardCode: string;
};
export const emptyLocation: LocationSelection = {
  cityCode: "",
  districtCode: "",
  wardCode: "",
};
const priority = ["48", "79", "01"];
export const provinces: Province[] = [...catalogue].sort((a, b) => {
  const aPriority = priority.includes(a.code) ? priority.indexOf(a.code) : 99;
  const bPriority = priority.includes(b.code) ? priority.indexOf(b.code) : 99;
  return aPriority - bPriority || a.name.localeCompare(b.name, "vi");
});
export const districtsOf = (cityCode: string) =>
  provinces.find((p) => p.code === cityCode)?.districts || [];
export const wardsOf = (cityCode: string, districtCode: string) =>
  districtsOf(cityCode).find((d) => d.code === districtCode)?.wards || [];

export function changeLocation(
  current: LocationSelection,
  field: keyof LocationSelection,
  value: string,
): LocationSelection {
  if (field === "cityCode")
    return { cityCode: value, districtCode: "", wardCode: "" };
  if (field === "districtCode")
    return { ...current, districtCode: value, wardCode: "" };
  return { ...current, wardCode: value };
}

export function resolveLocation(selection: LocationSelection) {
  const city = provinces.find((p) => p.code === selection.cityCode);
  const district = city?.districts.find(
    (d) => d.code === selection.districtCode,
  );
  const ward = district?.wards.find((w) => w.code === selection.wardCode);
  return city &&
    district &&
    (ward || (district.wards.length === 0 && !selection.wardCode))
    ? { city, district, ward }
    : undefined;
}

const normalizeName = (name: string) =>
  name
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(
      /^(thanh pho|tinh|quan|huyen|thi xa|phuong|xa|thi tran|tp\.)\s+/,
      "",
    )
    .trim();

// Read legacy city/area labels without deleting or guessing their missing ward.
export function buildingLocationCodes(building: Building): LocationSelection {
  const city =
    provinces.find((p) => p.code === building.cityCode) ||
    provinces.find(
      (p) => normalizeName(p.name) === normalizeName(building.city),
    );
  const district =
    city?.districts.find((d) => d.code === building.districtCode) ||
    city?.districts.find(
      (d) =>
        normalizeName(d.name) ===
        normalizeName(building.district || building.area),
    );
  const ward =
    district?.wards.find((w) => w.code === building.wardCode) ||
    district?.wards.find(
      (w) =>
        building.ward && normalizeName(w.name) === normalizeName(building.ward),
    );
  return {
    cityCode: city?.code || "",
    districtCode: district?.code || "",
    wardCode: ward?.code || "",
  };
}

export function matchesLocation(building: Building, filter: LocationSelection) {
  const location = buildingLocationCodes(building);
  return (
    (!filter.cityCode || filter.cityCode === location.cityCode) &&
    (!filter.districtCode || filter.districtCode === location.districtCode) &&
    (!filter.wardCode || filter.wardCode === location.wardCode)
  );
}

export function buildingAddress(building: Building, includeStreet = true) {
  return [
    includeStreet ? building.address : "",
    building.ward,
    building.district || building.area,
    building.city,
  ]
    .filter(Boolean)
    .join(", ");
}

export function hasCoordinates(
  building: Building,
): building is Building & { lat: number; lng: number } {
  return (
    typeof building.lat === "number" &&
    typeof building.lng === "number" &&
    Number.isFinite(building.lat) &&
    Number.isFinite(building.lng) &&
    Math.abs(building.lat) <= 90 &&
    Math.abs(building.lng) <= 180
  );
}
