-- Keep product images private so Storage always evaluates object-level RLS.
-- Public buckets bypass SELECT policies for object downloads.
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- PostgreSQL combines permissive policies with OR. Replace the previous
-- policy so an image linked to a pending/rejected product is not public.
DROP POLICY IF EXISTS "read linked product images" ON storage.objects;
DROP POLICY IF EXISTS "public read approved product images" ON storage.objects;

CREATE POLICY "public read approved product images"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'product-images'
  AND (
    EXISTS (
      SELECT 1
      FROM public.products pr
      WHERE pr.image_path = storage.objects.name
        AND pr.status = 'approved'
    )
    -- Keep the existing product-level editor permission for moderation.
    OR public.can_edit_product((string_to_array(storage.objects.name, '/'))[1])
    -- Keep an uploader's own object visible to that authenticated uploader;
    -- this does not make pending/rejected images public.
    OR (auth.uid() IS NOT NULL AND owner_id = auth.uid()::text)
  )
);
