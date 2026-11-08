-- Tighten object-level Storage authorization without breaking the new-product upload flow.
-- Product images use the canonical path "<product-id>/<unix-timestamp>.jpg".
-- Reads of linked images require the exact image_path; uploads for not-yet-created
-- products are limited to this path shape and remain private to their uploader
-- until the product row is saved and the image is linked.

DROP POLICY IF EXISTS "public read approved product images" ON storage.objects;
DROP POLICY IF EXISTS "authorized upload product images" ON storage.objects;
DROP POLICY IF EXISTS "authorized update product images" ON storage.objects;
DROP POLICY IF EXISTS "authorized delete product images" ON storage.objects;

CREATE POLICY "read approved or authorized linked product images"
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
    OR (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.products pr
        WHERE pr.image_path = storage.objects.name
          AND public.can_edit_product(pr.id)
      )
    )
    -- A user may preview only their own newly uploaded object, never another
    -- user's object or an arbitrary nested path.
    OR (
      auth.uid() IS NOT NULL
      AND owner_id = auth.uid()::text
      AND storage.objects.name ~ '^[A-Za-z0-9_-]+/[0-9]+[.]jpg$'
    )
  )
);

CREATE POLICY "authorized upload canonical product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND public.is_catalog_editor()
  AND storage.objects.name ~ '^[A-Za-z0-9_-]+/[0-9]+[.]jpg$'
  AND (
    NOT EXISTS (
      SELECT 1
      FROM public.products pr
      WHERE pr.id = (string_to_array(storage.objects.name, '/'))[1]
    )
    OR public.can_edit_product((string_to_array(storage.objects.name, '/'))[1])
  )
);

CREATE POLICY "authorized update canonical product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND storage.objects.name ~ '^[A-Za-z0-9_-]+/[0-9]+[.]jpg$'
  AND public.can_edit_product((string_to_array(storage.objects.name, '/'))[1])
)
WITH CHECK (
  bucket_id = 'product-images'
  AND storage.objects.name ~ '^[A-Za-z0-9_-]+/[0-9]+[.]jpg$'
  AND public.can_edit_product((string_to_array(storage.objects.name, '/'))[1])
);

CREATE POLICY "authorized delete canonical product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND storage.objects.name ~ '^[A-Za-z0-9_-]+/[0-9]+[.]jpg$'
  AND public.can_edit_product((string_to_array(storage.objects.name, '/'))[1])
);
