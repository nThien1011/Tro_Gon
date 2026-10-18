import { appConfig } from "../config/app";
export async function imageToDataUrl(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type))
    throw new Error("Chọn ảnh JPG, PNG hoặc WebP.");
  if (file.size > appConfig.maxImageBytes) throw new Error("Ảnh tối đa 10 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    appConfig.imageMaxDimension / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}
