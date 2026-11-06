import { z } from "zod";

export const photoInputSchema = z.object({
  image: z.string().max(750_000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/),
});

export const photoResultSchema = z.object({
  query: z.string().max(80),
  label: z.string().max(160),
});

export function parsePhotoResult(text: string) {
  const result = photoResultSchema.parse(JSON.parse(text));
  return { query: result.query.trim(), label: result.label.trim() };
}