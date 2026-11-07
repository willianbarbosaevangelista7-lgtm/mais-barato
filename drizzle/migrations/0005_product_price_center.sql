ALTER TABLE public.prices
  ADD COLUMN IF NOT EXISTS recorded_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.prices ADD CONSTRAINT prices_source_check CHECK (source IN ('manual','scan','import','label_photo','admin'));

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
ALTER TABLE public.products ADD CONSTRAINT products_status_check CHECK (status IN ('approved','pending','rejected'));

CREATE TABLE public.price_history (
  id bigserial PRIMARY KEY,
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  market_id text NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  old_price numeric,
  new_price numeric NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX price_history_product_idx ON public.price_history(product_id, changed_at DESC);
GRANT SELECT ON public.price_history TO anon, authenticated;
GRANT ALL ON public.price_history TO service_role;
GRANT USAGE ON SEQUENCE public.price_history_id_seq TO service_role;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read price history" ON public.price_history FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.price_history(product_id, market_id, old_price, new_price, source, changed_at)
SELECT product_id, market_id, NULL, price, source, updated_at::timestamptz FROM public.prices;

CREATE OR REPLACE FUNCTION public.stamp_price() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
begin
  if tg_op = 'INSERT' or new.price is distinct from old.price or new.updated_at is distinct from old.updated_at then
    new.recorded_at := now();
    new.updated_by := auth.uid();
  end if;
  return new;
end $$;
CREATE TRIGGER prices_stamp BEFORE INSERT OR UPDATE ON public.prices FOR EACH ROW EXECUTE FUNCTION public.stamp_price();

CREATE OR REPLACE FUNCTION public.log_price_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if tg_op = 'INSERT' or new.price is distinct from old.price then
    insert into public.price_history(product_id, market_id, old_price, new_price, source, changed_by)
    values (new.product_id, new.market_id, case when tg_op = 'UPDATE' then old.price end, new.price, new.source, auth.uid());
  end if;
  return null;
end $$;
CREATE TRIGGER prices_history AFTER INSERT OR UPDATE ON public.prices FOR EACH ROW EXECUTE FUNCTION public.log_price_change();

-- Only admins approve/reject; products created by markets start pending.
CREATE OR REPLACE FUNCTION public.guard_product_status() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
begin
  if public.has_role(auth.uid(),'admin') or auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
  elsif new.status is distinct from old.status then
    raise exception 'Somente o administrador pode aprovar ou rejeitar produtos.';
  end if;
  return new;
end $$;
CREATE TRIGGER products_status_guard BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.guard_product_status();

CREATE OR REPLACE FUNCTION public.save_market_item_v2(p_product jsonb, p_market_id text, p_price numeric, p_updated_at date, p_offer_id text, p_offer_price numeric, p_valid_until date, p_source text)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
declare
  v_existing public.products%rowtype;
  v_product_id text := p_product->>'id';
begin
  if not public.can_manage_market(p_market_id) then
    raise exception 'Você não tem permissão para gerenciar este mercado.';
  end if;
  if p_source not in ('manual','scan','import','label_photo','admin') then
    raise exception 'Origem de preço inválida.';
  end if;
  select * into v_existing from public.products where id = v_product_id;
  if not found then
    insert into public.products(id,name,brand,category,size,unit,emoji,group_key,barcode,image_path)
    values (v_product_id, p_product->>'name', p_product->>'brand', p_product->>'category',
            (p_product->>'size')::numeric, p_product->>'unit', coalesce(p_product->>'emoji','🛒'),
            p_product->>'group', nullif(p_product->>'barcode',''), nullif(p_product->>'imagePath',''));
  elsif public.can_edit_product(v_product_id) then
    update public.products set
      name = p_product->>'name', brand = p_product->>'brand', category = p_product->>'category',
      size = (p_product->>'size')::numeric, unit = p_product->>'unit',
      barcode = nullif(p_product->>'barcode',''), image_path = nullif(p_product->>'imagePath','')
    where id = v_product_id;
  elsif v_existing.name is distinct from p_product->>'name'
     or v_existing.brand is distinct from p_product->>'brand'
     or v_existing.image_path is distinct from nullif(p_product->>'imagePath','') then
    raise exception 'Somente os mercados que vendem este produto podem alterar nome, marca e foto.';
  end if;
  insert into public.prices(product_id, market_id, price, updated_at, source)
  values (v_product_id, p_market_id, p_price, p_updated_at, p_source)
  on conflict (product_id, market_id) do update set price = excluded.price, updated_at = excluded.updated_at, source = excluded.source;
  if p_offer_price is null then
    delete from public.offers where product_id = v_product_id and market_id = p_market_id;
  else
    insert into public.offers(id, product_id, market_id, price, valid_until)
    values (p_offer_id, v_product_id, p_market_id, p_offer_price, p_valid_until)
    on conflict (product_id, market_id) do update set price = excluded.price, valid_until = excluded.valid_until;
  end if;
end $function$;

CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id text NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('xlsx','csv','label_photo')),
  file_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'review' CHECK (status IN ('review','published','discarded')),
  total integer NOT NULL DEFAULT 0,
  published integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market manages own batches" ON public.import_batches FOR ALL TO authenticated
  USING (public.can_manage_market(market_id)) WITH CHECK (public.can_manage_market(market_id));

CREATE TABLE public.import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_no integer NOT NULL,
  barcode text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  brand text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  size numeric,
  unit text NOT NULL DEFAULT 'un',
  price numeric,
  offer_price numeric,
  valid_until date,
  product_id text,
  action text NOT NULL DEFAULT 'create' CHECK (action IN ('create','update','skip')),
  errors text[] NOT NULL DEFAULT '{}',
  warnings text[] NOT NULL DEFAULT '{}'
);
CREATE INDEX import_rows_batch_idx ON public.import_rows(batch_id, row_no);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_rows TO authenticated;
GRANT ALL ON public.import_rows TO service_role;
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market manages own import rows" ON public.import_rows FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id AND public.can_manage_market(b.market_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id AND public.can_manage_market(b.market_id)));

-- Publishes valid rows of a batch; rows that fail database checks get the error recorded and are skipped.
CREATE OR REPLACE FUNCTION public.publish_import_batch(p_batch_id uuid) RETURNS integer
LANGUAGE plpgsql SET search_path TO 'public' AS $$
declare
  b public.import_batches%rowtype;
  r public.import_rows%rowtype;
  p public.products%rowtype;
  v_id text;
  v_count int := 0;
  v_src text;
begin
  select * into b from public.import_batches where id = p_batch_id;
  if not found or not public.can_manage_market(b.market_id) then
    raise exception 'Você não tem permissão para publicar este lote.';
  end if;
  if b.status <> 'review' then raise exception 'Este lote já foi publicado ou descartado.'; end if;
  v_src := case when b.kind = 'label_photo' then 'label_photo' else 'import' end;
  for r in select * from public.import_rows where batch_id = p_batch_id and action <> 'skip' and cardinality(errors) = 0 order by row_no loop
    begin
      p := null;
      if r.barcode <> '' then select * into p from public.products where barcode = r.barcode; end if;
      if p.id is null and r.product_id is not null then select * into p from public.products where id = r.product_id; end if;
      if p.id is not null then
        v_id := p.id;
        perform public.save_market_item_v2(jsonb_build_object('id',p.id,'name',p.name,'brand',p.brand,'category',p.category,
          'size',p.size,'unit',p.unit,'emoji',p.emoji,'group',p.group_key,'barcode',coalesce(p.barcode,''),'imagePath',coalesce(p.image_path,'')),
          b.market_id, r.price, (now() at time zone 'America/Sao_Paulo')::date,
          'o' || replace(gen_random_uuid()::text,'-',''), r.offer_price, r.valid_until, v_src);
      else
        v_id := 'p' || replace(gen_random_uuid()::text,'-','');
        perform public.save_market_item_v2(jsonb_build_object('id',v_id,'name',r.name,'brand',coalesce(nullif(r.brand,''),'Sem marca'),
          'category',r.category,'size',r.size,'unit',r.unit,'emoji','🛒',
          'group',lower(regexp_replace(trim(r.name),'\s+','-','g')),'barcode',r.barcode,'imagePath',''),
          b.market_id, r.price, (now() at time zone 'America/Sao_Paulo')::date,
          'o' || replace(gen_random_uuid()::text,'-',''), r.offer_price, r.valid_until, v_src);
      end if;
      update public.import_rows set product_id = v_id where id = r.id;
      v_count := v_count + 1;
    exception when others then
      update public.import_rows set errors = array_append(errors, sqlerrm) where id = r.id;
    end;
  end loop;
  update public.import_batches set status = 'published', published = v_count, published_at = now() where id = p_batch_id;
  return v_count;
end $$;