create type public.app_role as enum ('admin','market','customer');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
create table public.markets (
  id text primary key,
  name text not null check (length(trim(name)) >= 2),
  neighborhood text not null default '',
  address text not null default '',
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.market_members (
  user_id uuid not null,
  market_id text not null references public.markets(id) on delete cascade,
  primary key (user_id, market_id)
);
create table public.products (
  id text primary key,
  name text not null check (length(trim(name)) >= 2),
  brand text not null default 'Sem marca',
  category text not null,
  size numeric not null check (size > 0),
  unit text not null check (unit in ('kg','g','L','ml','un')),
  emoji text not null default '🛒',
  group_key text not null,
  barcode text check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
  image_path text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index products_barcode_key on public.products(barcode) where barcode is not null;
create table public.prices (
  product_id text not null references public.products(id) on delete cascade,
  market_id text not null references public.markets(id) on delete cascade,
  price numeric(10,2) not null check (price > 0),
  updated_at date not null,
  primary key (product_id, market_id)
);
create table public.offers (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  market_id text not null references public.markets(id) on delete cascade,
  price numeric(10,2) not null check (price > 0),
  valid_until date not null,
  unique (product_id, market_id)
);

grant select on public.markets, public.products, public.prices, public.offers to anon, authenticated;
grant insert, update, delete on public.markets, public.products, public.prices, public.offers to authenticated;
grant select on public.user_roles, public.market_members, public.profiles to authenticated;
grant insert, update, delete on public.user_roles, public.market_members to authenticated;
grant all on public.markets, public.products, public.prices, public.offers, public.user_roles, public.market_members, public.profiles to service_role;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.markets enable row level security;
alter table public.market_members enable row level security;
alter table public.products enable row level security;
alter table public.prices enable row level security;
alter table public.offers enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_market_member(_user_id uuid, _market_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.market_members where user_id = _user_id and market_id = _market_id)
$$;
create or replace function public.can_manage_market(_market_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(),'admin') or public.is_market_member(auth.uid(), _market_id)
$$;
create or replace function public.is_catalog_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'market')
$$;

create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin writes roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "read own memberships" on public.market_members for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin writes memberships" on public.market_members for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create policy "public read markets" on public.markets for select to anon, authenticated using (true);
create policy "public read products" on public.products for select to anon, authenticated using (true);
create policy "public read prices" on public.prices for select to anon, authenticated using (true);
create policy "public read offers" on public.offers for select to anon, authenticated using (true);

create policy "admin inserts markets" on public.markets for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "members update markets" on public.markets for update to authenticated using (public.can_manage_market(id)) with check (public.can_manage_market(id));
create policy "admin deletes markets" on public.markets for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create policy "editors insert products" on public.products for insert to authenticated with check (public.is_catalog_editor());
create policy "editors update products" on public.products for update to authenticated using (public.is_catalog_editor()) with check (public.is_catalog_editor());
create policy "admin deletes products" on public.products for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create policy "members write prices" on public.prices for all to authenticated using (public.can_manage_market(market_id)) with check (public.can_manage_market(market_id));
create policy "members write offers" on public.offers for all to authenticated using (public.can_manage_market(market_id)) with check (public.can_manage_market(market_id));

create or replace function public.validate_price() returns trigger language plpgsql set search_path = public as $$
begin
  if new.updated_at > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A data de atualização não pode ser futura.';
  end if;
  return new;
end $$;
create trigger prices_validate before insert or update on public.prices for each row execute function public.validate_price();

create or replace function public.validate_offer() returns trigger language plpgsql set search_path = public as $$
declare normal numeric;
begin
  if new.valid_until < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A validade da oferta deve ser hoje ou depois.';
  end if;
  select price into normal from public.prices where product_id = new.product_id and market_id = new.market_id;
  if normal is null or new.price >= normal then
    raise exception 'O preço da oferta deve ser menor que o preço normal.';
  end if;
  return new;
end $$;
create trigger offers_validate before insert or update on public.offers for each row execute function public.validate_offer();

create or replace function public.save_market_item(
  p_product jsonb, p_market_id text, p_price numeric, p_updated_at date,
  p_offer_id text, p_offer_price numeric, p_valid_until date
) returns void language plpgsql security invoker set search_path = public as $$
begin
  if not public.can_manage_market(p_market_id) then
    raise exception 'Você não tem permissão para gerenciar este mercado.';
  end if;
  insert into public.products(id,name,brand,category,size,unit,emoji,group_key,barcode,image_path)
  values (p_product->>'id', p_product->>'name', p_product->>'brand', p_product->>'category',
          (p_product->>'size')::numeric, p_product->>'unit', coalesce(p_product->>'emoji','🛒'),
          p_product->>'group', nullif(p_product->>'barcode',''), nullif(p_product->>'imagePath',''))
  on conflict (id) do update set name=excluded.name, brand=excluded.brand, category=excluded.category,
    size=excluded.size, unit=excluded.unit, barcode=excluded.barcode, image_path=excluded.image_path;
  insert into public.prices(product_id, market_id, price, updated_at)
  values (p_product->>'id', p_market_id, p_price, p_updated_at)
  on conflict (product_id, market_id) do update set price=excluded.price, updated_at=excluded.updated_at;
  if p_offer_price is null then
    delete from public.offers where product_id = p_product->>'id' and market_id = p_market_id;
  else
    insert into public.offers(id, product_id, market_id, price, valid_until)
    values (p_offer_id, p_product->>'id', p_market_id, p_offer_price, p_valid_until)
    on conflict (product_id, market_id) do update set price=excluded.price, valid_until=excluded.valid_until;
  end if;
end $$;
grant execute on function public.save_market_item(jsonb,text,numeric,date,text,numeric,date) to authenticated;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email) values (new.id, new.email) on conflict do nothing;
  insert into public.user_roles(user_id, role) values (new.id, 'customer') on conflict do nothing;
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create policy "public read product images" on storage.objects for select to anon, authenticated using (bucket_id = 'product-images');
create policy "editors upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_catalog_editor());
create policy "editors update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_catalog_editor());
create policy "editors delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_catalog_editor());

insert into public.markets(id,name,neighborhood,address,is_demo) values ('m1','Mercado Exemplo Ipê','Zona Norte (fictício)','',true),('m2','Supermercado Demo Jacarandá','Zona Norte (fictício)','',true),('m3','Atacado Teste Cantareira','Zona Norte (fictício)','',true),('m4','Mercadinho Modelo Tucuruvi','Zona Norte (fictício)','',true);
insert into public.products(id,name,brand,category,size,unit,emoji,group_key,is_demo) values ('p1','Arroz branco tipo 1','Grão Bom','Mercearia',5,'kg','🍚','arroz',true),('p2','Arroz branco tipo 1','Campo Real','Mercearia',1,'kg','🍚','arroz',true),('p3','Feijão carioca','Sabor da Terra','Mercearia',1,'kg','🫘','feijao',true),('p4','Feijão carioca','Campo Real','Mercearia',2,'kg','🫘','feijao',true),('p5','Óleo de soja','Dourado','Mercearia',900,'ml','🫗','oleo',true),('p6','Café torrado e moído','Serra Alta','Mercearia',500,'g','☕','cafe',true),('p7','Açúcar refinado','Doce Vida','Mercearia',1,'kg','🧂','acucar',true),('p8','Leite integral UHT','Fazenda Feliz','Laticínios',1,'L','🥛','leite',true),('p9','Leite integral UHT','Vale Verde','Laticínios',1,'L','🥛','leite',true),('p10','Queijo muçarela fatiado','Fazenda Feliz','Laticínios',150,'g','🧀','mucarela',true),('p11','Banana prata','Hortifrúti','Hortifrúti',1,'kg','🍌','banana',true),('p12','Tomate','Hortifrúti','Hortifrúti',1,'kg','🍅','tomate',true),('p13','Detergente líquido','Brilho','Limpeza',500,'ml','🧴','detergente',true),('p14','Papel higiênico folha dupla (12 rolos)','Macio','Higiene',12,'un','🧻','papel',true),('p15','Pão de forma','Padaria Sol','Padaria',500,'g','🍞','pao-forma',true);
insert into public.prices(product_id,market_id,price,updated_at) values ('p1','m1',27.9,'2026-10-07'),('p1','m2',25.49,'2026-10-08'),('p1','m3',23.9,'2026-10-06'),('p1','m4',28.99,'2026-10-09'),('p2','m1',6.49,'2026-10-07'),('p2','m2',5.99,'2026-10-08'),('p2','m4',6.89,'2026-10-09'),('p3','m1',8.99,'2026-10-07'),('p3','m2',7.89,'2026-10-08'),('p3','m3',7.49,'2026-10-06'),('p3','m4',9.29,'2026-10-09'),('p4','m1',16.9,'2026-10-07'),('p4','m2',15.99,'2026-10-08'),('p4','m3',14.29,'2026-10-06'),('p5','m1',7.49,'2026-10-07'),('p5','m2',6.99,'2026-10-08'),('p5','m3',6.59,'2026-10-06'),('p5','m4',7.99,'2026-10-09'),('p6','m1',18.9,'2026-10-07'),('p6','m2',19.49,'2026-10-08'),('p6','m3',16.99,'2026-10-06'),('p6','m4',20.5,'2026-10-09'),('p7','m1',4.99,'2026-10-07'),('p7','m2',4.59,'2026-10-08'),('p7','m3',4.29,'2026-10-06'),('p7','m4',5.19,'2026-10-09'),('p8','m1',5.29,'2026-10-07'),('p8','m2',4.99,'2026-10-08'),('p8','m3',4.69,'2026-10-06'),('p8','m4',5.49,'2026-10-09'),('p9','m1',4.89,'2026-10-07'),('p9','m2',5.19,'2026-10-08'),('p9','m4',4.99,'2026-10-09'),('p10','m1',9.9,'2026-10-07'),('p10','m2',8.79,'2026-10-08'),('p10','m3',8.49,'2026-10-06'),('p10','m4',10.49,'2026-10-09'),('p11','m1',6.99,'2026-10-07'),('p11','m2',7.49,'2026-10-08'),('p11','m3',5.99,'2026-10-06'),('p11','m4',6.49,'2026-10-09'),('p12','m1',8.49,'2026-10-07'),('p12','m2',7.99,'2026-10-08'),('p12','m3',7.29,'2026-10-06'),('p12','m4',8.99,'2026-10-09'),('p13','m1',2.49,'2026-10-07'),('p13','m2',2.29,'2026-10-08'),('p13','m3',1.99,'2026-10-06'),('p13','m4',2.79,'2026-10-09'),('p14','m1',21.9,'2026-10-07'),('p14','m2',19.9,'2026-10-08'),('p14','m3',18.49,'2026-10-06'),('p14','m4',22.9,'2026-10-09'),('p15','m1',8.99,'2026-10-07'),('p15','m2',7.99,'2026-10-08'),('p15','m4',8.49,'2026-10-09');
insert into public.offers(id,product_id,market_id,price,valid_until) values ('o1','p6','m2',15.99,'2026-12-31'),('o2','p8','m4',4.39,'2026-12-31'),('o3','p11','m1',4.99,'2026-12-31');