import { describe, expect, it, vi } from "vitest";
import { compressProductImage, isSupportedProductImage, MAX_PRODUCT_IMAGE_BYTES, MAX_PRODUCT_IMAGE_SIDE } from "@/lib/image-optimization";

describe("product image optimization", () => {
  it("accepts only supported raster image source types", () => {
    expect(isSupportedProductImage({ type: "image/jpeg" })).toBe(true);
    expect(isSupportedProductImage({ type: "image/png" })).toBe(true);
    expect(isSupportedProductImage({ type: "image/webp" })).toBe(true);
    expect(isSupportedProductImage({ type: "image/svg+xml" })).toBe(false);
    expect(isSupportedProductImage({ type: "application/pdf" })).toBe(false);
  });

  it("re-encodes to a bounded JPEG and closes the source bitmap", async () => {
    const bitmap = { width: 2400, height: 1200, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    const blob = new Blob(["jpeg"], { type: "image/jpeg" });
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
      toBlob: vi.fn((callback: BlobCallback) => callback(blob)),
    };
    const originalCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, "createElement").mockImplementation(((tag: string, options?: ElementCreationOptions) =>
      tag === "canvas" ? canvas as unknown as HTMLCanvasElement : originalCreate(tag, options)) as typeof document.createElement);

    try {
      const result = await compressProductImage(new File(["source"], "photo.png", { type: "image/png" }));
      expect(result.type).toBe("image/jpeg");
      expect(result.size).toBeLessThanOrEqual(MAX_PRODUCT_IMAGE_BYTES);
      expect(canvas.width).toBe(MAX_PRODUCT_IMAGE_SIDE);
      expect(canvas.height).toBe(640);
      expect(bitmap.close).toHaveBeenCalledOnce();
    } finally {
      createSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
