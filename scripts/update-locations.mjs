import { mkdir, writeFile } from "node:fs/promises";

// Pin the three-level catalogue used for familiar area-based room searches.
const revision = "e3e9c320e0f75eebb5c9b4725227e628b095e310";
const base = `https://raw.githubusercontent.com/thanglequoc/vietnamese-provinces-database/${revision}`;
const response = await fetch(
  `${base}/json/vn_only_simplified_json_generated_data_vn_units_minified.json`,
);
if (!response.ok)
  throw new Error(`Location download failed: ${response.status}`);
const raw = await response.json();
const locations = raw.map((province) => ({
  code: province.Code,
  name: province.FullName,
  districts: province.District.map((district) => ({
    code: district.Code,
    name: district.FullName,
    wards: (district.Ward || []).map((ward) => ({
      code: ward.Code,
      name: ward.FullName,
    })),
  })),
}));
if (locations.length !== 63)
  throw new Error("Unexpected three-level catalogue.");
const dir = new URL("../src/data/", import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(
  new URL("locations.json", dir),
  JSON.stringify(locations) + "\n",
);
const license = await fetch(`${base}/LICENSE`);
if (!license.ok) throw new Error("Location license download failed.");
await writeFile(new URL("locations.LICENSE.txt", dir), await license.text());
console.log(`Saved ${locations.length} provinces and their districts/wards.`);
