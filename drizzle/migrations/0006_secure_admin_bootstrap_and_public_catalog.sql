-- Security hardening: admin bootstrap and public catalog visibility.
-- Existing administrator assignments are preserved. New public signups receive
-- only the customer role; the first admin must be assigned by a trusted operator.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles(id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_roles(user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Public users must never invoke this trigger function directly.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Remove permissive public-read policies. PostgreSQL combines permissive
-- policies with OR, so leaving the old policies in place would defeat the fix.
DROP POLICY IF EXISTS "public read products" ON public.products;
DROP POLICY IF EXISTS "public read prices" ON public.prices;
DROP POLICY IF EXISTS "public read offers" ON public.offers;
DROP POLICY IF EXISTS "public read price history" ON public.price_history;

-- Consumers can read only approved products. Catalog editors (admins and
-- market users with the catalog-editor role) retain access to all statuses.
CREATE POLICY "public read approved products"
ON public.products
FOR SELECT
TO anon, authenticated
USING (
  status = 'approved'
  OR (auth.uid() IS NOT NULL AND public.is_catalog_editor())
);

-- Prices and offers are public only while their related product is approved.
-- Authorized catalog editors can still inspect pending/rejected catalog data.
CREATE POLICY "public read prices for approved products"
ON public.prices
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = prices.product_id
      AND p.status = 'approved'
  )
  OR (auth.uid() IS NOT NULL AND public.is_catalog_editor())
);

CREATE POLICY "public read offers for approved products"
ON public.offers
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = offers.product_id
      AND p.status = 'approved'
  )
  OR (auth.uid() IS NOT NULL AND public.is_catalog_editor())
);

-- Price history can reveal pending/rejected product identifiers and prices;
-- apply the same visibility rule to direct history queries.
CREATE POLICY "public read price history for approved products"
ON public.price_history
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = price_history.product_id
      AND p.status = 'approved'
  )
  OR (auth.uid() IS NOT NULL AND public.is_catalog_editor())
);
