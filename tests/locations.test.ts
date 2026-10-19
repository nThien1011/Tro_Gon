import { test } from "node:test";
import assert from "node:assert/strict";
import {
  provinces,
  emptyLocation,
  changeLocation,
  resolveLocation,
  buildingLocationCodes,
  matchesLocation,
  buildingAddress,
} from "../src/config/locations.ts";
import { executeCommand } from "../src/domain/commands.ts";
import { seedData } from "../src/domain/seed.ts";

const hoaHai = { cityCode: "48", districtCode: "494", wardCode: "20290" };
const database = () => ({ ...seedData(), credentials: [] });

test("danh mục ba cấp chứa Hòa Hải đúng dưới Ngũ Hành Sơn và Đà Nẵng", () => {
  assert.equal(provinces.length, 63);
  const location = resolveLocation(hoaHai)!;
  assert.equal(location.city.name, "Thành phố Đà Nẵng");
  assert.equal(location.district.name, "Quận Ngũ Hành Sơn");
  assert.equal(location.ward?.name, "Phường Hoà Hải");
  const districtCodes = provinces.flatMap((p) =>
    p.districts.map((d) => d.code),
  );
  const wardCodes = provinces.flatMap((p) =>
    p.districts.flatMap((d) => d.wards.map((w) => w.code)),
  );
  assert.equal(new Set(districtCodes).size, districtCodes.length);
  assert.equal(new Set(wardCodes).size, wardCodes.length);
  assert.ok(wardCodes.length > 9000);
});

test("đổi thành phố hoặc quận xóa các lựa chọn cấp dưới", () => {
  assert.deepEqual(changeLocation(hoaHai, "cityCode", "01"), {
    cityCode: "01",
    districtCode: "",
    wardCode: "",
  });
  assert.deepEqual(changeLocation(hoaHai, "districtCode", "493"), {
    cityCode: "48",
    districtCode: "493",
    wardCode: "",
  });
  assert.equal(resolveLocation({ ...hoaHai, cityCode: "01" }), undefined);
  assert.equal(resolveLocation({ ...hoaHai, districtCode: "493" }), undefined);
});

test("lưu tòa nhà bằng khu vực hợp lệ mà không cần tọa độ", () => {
  const db = database();
  executeCommand(db, "owner", {
    type: "building.save",
    payload: {
      ...hoaHai,
      name: "December",
      address: "25 đường Trường Sa",
      city: "Giá trị không được tin cậy",
      area: "Sai khu vực",
      lat: 10.8035,
      lng: 106.7144,
    },
  });
  const building = db.buildings.at(-1)!;
  assert.equal(building.city, "Thành phố Đà Nẵng");
  assert.equal(building.district, "Quận Ngũ Hành Sơn");
  assert.equal(building.ward, "Phường Hoà Hải");
  assert.equal(building.lat, undefined);
  assert.equal(building.lng, undefined);
  assert.ok(matchesLocation(building, hoaHai));
  assert.ok(matchesLocation(building, { ...hoaHai, wardCode: "" }));
  assert.ok(
    matchesLocation(building, {
      cityCode: "48",
      districtCode: "",
      wardCode: "",
    }),
  );
  assert.ok(matchesLocation(building, emptyLocation));
  assert.equal(
    matchesLocation(building, { ...hoaHai, wardCode: "20287" }),
    false,
  );
  assert.match(
    buildingAddress(building),
    /25 đường Trường Sa, Phường Hoà Hải, Quận Ngũ Hành Sơn, Thành phố Đà Nẵng/,
  );
});

test("từ chối khu vực thiếu hoặc ghép sai thành phố, quận và phường", () => {
  for (const location of [
    emptyLocation,
    { ...hoaHai, wardCode: "" },
    { ...hoaHai, cityCode: "79" },
    { ...hoaHai, districtCode: "493" },
  ]) {
    const db = database();
    const count = db.buildings.length;
    assert.throws(
      () =>
        executeCommand(db, "owner", {
          type: "building.save",
          payload: { ...location, name: "Test", address: "25 Trường Sa" },
        }),
      /hợp lệ/,
    );
    assert.equal(db.buildings.length, count);
  }
});

test("tòa nhà cũ vẫn lọc theo tên khu vực, không tự gán phường", () => {
  const building = database().buildings[0];
  const before = JSON.stringify(building);
  assert.deepEqual(buildingLocationCodes(building), {
    cityCode: "79",
    districtCode: "765",
    wardCode: "",
  });
  assert.ok(
    matchesLocation(building, {
      cityCode: "79",
      districtCode: "765",
      wardCode: "",
    }),
  );
  assert.equal(
    matchesLocation(building, {
      cityCode: "79",
      districtCode: "765",
      wardCode: "26920",
    }),
    false,
  );
  assert.equal(JSON.stringify(building), before);
});

test("đổi địa chỉ xóa tọa độ cũ để tránh hiển thị sai vị trí", () => {
  const db = database();
  const building = db.buildings[0];
  Object.assign(building, {
    ...hoaHai,
    district: "Quận Ngũ Hành Sơn",
    ward: "Phường Hoà Hải",
  });
  executeCommand(db, "owner", {
    type: "building.save",
    payload: {
      ...hoaHai,
      id: building.id,
      name: building.name,
      address: building.address,
    },
  });
  assert.equal(building.lat, 10.8035);
  executeCommand(db, "owner", {
    type: "building.save",
    payload: {
      ...hoaHai,
      id: building.id,
      name: building.name,
      address: "Địa chỉ mới",
    },
  });
  assert.equal(building.lat, undefined);
  assert.equal(building.lng, undefined);
});

test("huyện không phân chia phường xã có thể lưu ở cấp huyện", () => {
  const city = provinces.find((p) =>
    p.districts.some((d) => d.wards.length === 0),
  )!;
  const district = city.districts.find((d) => d.wards.length === 0)!;
  const db = database();
  executeCommand(db, "owner", {
    type: "building.save",
    payload: {
      cityCode: city.code,
      districtCode: district.code,
      wardCode: "",
      name: "Nhà mẫu",
      address: "Đường mẫu",
    },
  });
  assert.equal(db.buildings.at(-1)?.districtCode, district.code);
  assert.equal(db.buildings.at(-1)?.wardCode, "");
});
