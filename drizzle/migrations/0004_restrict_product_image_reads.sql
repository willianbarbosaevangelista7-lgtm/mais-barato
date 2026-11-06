DROP POLICY IF EXISTS "public read product images" ON storage.objects;
CREATE POLICY "read linked product images" ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'product-images' AND (
    EXISTS (SELECT 1 FROM public.products pr WHERE pr.image_path = storage.objects.name)
    OR public.can_edit_product((string_to_array(name, '/'))[1])
    OR (auth.uid() IS NOT NULL AND owner_id = auth.uid()::text)
  )
);