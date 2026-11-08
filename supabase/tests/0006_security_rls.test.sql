-- pgTAP regression tests for public catalog visibility and market isolation.
-- Uses two market accounts and two distinct markets. All fixtures are rolled back.

BEGIN;
SELECT extensions.plan(55);

SELECT extensions.ok(NOT has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE'), 'anon cannot execute handle_new_user directly');
SELECT extensions.ok(NOT has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'), 'authenticated cannot execute handle_new_user directly');

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000101', 'authenticated', 'authenticated', 'security-customer@example.test', '', '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000102', 'authenticated', 'authenticated', 'security-admin@example.test', '', '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000103', 'authenticated', 'authenticated', 'security-market-a@example.test', '', '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000104', 'authenticated', 'authenticated', 'security-market-b@example.test', '', '{"provider":"email","providers":["email"]}', '{}', now(), now());

SELECT extensions.ok(EXISTS (SELECT 1 FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000101'), 'signup creates a profile');
SELECT extensions.ok(EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-000000000101' AND role = 'customer'), 'signup assigns customer role');
SELECT extensions.ok(NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-000000000101' AND role = 'admin'), 'signup is not promoted to admin');
SELECT extensions.is((SELECT count(*)::integer FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-000000000101'), 1, 'customer signup receives exactly one role');

INSERT INTO public.user_roles(user_id, role)
VALUES
  ('00000000-0000-0000-0000-000000000102', 'admin'),
  ('00000000-0000-0000-0000-000000000103', 'market'),
  ('00000000-0000-0000-0000-000000000104', 'market');

SELECT extensions.ok(EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-000000000102' AND role = 'admin'), 'trusted admin assignment is preserved');
SELECT extensions.ok(NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id IN ('00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000104') AND role = 'admin'), 'market signups are not promoted to admin');

INSERT INTO public.markets(id, name)
VALUES ('sec-market-a', 'Mercado Teste A'), ('sec-market-b', 'Mercado Teste B');

INSERT INTO public.products (id, name, brand, category, size, unit, emoji, group_key, status, image_path)
VALUES
  ('sec-a-approved', 'Produto A aprovado', 'Teste', 'Teste', 1, 'un', '🧪', 'sec-test', 'approved', 'sec-a-approved/photo.jpg'),
  ('sec-a-pending', 'Produto A pendente', 'Teste', 'Teste', 1, 'un', '🧪', 'sec-test', 'pending', 'sec-a-pending/photo.jpg'),
  ('sec-a-rejected', 'Produto A rejeitado', 'Teste', 'Teste', 1, 'un', '🧪', 'sec-test', 'rejected', 'sec-a-rejected/photo.jpg'),
  ('sec-b-approved', 'Produto B aprovado', 'Teste', 'Teste', 1, 'un', '🧪', 'sec-test', 'approved', 'sec-b-approved/photo.jpg'),
  ('sec-b-pending', 'Produto B pendente', 'Teste', 'Teste', 1, 'un', '🧪', 'sec-test', 'pending', 'sec-b-pending/photo.jpg'),
  ('sec-b-rejected', 'Produto B rejeitado', 'Teste', 'Teste', 1, 'un', '🧪', 'sec-test', 'rejected', 'sec-b-rejected/photo.jpg');

INSERT INTO public.prices(product_id, market_id, price, updated_at)
VALUES
  ('sec-a-approved', 'sec-market-a', 10, CURRENT_DATE),
  ('sec-a-pending', 'sec-market-a', 11, CURRENT_DATE),
  ('sec-a-rejected', 'sec-market-a', 12, CURRENT_DATE),
  ('sec-b-approved', 'sec-market-b', 20, CURRENT_DATE),
  ('sec-b-pending', 'sec-market-b', 21, CURRENT_DATE),
  ('sec-b-rejected', 'sec-market-b', 22, CURRENT_DATE);

INSERT INTO public.market_members(user_id, market_id)
VALUES
  ('00000000-0000-0000-0000-000000000103', 'sec-market-a'),
  ('00000000-0000-0000-0000-000000000104', 'sec-market-b');

INSERT INTO public.offers(id, product_id, market_id, price, valid_until)
VALUES
  ('sec-offer-a-approved', 'sec-a-approved', 'sec-market-a', 8, CURRENT_DATE + 7),
  ('sec-offer-a-pending', 'sec-a-pending', 'sec-market-a', 9, CURRENT_DATE + 7),
  ('sec-offer-a-rejected', 'sec-a-rejected', 'sec-market-a', 10, CURRENT_DATE + 7),
  ('sec-offer-b-approved', 'sec-b-approved', 'sec-market-b', 18, CURRENT_DATE + 7),
  ('sec-offer-b-pending', 'sec-b-pending', 'sec-market-b', 19, CURRENT_DATE + 7),
  ('sec-offer-b-rejected', 'sec-b-rejected', 'sec-market-b', 20, CURRENT_DATE + 7);

SELECT extensions.is((SELECT public FROM storage.buckets WHERE id = 'product-images'), false, 'product-images bucket is private');
INSERT INTO storage.objects (bucket_id, name)
VALUES
  ('product-images', 'sec-a-approved/photo.jpg'),
  ('product-images', 'sec-a-pending/photo.jpg'),
  ('product-images', 'sec-a-rejected/photo.jpg'),
  ('product-images', 'sec-b-approved/photo.jpg'),
  ('product-images', 'sec-b-pending/photo.jpg'),
  ('product-images', 'sec-b-rejected/photo.jpg'),
  ('product-images', 'sec-a-pending/orphan.jpg'),
  ('product-images', 'sec-b-pending/orphan.jpg');

-- Public visitors see both approved products and no non-approved products.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT extensions.is(public.has_role('00000000-0000-0000-0000-000000000104', 'market'), false, 'anon cannot probe another user role');
SELECT extensions.is(public.is_market_member('00000000-0000-0000-0000-000000000104', 'sec-market-b'), false, 'anon cannot probe another user membership');
SELECT extensions.is((SELECT count(*)::integer FROM public.products WHERE id LIKE 'sec-%'), 2, 'anon sees only the two approved products');
SELECT extensions.is((SELECT count(*)::integer FROM public.prices WHERE product_id LIKE 'sec-%'), 2, 'anon sees only prices for approved products');
SELECT extensions.is((SELECT count(*)::integer FROM public.offers WHERE product_id LIKE 'sec-%'), 2, 'anon sees only offers for approved products');
SELECT extensions.is((SELECT count(*)::integer FROM public.price_history WHERE product_id LIKE 'sec-%'), 2, 'anon sees only history for approved products');
SELECT extensions.is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'product-images' AND name LIKE 'sec-%/photo.jpg'), 2, 'anon reads only approved product images');
RESET ROLE;

-- A customer has the same public visibility.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000101"}', true);
SELECT extensions.is((SELECT count(*)::integer FROM public.products WHERE id LIKE 'sec-%'), 2, 'customer sees only the two approved products');
SELECT extensions.is((SELECT count(*)::integer FROM public.prices WHERE product_id LIKE 'sec-%'), 2, 'customer sees only prices for approved products');
SELECT extensions.is((SELECT count(*)::integer FROM public.offers WHERE product_id LIKE 'sec-%'), 2, 'customer sees only offers for approved products');
SELECT extensions.is((SELECT count(*)::integer FROM public.price_history WHERE product_id LIKE 'sec-%'), 2, 'customer sees only history for approved products');
SELECT extensions.is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'product-images' AND name LIKE 'sec-%/photo.jpg'), 2, 'customer reads only approved product images');
RESET ROLE;

-- Market A sees public approved rows plus only its own pending/rejected rows.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000103"}', true);
SELECT extensions.is(public.has_role('00000000-0000-0000-0000-000000000103', 'market'), true, 'market A can inspect its own role');
SELECT extensions.is(public.has_role('00000000-0000-0000-0000-000000000104', 'market'), false, 'market A cannot probe market B role');
SELECT extensions.is(public.has_role('00000000-0000-0000-0000-000000000104', 'admin'), false, 'market A cannot probe another user admin status');
SELECT extensions.is(public.is_market_member('00000000-0000-0000-0000-000000000103', 'sec-market-a'), true, 'market A can inspect its own membership');
SELECT extensions.is(public.is_market_member('00000000-0000-0000-0000-000000000104', 'sec-market-b'), false, 'market A cannot probe market B membership');
SELECT extensions.is(public.is_market_member('00000000-0000-0000-0000-000000000104', 'sec-market-a'), false, 'market A cannot probe another user membership in its own market');
SELECT extensions.is((SELECT count(*)::integer FROM public.products WHERE id LIKE 'sec-%'), 4, 'market A sees both approved products and only its own pending/rejected products');
SELECT extensions.is((SELECT count(*)::integer FROM public.prices WHERE product_id LIKE 'sec-%'), 4, 'market A sees public approved prices and only its own private prices');
SELECT extensions.is((SELECT count(*)::integer FROM public.offers WHERE product_id LIKE 'sec-%'), 4, 'market A sees public approved offers and only its own private offers');
SELECT extensions.is((SELECT count(*)::integer FROM public.price_history WHERE product_id LIKE 'sec-%'), 4, 'market A sees public approved history and only its own private history');
SELECT extensions.is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'product-images' AND name LIKE 'sec-%/photo.jpg'), 4, 'market A reads approved images and only its own pending/rejected images');
SELECT extensions.is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'product-images' AND name LIKE 'sec-%/orphan.jpg'), 0, 'market A cannot read unlinked/orphan image objects');
SELECT extensions.ok(NOT EXISTS (SELECT 1 FROM public.products WHERE id IN ('sec-b-pending','sec-b-rejected')), 'market A cannot read market B pending/rejected products');
SELECT extensions.ok(NOT EXISTS (SELECT 1 FROM public.prices WHERE product_id IN ('sec-b-pending','sec-b-rejected')), 'market A cannot read market B pending/rejected prices');
SELECT extensions.ok(NOT EXISTS (SELECT 1 FROM public.offers WHERE product_id IN ('sec-b-pending','sec-b-rejected')), 'market A cannot read market B pending/rejected offers');
SELECT extensions.ok(NOT EXISTS (SELECT 1 FROM public.price_history WHERE product_id IN ('sec-b-pending','sec-b-rejected')), 'market A cannot read market B pending/rejected history');

SELECT extensions.throws_ok(
  $ SELECT public.save_market_item_v2(
    '{"id":"sec-a-approved","name":"Produto A aprovado","brand":"Teste","category":"Teste","size":1,"unit":"un","group":"sec-test","imagePath":"sec-a-approved/photo.jpg"}'::jsonb,
    'sec-market-a', 13, CURRENT_DATE, 'sec-admin-source-offer', NULL, NULL, 'admin'
  ) $,
  'P0001',
  'Somente administradores podem registrar preços com origem admin.',
  'market user cannot spoof admin price source'
);
SELECT extensions.throws_ok(
  $ INSERT INTO public.import_batches(market_id, created_by, kind)
     VALUES ('sec-market-a', '00000000-0000-0000-0000-000000000104', 'csv') $,
  'P0001',
  'created_by deve corresponder ao usuário autenticado.',
  'market user cannot forge import batch creator'
);
RESET ROLE;

-- Market B has the symmetric isolation guarantee.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000104"}', true);
SELECT extensions.is((SELECT count(*)::integer FROM public.products WHERE id LIKE 'sec-%'), 4, 'market B sees both approved products and only its own pending/rejected products');
SELECT extensions.is((SELECT count(*)::integer FROM public.prices WHERE product_id LIKE 'sec-%'), 4, 'market B sees public approved prices and only its own private prices');
SELECT extensions.is((SELECT count(*)::integer FROM public.offers WHERE product_id LIKE 'sec-%'), 4, 'market B sees public approved offers and only its own private offers');
SELECT extensions.is((SELECT count(*)::integer FROM public.price_history WHERE product_id LIKE 'sec-%'), 4, 'market B sees public approved history and only its own private history');
SELECT extensions.is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'product-images' AND name LIKE 'sec-%/photo.jpg'), 4, 'market B reads approved images and only its own pending/rejected images');
SELECT extensions.is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'product-images' AND name LIKE 'sec-%/orphan.jpg'), 0, 'market B cannot read unlinked/orphan image objects');
SELECT extensions.ok(NOT EXISTS (SELECT 1 FROM public.products WHERE id IN ('sec-a-pending','sec-a-rejected')), 'market B cannot read market A pending/rejected products');
SELECT extensions.ok(NOT EXISTS (SELECT 1 FROM public.prices WHERE product_id IN ('sec-a-pending','sec-a-rejected')), 'market B cannot read market A pending/rejected prices');
SELECT extensions.ok(NOT EXISTS (SELECT 1 FROM public.offers WHERE product_id IN ('sec-a-pending','sec-a-rejected')), 'market B cannot read market A pending/rejected offers');
SELECT extensions.ok(NOT EXISTS (SELECT 1 FROM public.price_history WHERE product_id IN ('sec-a-pending','sec-a-rejected')), 'market B cannot read market A pending/rejected history');
RESET ROLE;

-- Administrators retain full visibility across both markets.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000102"}', true);
SELECT extensions.is(public.has_role('00000000-0000-0000-0000-000000000104', 'market'), true, 'admin can inspect another user role');
SELECT extensions.is(public.is_market_member('00000000-0000-0000-0000-000000000104', 'sec-market-b'), true, 'admin can inspect another user membership');
SELECT extensions.is((SELECT count(*)::integer FROM public.products WHERE id LIKE 'sec-%'), 6, 'admin sees all products in both markets');
SELECT extensions.is((SELECT count(*)::integer FROM public.prices WHERE product_id LIKE 'sec-%'), 6, 'admin sees all prices in both markets');
SELECT extensions.is((SELECT count(*)::integer FROM public.offers WHERE product_id LIKE 'sec-%'), 6, 'admin sees all offers in both markets');
SELECT extensions.is((SELECT count(*)::integer FROM public.price_history WHERE product_id LIKE 'sec-%'), 6, 'admin sees all history in both markets');
RESET ROLE;

SELECT * FROM extensions.finish();
ROLLBACK;
