const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif)$/i;

export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_EXT.test(file.name);
}

export function isHeicFile(file: File): boolean {
  return (
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name) ||
    file.type === "image/heic" ||
    file.type === "image/heif"
  );
}

/** Convert HEIC/HEIF to JPEG for browser preview and downstream APIs (DeepFace, OCR). */
export async function prepareImageUpload(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;

  try {
    const heic2any = (await import("heic2any")).default;
    const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
    const blob = Array.isArray(result) ? result[0] : result;
    const baseName = file.name.replace(/\.(heic|heif)$/i, "") || "photo";
    const converted = new File([blob as Blob], `${baseName}.jpg`, { type: "image/jpeg" });

    return converted;
  } catch {
    throw new Error("Could not read HEIC photo — export as JPEG from Photos or use a JPG/PNG file");
  }
}

export function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function resetFileInput(input: HTMLInputElement | null) {
  if (input) input.value = "";
}
