-- Helper: who may edit a product's shared fields (name, brand, photo).
-- Admins always; a market account only when one of its markets already sells the product.
create or replace function public.can_edit_product(_product_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin')
    or exists (
      select 1
      from public.prices p
      join public.market_members mm on mm.market_id = p.market_id
      where p.product_id = _product_id
        and mm.user_id = auth.uid()
    )
$$;

-- Products: updates of shared fields only by authorized markets (inserts stay open to catalog editors).
drop policy "editors update products" on public.products;
create policy "authorized markets update products"
on public.products for update to authenticated
using (public.can_edit_product(id))
with check (public.can_edit_product(id));

-- save_market_item: only authorized markets change name/brand/photo of an existing product;
-- other markets may still attach their own price to it, but only with the existing shared fields.
create or replace function public.save_market_item(
  p_product jsonb, p_market_id text, p_price numeric, p_updated_at date,
  p_offer_id text, p_offer_price numeric, p_valid_until date
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_existing public.products%rowtype;
  v_product_id text := p_product->>'id';
begin
  if not public.can_manage_market(p_market_id) then
    raise exception 'Você não tem permissão para gerenciar este mercado.';
  end if;

  select * into v_existing from public.products where id = v_product_id;

  if not found then
    insert into public.products(id,name,brand,category,size,unit,emoji,group_key,barcode,image_path)
    values (v_product_id, p_product->>'name', p_product->>'brand', p_product->>'category',
            (p_product->>'size')::numeric, p_product->>'unit', coalesce(p_product->>'emoji','🛒'),
            p_product->>'group', nullif(p_product->>'barcode',''), nullif(p_product->>'imagePath',''));
  elsif public.can_edit_product(v_product_id) then
    update public.products set
      name = p_product->>'name',
      brand = p_product->>'brand',
      category = p_product->>'category',
      size = (p_product->>'size')::numeric,
      unit = p_product->>'unit',
      barcode = nullif(p_product->>'barcode',''),
      image_path = nullif(p_product->>'imagePath','')
    where id = v_product_id;
  elsif v_existing.name is distinct from p_product->>'name'
     or v_existing.brand is distinct from p_product->>'brand'
     or v_existing.image_path is distinct from nullif(p_product->>'imagePath','') then
    raise exception 'Somente os mercados que vendem este produto podem alterar nome, marca e foto.';
  end if;

  insert into public.prices(product_id, market_id, price, updated_at)
  values (v_product_id, p_market_id, p_price, p_updated_at)
  on conflict (product_id, market_id) do update set price = excluded.price, updated_at = excluded.updated_at;

  if p_offer_price is null then
    delete from public.offers where product_id = v_product_id and market_id = p_market_id;
  else
    insert into public.offers(id, product_id, market_id, price, valid_until)
    values (p_offer_id, v_product_id, p_market_id, p_offer_price, p_valid_until)
    on conflict (product_id, market_id) do update set price = excluded.price, valid_until = excluded.valid_until;
  end if;
end
$$;

-- Product photos: uploads for existing products and replace/delete only by authorized markets.
-- Uploads for a product that does not exist yet stay open to catalog editors (new product flow).
drop policy "editors upload product images" on storage.objects;
create policy "authorized upload product images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and public.is_catalog_editor()
  and (
    not exists (select 1 from public.products pr where pr.id = (string_to_array(name, '/'))[1])
    or public.can_edit_product((string_to_array(name, '/'))[1])
  )
);

drop policy "editors update product images" on storage.objects;
create policy "authorized update product images"
on storage.objects for update to authenticated
using (bucket_id = 'product-images' and public.can_edit_product((string_to_array(name, '/'))[1]));

drop policy "editors delete product images" on storage.objects;
create policy "authorized delete product images"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and public.can_edit_product((string_to_array(name, '/'))[1]));