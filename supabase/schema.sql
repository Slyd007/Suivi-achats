-- Suivi Achats Isigny — schéma Supabase
-- À exécuter dans Supabase > SQL Editor sur un projet neuf.
-- IMPORTANT : ne mettez jamais de clé service_role dans l'application web.

create extension if not exists pgcrypto;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  code text not null,
  vat_rate numeric(6,5) not null default 0.055 check (vat_rate >= 0 and vat_rate < 1),
  target_margin_rate numeric(6,5) null check (target_margin_rate is null or (target_margin_rate >= 0 and target_margin_rate < 1)),
  weekday_weights jsonb not null default '[1,1,1,1,1,1,1]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, code)
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  department_id uuid null references public.departments(id) on delete set null,
  display_name text not null,
  role text not null check (role in ('admin','direction','team')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_requires_department check (role <> 'team' or department_id is not null)
);

create table if not exists public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  year integer not null check (year between 2020 and 2100),
  month integer not null check (month between 1 and 12),
  budget_ca_ttc numeric(14,2) not null default 0 check (budget_ca_ttc >= 0),
  target_margin_rate numeric(6,5) null check (target_margin_rate is null or (target_margin_rate >= 0 and target_margin_rate < 1)),
  margin_source text null,
  updated_at timestamptz not null default now(),
  unique(department_id, year, month)
);

alter table public.monthly_budgets add column if not exists target_margin_rate numeric(6,5) null;
alter table public.monthly_budgets add column if not exists margin_source text null;

create table if not exists public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  date date not null,
  purchase_ht_ex_promo numeric(14,2) null check (purchase_ht_ex_promo is null or purchase_ht_ex_promo >= 0),
  promo_purchase_ht numeric(14,2) null check (promo_purchase_ht is null or promo_purchase_ht >= 0),
  actual_ca_ttc numeric(14,2) null check (actual_ca_ttc is null or actual_ca_ttc >= 0),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(department_id, date)
);

create table if not exists public.month_closings (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  year integer not null check (year between 2020 and 2100),
  month integer not null check (month between 1 and 12),
  opening_stock_ht numeric(14,2) not null default 0 check (opening_stock_ht >= 0),
  closing_stock_ht numeric(14,2) not null default 0 check (closing_stock_ht >= 0),
  shrink_ht numeric(14,2) not null default 0 check (shrink_ht >= 0),
  updated_at timestamptz not null default now(),
  unique(department_id, year, month)
);

create table if not exists public.entry_audit (
  id bigint generated always as identity primary key,
  entry_id uuid null,
  department_id uuid not null references public.departments(id) on delete cascade,
  date date not null,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  changed_at timestamptz not null default now(),
  changed_by uuid null references auth.users(id) on delete set null,
  changed_by_name text null,
  before_row jsonb null,
  after_row jsonb null
);

create index if not exists daily_entries_department_date_idx on public.daily_entries(department_id,date);
create index if not exists entry_audit_department_changed_idx on public.entry_audit(department_id,changed_at desc);
create index if not exists monthly_budgets_department_period_idx on public.monthly_budgets(department_id,year,month);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists departments_set_updated_at on public.departments;
create trigger departments_set_updated_at before update on public.departments
for each row execute function public.set_updated_at();
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists monthly_budgets_set_updated_at on public.monthly_budgets;
create trigger monthly_budgets_set_updated_at before update on public.monthly_budgets
for each row execute function public.set_updated_at();
drop trigger if exists month_closings_set_updated_at on public.month_closings;
create trigger month_closings_set_updated_at before update on public.month_closings
for each row execute function public.set_updated_at();

create or replace function public.current_profile_store()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select store_id from public.profiles where user_id = auth.uid();
$$;
create or replace function public.current_profile_role()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.profiles where user_id = auth.uid();
$$;
create or replace function public.current_profile_department()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select department_id from public.profiles where user_id = auth.uid();
$$;
create or replace function public.is_direction()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select role in ('admin','direction') from public.profiles where user_id = auth.uid()), false);
$$;

create or replace function public.daily_entries_before_write()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    new.created_by = auth.uid();
  end if;
  new.updated_by = auth.uid();
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists daily_entries_before_write on public.daily_entries;
create trigger daily_entries_before_write before insert or update on public.daily_entries
for each row execute function public.daily_entries_before_write();

create or replace function public.audit_daily_entry()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  actor_name text;
  entry_uuid uuid;
  dept uuid;
  day date;
  before_json jsonb;
  after_json jsonb;
begin
  select display_name into actor_name from public.profiles where user_id = auth.uid();
  if tg_op = 'DELETE' then
    entry_uuid := old.id; dept := old.department_id; day := old.date; before_json := to_jsonb(old); after_json := null;
  elsif tg_op = 'INSERT' then
    entry_uuid := new.id; dept := new.department_id; day := new.date; before_json := null; after_json := to_jsonb(new);
  else
    entry_uuid := new.id; dept := new.department_id; day := new.date; before_json := to_jsonb(old); after_json := to_jsonb(new);
  end if;
  insert into public.entry_audit(entry_id,department_id,date,action,changed_by,changed_by_name,before_row,after_row)
  values(entry_uuid,dept,day,tg_op,auth.uid(),actor_name,before_json,after_json);
  return case when tg_op='DELETE' then old else new end;
end;
$$;
drop trigger if exists daily_entries_audit on public.daily_entries;
create trigger daily_entries_audit after insert or update or delete on public.daily_entries
for each row execute function public.audit_daily_entry();

-- RLS
alter table public.stores enable row level security;
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.monthly_budgets enable row level security;
alter table public.daily_entries enable row level security;
alter table public.month_closings enable row level security;
alter table public.entry_audit enable row level security;

-- Lecture du magasin / profils / rayons du même magasin
create policy stores_select_same_store on public.stores for select to authenticated
using (id = public.current_profile_store());
create policy departments_select_same_store on public.departments for select to authenticated
using (store_id = public.current_profile_store());
create policy profiles_select on public.profiles for select to authenticated
using (user_id = auth.uid() or (public.is_direction() and store_id = public.current_profile_store()));

-- Seule la direction modifie les paramètres
create policy departments_update_direction on public.departments for update to authenticated
using (public.is_direction() and store_id = public.current_profile_store())
with check (public.is_direction() and store_id = public.current_profile_store());
create policy budgets_select on public.monthly_budgets for select to authenticated
using (exists(select 1 from public.departments d where d.id=department_id and d.store_id=public.current_profile_store()));
create policy budgets_write_direction on public.monthly_budgets for all to authenticated
using (public.is_direction() and exists(select 1 from public.departments d where d.id=department_id and d.store_id=public.current_profile_store()))
with check (public.is_direction() and exists(select 1 from public.departments d where d.id=department_id and d.store_id=public.current_profile_store()));

-- Saisies : direction = tous les rayons du magasin ; équipe = son rayon uniquement
create policy entries_select on public.daily_entries for select to authenticated
using (exists(select 1 from public.departments d where d.id=department_id and d.store_id=public.current_profile_store()) and (public.is_direction() or department_id=public.current_profile_department()));
create policy entries_insert on public.daily_entries for insert to authenticated
with check (exists(select 1 from public.departments d where d.id=department_id and d.store_id=public.current_profile_store()) and (public.is_direction() or department_id=public.current_profile_department()));
create policy entries_update on public.daily_entries for update to authenticated
using (exists(select 1 from public.departments d where d.id=department_id and d.store_id=public.current_profile_store()) and (public.is_direction() or department_id=public.current_profile_department()))
with check (exists(select 1 from public.departments d where d.id=department_id and d.store_id=public.current_profile_store()) and (public.is_direction() or department_id=public.current_profile_department()));

create policy audit_select on public.entry_audit for select to authenticated
using (exists(select 1 from public.departments d where d.id=department_id and d.store_id=public.current_profile_store()) and (public.is_direction() or department_id=public.current_profile_department()));

create policy closings_select on public.month_closings for select to authenticated
using (exists(select 1 from public.departments d where d.id=department_id and d.store_id=public.current_profile_store()) and (public.is_direction() or department_id=public.current_profile_department()));
create policy closings_write_direction on public.month_closings for all to authenticated
using (public.is_direction() and exists(select 1 from public.departments d where d.id=department_id and d.store_id=public.current_profile_store()))
with check (public.is_direction() and exists(select 1 from public.departments d where d.id=department_id and d.store_id=public.current_profile_store()));

-- Privilèges Data API : RLS reste la barrière d'autorisation.
grant usage on schema public to authenticated;
grant select on public.stores, public.profiles, public.entry_audit to authenticated;
grant select, update on public.departments to authenticated;
grant select, insert, update, delete on public.monthly_budgets, public.daily_entries, public.month_closings to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Données initiales magasin + 7 rayons. Les taux de marque restent volontairement NULL.
insert into public.stores(id,name,code) values
('11111111-1111-1111-1111-111111111111','Carrefour Market Isigny-sur-Mer','ISIGNY')
on conflict (code) do update set name=excluded.name;

insert into public.departments(id,store_id,name,code,vat_rate,target_margin_rate,weekday_weights) values
('20000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Fruits & Légumes','FL',0.055,0.2870,'[0.65,0.92,0.97,1.00,1.02,1.15,1.22]'::jsonb),
('20000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Poisson','POISSON',0.055,0.2850,'[1,1,1,1,1,1,1]'::jsonb),
('20000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Charcuterie','CHARCUT',0.055,0.4138,'[1,1,1,1,1,1,1]'::jsonb),
('20000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Fromage','FROMAGE',0.055,0.3028,'[1,1,1,1,1,1,1]'::jsonb),
('20000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','Boucherie','BOUCHERIE',0.055,0.3560,'[1,1,1,1,1,1,1]'::jsonb),
('20000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','Volaille','VOLAILLE',0.055,0.3499,'[1,1,1,1,1,1,1]'::jsonb),
('20000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','PVP','PVP',0.055,0.5651,'[1,1,1,1,1,1,1]'::jsonb)
on conflict (store_id,code) do update set name=excluded.name,target_margin_rate=excluded.target_margin_rate;

-- Référence placard août 2026 : marge rayon après frais service.
insert into public.monthly_budgets(department_id,year,month,budget_ca_ttc,target_margin_rate,margin_source) values
('20000000-0000-0000-0000-000000000001',2026,8,0,0.2870,'Placard FRPB57 202608 · marge après frais service'),
('20000000-0000-0000-0000-000000000002',2026,8,0,0.2850,'Placard FRPB57 202608 · marge après frais service'),
('20000000-0000-0000-0000-000000000003',2026,8,0,0.4138,'Placard FRPB57 202608 · marge après frais service'),
('20000000-0000-0000-0000-000000000004',2026,8,0,0.3028,'Placard FRPB57 202608 · marge après frais service'),
('20000000-0000-0000-0000-000000000005',2026,8,0,0.3560,'Placard FRPB57 202608 · marge après frais service'),
('20000000-0000-0000-0000-000000000006',2026,8,0,0.3499,'Placard FRPB57 202608 · marge après frais service'),
('20000000-0000-0000-0000-000000000007',2026,8,0,0.5651,'Placard FRPB57 202608 · marge après frais service')
on conflict (department_id,year,month) do update set target_margin_rate=excluded.target_margin_rate,margin_source=excluded.margin_source;


-- Projection CA Fruits & Légumes Q4 2026.
-- Méthode : historique 2025, tendance Jan-Sept 2026 (+5,19 %) et Avr-Sept 2026 (+8,43 %),
-- pondérées 60/40 => +6,49 %, arrondi à +6,5 % sur les mois comparables 2025.
-- Ces lignes servent de budget de départ et restent modifiables dans l'écran Direction.
insert into public.monthly_budgets(department_id,year,month,budget_ca_ttc,target_margin_rate,margin_source) values
('20000000-0000-0000-0000-000000000001',2026,10,26208.43,0.2870,'Projection FL 2026 · historique 2025 + tendance 2026'),
('20000000-0000-0000-0000-000000000001',2026,11,19680.58,0.2870,'Projection FL 2026 · historique 2025 + tendance 2026'),
('20000000-0000-0000-0000-000000000001',2026,12,27050.84,0.2870,'Projection FL 2026 · historique 2025 + tendance 2026')
on conflict (department_id,year,month) do nothing;
