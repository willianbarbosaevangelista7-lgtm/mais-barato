-- Cost and abuse controls for the private product image bucket.
-- The client re-encodes supported source images to JPEG <= 400 KB before upload.
-- Keep the bucket private: object-level RLS remains mandatory for signed URLs.
UPDATE storage.buckets
   SET public = false,
       file_size_limit = 1048576,
       allowed_mime_types = ARRAY['image/jpeg']::text[]
 WHERE id = 'product-images';

DO $
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'product-images') THEN
    RAISE EXCEPTION 'Bucket product-images must exist before applying storage limits.';
  END IF;
END
$;
