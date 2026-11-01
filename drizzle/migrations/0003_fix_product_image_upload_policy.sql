-- Fix: inside the EXISTS subquery, the unqualified "name" resolved to products.name,
-- making the check always pass. Qualify it with objects.name (the uploaded file path).
drop policy "authorized upload product images" on storage.objects;
create policy "authorized upload product images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and public.is_catalog_editor()
  and (
    not exists (select 1 from public.products pr where pr.id = (string_to_array(objects.name, '/'))[1])
    or public.can_edit_product((string_to_array(objects.name, '/'))[1])
  )
);