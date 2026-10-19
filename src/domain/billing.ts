import type { Invoice } from "./models.ts";
import { BusinessError } from "./errors.ts";
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
  > &
    Pick<
      Invoice,
      | "electricityBillingMode"
      | "waterBillingMode"
      | "electricityMonthlyFee"
      | "waterMonthlyFee"
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
    x.electricityMonthlyFee ?? 0,
    x.waterMonthlyFee ?? 0,
  ];
  if (values.some((v) => !Number.isFinite(v) || v < 0))
    throw new BusinessError("Chỉ số và số tiền phải là số hợp lệ, không âm.");
  if (x.newElectricity < x.oldElectricity || x.newWater < x.oldWater)
    throw new BusinessError(
      "Chỉ số mới phải lớn hơn hoặc bằng chỉ số cũ. Kiểm tra lại ảnh hoặc xử lý thay đồng hồ trước.",
    );
  const electricityUsed =
    Math.round((x.newElectricity - x.oldElectricity) * 1000) / 1000;
  const waterUsed = Math.round((x.newWater - x.oldWater) * 1000) / 1000;
  const electricity =
    x.electricityBillingMode === "fixed"
      ? Math.round(x.electricityMonthlyFee ?? 0)
      : Math.round(electricityUsed * x.electricityRate);
  const water =
    x.waterBillingMode === "fixed"
      ? Math.round(x.waterMonthlyFee ?? 0)
      : Math.round(waterUsed * x.waterRate);
  const total = x.rent + x.serviceFee + electricity + water;
  if (![electricity, water, total].every(Number.isSafeInteger))
    throw new BusinessError("Số tiền vượt giới hạn tính toán an toàn.");
  return {
    electricityUsed,
    waterUsed,
    electricity,
    water,
    total,
  };
}
export function parseMeterText(text: string, previous = 0) {
  const candidates = meterCandidates(text, previous);
  return candidates.length === 1 ? candidates[0] : null;
}
export function meterCandidates(text: string, previous = 0): number[] {
  return [
    ...new Set(
      (text.match(/\d+(?:[.,]\d+)?/g) || [])
        .map((s) => Number(s.replace(",", ".")))
        .filter(
          (n) =>
            Number.isFinite(n) &&
            n >= previous &&
            n <= 1e12 &&
            Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-5,
        ),
    ),
  ];
}
