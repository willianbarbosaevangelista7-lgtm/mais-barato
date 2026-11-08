-- Isolate non-public catalog rows by market.
-- Approved products and their prices/offers/history remain public. For products
-- awaiting moderation, a market user can see only products sold by a market
-- they belong to, and only that market's price/offer/history rows.
-- Administrators retain full moderation visibility.

DROP POLICY IF EXISTS "public read approved products" ON public.products;
DROP POLICY IF EXISTS "public read prices for approved products" ON public.prices;
DROP POLICY IF EXISTS "public read offers for approved products" ON public.offers;
DROP POLICY IF EXISTS "public read price history for approved products" ON public.price_history;

CREATE POLICY "read approved or own-market products"
ON public.products
FOR SELECT
TO anon, authenticated
USING (
  status = 'approved'
  OR (
    auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.can_edit_product(id)
    )
  )
);

CREATE POLICY "read approved or own-market prices"
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
  OR (
    auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.is_market_member(auth.uid(), prices.market_id)
    )
  )
);

CREATE POLICY "read approved or own-market offers"
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
  OR (
    auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.is_market_member(auth.uid(), offers.market_id)
    )
  )
);

CREATE POLICY "read approved or own-market price history"
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
  OR (
    auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.is_market_member(auth.uid(), price_history.market_id)
    )
  )
);
