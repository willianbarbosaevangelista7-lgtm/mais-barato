-- Close two identity/source spoofing paths in market catalog writes.
-- Keep service_role/background execution compatible (auth.uid() is NULL there).

CREATE OR REPLACE FUNCTION public.save_market_item_v2(
  p_product jsonb,
  p_market_id text,
  p_price numeric,
  p_updated_at date,
  p_offer_id text,
  p_offer_price numeric,
  p_valid_until date,
  p_source text
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing public.products%rowtype;
  v_product_id text := p_product->>'id';
BEGIN
  IF NOT public.can_manage_market(p_market_id) THEN
    RAISE EXCEPTION 'Você não tem permissão para gerenciar este mercado.';
  END IF;

  IF p_source NOT IN ('manual','scan','import','label_photo','admin') THEN
    RAISE EXCEPTION 'Origem de preço inválida.';
  END IF;

  IF p_source = 'admin'
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem registrar preços com origem admin.';
  END IF;

  SELECT * INTO v_existing FROM public.products WHERE id = v_product_id;
  IF NOT FOUND THEN
    INSERT INTO public.products(id,name,brand,category,size,unit,emoji,group_key,barcode,image_path)
    VALUES (v_product_id, p_product->>'name', p_product->>'brand', p_product->>'category',
            (p_product->>'size')::numeric, p_product->>'unit', coalesce(p_product->>'emoji','🛒'),
            p_product->>'group', nullif(p_product->>'barcode',''), nullif(p_product->>'imagePath',''));
  ELSIF public.can_edit_product(v_product_id) THEN
    UPDATE public.products SET
      name = p_product->>'name', brand = p_product->>'brand', category = p_product->>'category',
      size = (p_product->>'size')::numeric, unit = p_product->>'unit',
      barcode = nullif(p_product->>'barcode',''), image_path = nullif(p_product->>'imagePath','')
    WHERE id = v_product_id;
  ELSIF v_existing.name IS DISTINCT FROM p_product->>'name'
     OR v_existing.brand IS DISTINCT FROM p_product->>'brand'
     OR v_existing.image_path IS DISTINCT FROM nullif(p_product->>'imagePath','') THEN
    RAISE EXCEPTION 'Somente os mercados que vendem este produto podem alterar nome, marca e foto.';
  END IF;

  INSERT INTO public.prices(product_id, market_id, price, updated_at, source)
  VALUES (v_product_id, p_market_id, p_price, p_updated_at, p_source)
  ON CONFLICT (product_id, market_id) DO UPDATE
    SET price = excluded.price, updated_at = excluded.updated_at, source = excluded.source;

  IF p_offer_price IS NULL THEN
    DELETE FROM public.offers WHERE product_id = v_product_id AND market_id = p_market_id;
  ELSE
    INSERT INTO public.offers(id, product_id, market_id, price, valid_until)
    VALUES (p_offer_id, v_product_id, p_market_id, p_offer_price, p_valid_until)
    ON CONFLICT (product_id, market_id) DO UPDATE
      SET price = excluded.price, valid_until = excluded.valid_until;
  END IF;
END
$function$;

CREATE OR REPLACE FUNCTION public.guard_import_batch_created_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'created_by deve corresponder ao usuário autenticado.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS import_batches_guard_created_by ON public.import_batches;
CREATE TRIGGER import_batches_guard_created_by
BEFORE INSERT OR UPDATE OF created_by ON public.import_batches
FOR EACH ROW EXECUTE FUNCTION public.guard_import_batch_created_by();

DROP POLICY IF EXISTS "market manages own batches" ON public.import_batches;
CREATE POLICY "market manages own batches"
ON public.import_batches
FOR ALL TO authenticated
USING (public.can_manage_market(market_id))
WITH CHECK (
  public.can_manage_market(market_id)
  AND created_by = auth.uid()
);
