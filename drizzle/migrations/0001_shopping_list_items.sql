create table public.shopping_list_items (
  user_id uuid not null default auth.uid(),
  product_id text not null references public.products(id) on delete cascade,
  qty integer not null default 1 check (qty >= 1),
  bought boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
grant select, insert, update, delete on public.shopping_list_items to authenticated;
grant all on public.shopping_list_items to service_role;
alter table public.shopping_list_items enable row level security;
create policy "own list" on public.shopping_list_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());