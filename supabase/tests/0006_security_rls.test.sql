-- pgTAP regression tests for PR #1 / migrations 0006 and 0007.
-- Run against a disposable Supabase database after all migrations.
-- The transaction is rolled back; no persistent fixture data is created.

BEGIN;
SELECT extensions.plan(29);

SELECT extensions.ok(NOT has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE'), 'anon cannot execute handle_new_user directly');
SELECT extensions.ok(NOT has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'), 'authenticated cannot execute handle_new_user directly');

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000101', 'authenticated', 'authenticated', 'security-customer-1@example.test', '', '{"provider":"email","providers":["email"]}', '{}', now(), now());

SELECT extensions.ok(EXISTS (SELECT 1 FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000101'), 'signup creates a profile');
SELECT extensions.ok(EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-000000000101' AND role = 'customer'), 'signup assigns customer role');
SELECT extensions.ok(NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-000000000101' AND role = 'admin'), 'first signup is not promoted to admin');
SELECT extensions.is((SELECT count(*)::integer FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-000000000101'), 1, 'first signup receives exactly one role');

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000102', 'authenticated', 'authenticated', 'security-admin@example.test', '', '{"provider":"email","providers":["email"]}', '{}', now(), now());
INSERT INTO public.user_roles(user_id, role) VALUES ('00000000-0000-0000-0000-000000000102', 'admin');

INSERT INTO auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000103', 'authenticated', 'authenticated', 'security-market@example.test', '', '{"provider":"email","providers":["email"]}', '{}', now(), now());

SELECT extensions.ok(EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-000000000102' AND role = 'admin'), 'trusted existing admin assignment is preserved after signup');
SELECT extensions.ok(NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-000000000103' AND role = 'admin'), 'later signup is not promoted to admin');
INSERT INTO public.user_roles(user_id, role) VALUES ('00000000-0000-0000-0000-000000000103', 'market');

INSERT INTO public.markets(id, name) VALUES ('sec-test-market', 'Mercado Teste Segurança');
INSERT INTO public.products (id, name, brand, category, size, unit, emoji, group_key, status, image_path)
VALUES
  ('sec-approved', 'Produto aprovado', 'Teste', 'Teste', 1, 'un', '🧪', 'sec-test', 'approved', 'sec-approved/photo.jpg'),
  ('sec-pending', 'Produto pendente', 'Teste', 'Teste', 1, 'un', '🧪', 'sec-test', 'pending', 'sec-pending/photo.jpg'),
  ('sec-rejected', 'Produto rejeitado', 'Teste', 'Teste', 1, 'un', '🧪', 'sec-test', 'rejected', 'sec-rejected/photo.jpg');

INSERT INTO public.prices(product_id, market_id, price, updated_at)
VALUES ('sec-approved', 'sec-test-market', 10, CURRENT_DATE), ('sec-pending', 'sec-test-market', 11, CURRENT_DATE), ('sec-rejected', 'sec-test-market', 12, CURRENT_DATE);
INSERT INTO public.market_members(user_id, market_id) VALUES ('00000000-0000-0000-0000-000000000103', 'sec-test-market');

INSERT INTO public.offers(id, product_id, market_id, price, valid_until)
VALUES
  ('sec-offer-approved', 'sec-approved', 'sec-test-market', 8, CURRENT_DATE + 7),
  ('sec-offer-pending', 'sec-pending', 'sec-test-market', 9, CURRENT_DATE + 7),
  ('sec-offer-rejected', 'sec-rejected', 'sec-test-market', 10, CURRENT_DATE + 7);

-- A public bucket bypasses object SELECT RLS, so migration 0007 must make it private.
SELECT extensions.is((SELECT public FROM storage.buckets WHERE id = 'product-images'), false, 'product-images bucket is private so object RLS is enforced');
INSERT INTO storage.objects (bucket_id, name)
VALUES ('product-images', 'sec-approved/photo.jpg'), ('product-images', 'sec-pending/photo.jpg'), ('product-images', 'sec-rejected/photo.jpg');

-- Anonymous visitors see only approved catalog rows and photos.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT extensions.is((SELECT count(*)::integer FROM public.products WHERE id LIKE 'sec-%'), 1, 'anon sees only approved products');
SELECT extensions.is((SELECT count(*)::integer FROM public.prices WHERE product_id LIKE 'sec-%'), 1, 'anon sees only prices for approved products');
SELECT extensions.is((SELECT count(*)::integer FROM public.offers WHERE product_id LIKE 'sec-%'), 1, 'anon sees only offers for approved products');
SELECT extensions.is((SELECT count(*)::integer FROM public.price_history WHERE product_id LIKE 'sec-%'), 1, 'anon sees only history for approved products');
SELECT extensions.is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'product-images' AND name LIKE 'sec-%/photo.jpg'), 1, 'anon can read only approved product images');
RESET ROLE;

-- An ordinary customer has the same public visibility.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000101"}', true);
SELECT extensions.is((SELECT count(*)::integer FROM public.products WHERE id LIKE 'sec-%'), 1, 'customer sees only approved products');
SELECT extensions.is((SELECT count(*)::integer FROM public.prices WHERE product_id LIKE 'sec-%'), 1, 'customer sees only prices for approved products');
SELECT extensions.is((SELECT count(*)::integer FROM public.offers WHERE product_id LIKE 'sec-%'), 1, 'customer sees only offers for approved products');
SELECT extensions.is((SELECT count(*)::integer FROM public.price_history WHERE product_id LIKE 'sec-%'), 1, 'customer sees only history for approved products');
SELECT extensions.is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'product-images' AND name LIKE 'sec-%/photo.jpg'), 1, 'customer can read only approved product images');
RESET ROLE;

-- Market editors can moderate products sold by their market, including images.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000103"}', true);
SELECT extensions.is((SELECT count(*)::integer FROM public.products WHERE id LIKE 'sec-%'), 3, 'market editor sees approved, pending and rejected products');
SELECT extensions.is((SELECT count(*)::integer FROM public.prices WHERE product_id LIKE 'sec-%'), 3, 'market editor sees prices for all product states');
SELECT extensions.is((SELECT count(*)::integer FROM public.offers WHERE product_id LIKE 'sec-%'), 3, 'market editor sees offers for all product states');
SELECT extensions.is((SELECT count(*)::integer FROM public.price_history WHERE product_id LIKE 'sec-%'), 3, 'market editor sees history for all product states');
SELECT extensions.is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'product-images' AND name LIKE 'sec-%/photo.jpg'), 3, 'authorized market editor can read images for all moderation states');
RESET ROLE;

-- Administrators retain moderation visibility for all images.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000102"}', true);
SELECT extensions.is((SELECT count(*)::integer FROM public.products WHERE id LIKE 'sec-%'), 3, 'admin sees approved, pending and rejected products');
SELECT extensions.is((SELECT count(*)::integer FROM public.prices WHERE product_id LIKE 'sec-%'), 3, 'admin sees prices for all product states');
SELECT extensions.is((SELECT count(*)::integer FROM public.offers WHERE product_id LIKE 'sec-%'), 3, 'admin sees offers for all product states');
SELECT extensions.is((SELECT count(*)::integer FROM public.price_history WHERE product_id LIKE 'sec-%'), 3, 'admin sees history for all product states');
SELECT extensions.is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'product-images' AND name LIKE 'sec-%/photo.jpg'), 3, 'admin can read images for all moderation states');
RESET ROLE;

SELECT * FROM extensions.finish();
ROLLBACK;
