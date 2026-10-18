import { parseMeterText } from "../domain/billing";
export async function readMeter(
  image: string,
  previous: number,
  onProgress: (n: number) => void,
) {
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
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    });
    const { data } = await worker.recognize(image);
    return {
      value: parseMeterText(data.text, previous),
      confidence: data.confidence,
      text: data.text,
    };
  } finally {
    await worker.terminate();
  }
}
