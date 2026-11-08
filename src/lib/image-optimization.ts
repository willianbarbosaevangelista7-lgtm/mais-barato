export const MAX_PRODUCT_IMAGE_SIDE = 1280;
export const MAX_PRODUCT_IMAGE_BYTES = 400_000;
export const PRODUCT_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function isSupportedProductImage(file: Pick<File, "type">): boolean {
  return PRODUCT_IMAGE_MIME_TYPES.includes(file.type.toLowerCase() as (typeof PRODUCT_IMAGE_MIME_TYPES)[number]);
}

/** Re-encodes images as small JPEGs before upload; storage paths are immutable and cacheable. */
export async function compressProductImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  try {
    if (!bitmap.width || !bitmap.height) throw new Error("Imagem inválida.");

    let scale = Math.min(1, MAX_PRODUCT_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Falha ao processar a imagem.");

    for (let resizeAttempt = 0; resizeAttempt < 4; resizeAttempt += 1) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42]) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        if (blob?.type === "image/jpeg" && blob.size <= MAX_PRODUCT_IMAGE_BYTES) return blob;
      }
      scale *= 0.75;
    }
    throw new Error("A imagem ficou maior que o limite de 400 KB. Escolha outra foto.");
  } finally {
    bitmap.close();
  }
}
