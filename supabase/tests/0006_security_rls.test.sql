-- pgTAP regression tests for PR #1 / migration 0006.
-- Run against a disposable Supabase database after all migrations:
--   supabase test db
-- The transaction is rolled back; no persistent fixture data is created.

BEGIN;
SELECT extensions.plan(23);

-- 1) Trigger function cannot be called directly by API roles.
SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE'),
  'anon cannot execute handle_new_user directly'
);
SELECT extensions.ok(
  NOT has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'),
  'authenticated cannot execute handle_new_user directly'
);

-- 2) Simulate public signups. The first signup must not become admin.
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000101',
  'authenticated', 'authenticated', 'security-customer-1@example.test', '',
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = '00000000-0000-0000-0000-000000000101'
  ),
  'signup creates a profile'
);
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '00000000-0000-0000-0000-000000000101'
      AND role = 'customer'
  ),
  'signup assigns customer role'
);
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '00000000-0000-0000-0000-000000000101'
      AND role = 'admin'
  ),
  'first signup is not promoted to admin'
);

-- Add a deliberately provisioned admin, then prove later signups do not
-- remove or duplicate that assignment and do not inherit admin.
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000102',
  'authenticated', 'authenticated', 'security-admin@example.test', '',
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);
INSERT INTO public.user_roles(user_id, role)
VALUES ('00000000-0000-0000-0000-000000000102', 'admin');

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000103',
  'authenticated', 'authenticated', 'security-market@example.test', '',
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '00000000-0000-0000-0000-000000000102'
      AND role = 'admin'
  ),
  'trusted existing admin assignment is preserved after signup'
);
SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '00000000-0000-0000-0000-000000000103'
      AND role = 'admin'
  ),
  'later signup is not promoted to admin'
);

INSERT INTO public.user_roles(user_id, role)
VALUES ('00000000-0000-0000-0000-000000000103', 'market');

-- 3) Create one product in each moderation state, with linked prices,
-- offers and price-history rows. These are isolated test-only identifiers.
INSERT INTO public.markets(id, name)
VALUES ('sec-test-market', 'Mercado Teste Segurança');

INSERT INTO public.products
  (id, name, brand, category, size, unit, emoji, group_key, status)
VALUES
  ('sec-approved', 'Produto aprovado', 'Teste', 'Teste', 1, 'un', '🧪', 'sec-test', 'approved'),
  ('sec-pending',  'Produto pendente',  'Teste', 'Teste', 1, 'un', '🧪', 'sec-test', 'pending'),
  ('sec-rejected', 'Produto rejeitado', 'Teste', 'Teste', 1, 'un', '🧪', 'sec-test', 'rejected');

INSERT INTO public.prices(product_id, market_id, price, updated_at)
VALUES
  ('sec-approved', 'sec-test-market', 10, CURRENT_DATE),
  ('sec-pending',  'sec-test-market', 11, CURRENT_DATE),
  ('sec-rejected', 'sec-test-market', 12, CURRENT_DATE);

INSERT INTO public.offers(id, product_id, market_id, price, valid_until)
VALUES
  ('sec-offer-approved', 'sec-approved', 'sec-test-market', 8, CURRENT_DATE + 7),
  ('sec-offer-pending',  'sec-pending',  'sec-test-market', 9, CURRENT_DATE + 7),
  ('sec-offer-rejected', 'sec-rejected', 'sec-test-market', 10, CURRENT_DATE + 7);

-- Price insert trigger (migration 0005) creates one history row per product.

-- 4) Anonymous visitors can see only approved catalog records.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT extensions.is((SELECT count(*)::integer FROM public.products WHERE id LIKE 'sec-%'), 1,
  'anon sees only approved products');
SELECT extensions.is((SELECT count(*)::integer FROM public.prices WHERE product_id LIKE 'sec-%'), 1,
  'anon sees only prices for approved products');
SELECT extensions.is((SELECT count(*)::integer FROM public.offers WHERE product_id LIKE 'sec-%'), 1,
  'anon sees only offers for approved products');
SELECT extensions.is((SELECT count(*)::integer FROM public.price_history WHERE product_id LIKE 'sec-%'), 1,
  'anon sees only history for approved products');
RESET ROLE;

-- 5) An ordinary customer has the same public catalog visibility.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000101"}', true);
SELECT extensions.is((SELECT count(*)::integer FROM public.products WHERE id LIKE 'sec-%'), 1,
  'customer sees only approved products');
SELECT extensions.is((SELECT count(*)::integer FROM public.prices WHERE product_id LIKE 'sec-%'), 1,
  'customer sees only prices for approved products');
SELECT extensions.is((SELECT count(*)::integer FROM public.offers WHERE product_id LIKE 'sec-%'), 1,
  'customer sees only offers for approved products');
SELECT extensions.is((SELECT count(*)::integer FROM public.price_history WHERE product_id LIKE 'sec-%'), 1,
  'customer sees only history for approved products');
RESET ROLE;

-- 6) A market/editor can inspect all moderation states for catalog work.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000103"}', true);
SELECT extensions.is((SELECT count(*)::integer FROM public.products WHERE id LIKE 'sec-%'), 3,
  'market editor sees approved, pending and rejected products');
SELECT extensions.is((SELECT count(*)::integer FROM public.prices WHERE product_id LIKE 'sec-%'), 3,
  'market editor sees prices for all product states');
SELECT extensions.is((SELECT count(*)::integer FROM public.offers WHERE product_id LIKE 'sec-%'), 3,
  'market editor sees offers for all product states');
SELECT extensions.is((SELECT count(*)::integer FROM public.price_history WHERE product_id LIKE 'sec-%'), 3,
  'market editor sees history for all product states');
RESET ROLE;

-- 7) An administrator retains the same moderation visibility.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000102"}', true);
SELECT extensions.is((SELECT count(*)::integer FROM public.products WHERE id LIKE 'sec-%'), 3,
  'admin sees approved, pending and rejected products');
SELECT extensions.is((SELECT count(*)::integer FROM public.prices WHERE product_id LIKE 'sec-%'), 3,
  'admin sees prices for all product states');
SELECT extensions.is((SELECT count(*)::integer FROM public.offers WHERE product_id LIKE 'sec-%'), 3,
  'admin sees offers for all product states');
SELECT extensions.is((SELECT count(*)::integer FROM public.price_history WHERE product_id LIKE 'sec-%'), 3,
  'admin sees history for all product states');
RESET ROLE;

SELECT * FROM extensions.finish();
ROLLBACK;
