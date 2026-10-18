import type { Invoice } from "./models.ts";
export function calculateInvoice(
  x: Pick<
    Invoice,
    | "oldElectricity"
    | "newElectricity"
    | "oldWater"
    | "newWater"
    | "electricityRate"
    | "waterRate"
    | "rent"
    | "serviceFee"
  >,
) {
  const values = [
    x.oldElectricity,
    x.newElectricity,
    x.oldWater,
    x.newWater,
    x.electricityRate,
    x.waterRate,
    x.rent,
    x.serviceFee,
  ];
  if (values.some((v) => !Number.isFinite(v) || v < 0))
    throw new Error("Chỉ số và số tiền phải là số hợp lệ, không âm.");
  if (x.newElectricity < x.oldElectricity || x.newWater < x.oldWater)
    throw new Error(
      "Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ. Kiểm tra lại ảnh hoặc xử lý thay đồng hồ trước.",
    );
  const electricityUsed =
    Math.round((x.newElectricity - x.oldElectricity) * 1000) / 1000;
  const waterUsed = Math.round((x.newWater - x.oldWater) * 1000) / 1000;
  const electricity = Math.round(electricityUsed * x.electricityRate);
  const water = Math.round(waterUsed * x.waterRate);
  return {
    electricityUsed,
    waterUsed,
    electricity,
    water,
    total: x.rent + x.serviceFee + electricity + water,
  };
}
export function parseMeterText(text: string, previous = 0) {
  const candidates = (text.match(/\d+(?:[.,]\d+)?/g) || [])
    .map((s) => Number(s.replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n >= previous);
  return candidates.sort((a, b) => a - b)[0] ?? null;
}
