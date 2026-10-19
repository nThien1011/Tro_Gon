import { meterCandidates } from "../domain/billing";

export type MeterCrop = {
  left: number;
  top: number;
  width: number;
  height: number;
};
export type MeterOcrResult = {
  value: number | null;
  candidates: number[];
  confidence: number;
  text: string;
};
export const fullMeterCrop: MeterCrop = {
  left: 0,
  top: 0,
  width: 100,
  height: 100,
};
let queue: Promise<unknown> = Promise.resolve();

async function prepareImage(image: string, crop: MeterCrop, contrast: boolean) {
  const source = new Image();
  source.src = image;
  await source.decode();
  const sx = (source.naturalWidth * crop.left) / 100;
  const sy = (source.naturalHeight * crop.top) / 100;
  const sw = Math.max(1, (source.naturalWidth * crop.width) / 100);
  const sh = Math.max(1, (source.naturalHeight * crop.height) / 100);
  const scale = Math.min(4, 2200 / sw);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    let gray =
      0.299 * pixels.data[i] +
      0.587 * pixels.data[i + 1] +
      0.114 * pixels.data[i + 2];
    if (contrast) gray = gray > 145 ? 255 : 0;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = gray;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/png");
}

export function readMeter(
  image: string,
  previous: number,
  onProgress: (n: number) => void,
  crop: MeterCrop = fullMeterCrop,
): Promise<MeterOcrResult> {
  const job = queue.then(async () => {
    const { createWorker, PSM } = await import("tesseract.js");
    const worker = await createWorker("eng", 1, {
      logger: (message) => {
        if (message.status === "recognizing text")
          onProgress(Math.round(message.progress * 100));
      },
    });
    try {
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789.,",
        tessedit_pageseg_mode:
          crop.width < 100 || crop.height < 100
            ? PSM.SINGLE_LINE
            : PSM.SPARSE_TEXT,
      });
      let best: MeterOcrResult = {
        value: null,
        candidates: [],
        confidence: 0,
        text: "",
      };
      for (const contrast of [false, true]) {
        const { data } = await worker.recognize(
          await prepareImage(image, crop, contrast),
        );
        const candidates = meterCandidates(data.text, previous);
        const result: MeterOcrResult = {
          value: candidates.length === 1 ? candidates[0] : null,
          candidates,
          confidence: data.confidence,
          text: data.text.trim().slice(0, 500),
        };
        if (
          (result.value !== null && best.value === null) ||
          (result.value !== null && result.confidence > best.confidence) ||
          (!best.candidates.length && result.candidates.length)
        )
          best = result;
        if (!best.text) best = result;
        if (best.value !== null && best.confidence >= 75) break;
      }
      return best;
    } finally {
      await worker.terminate();
    }
  });
  queue = job.catch(() => undefined);
  return job;
}
