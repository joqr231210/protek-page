begin;

create table public.sales_offer_types (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations (id) on delete cascade,
  service_mode text not null check (service_mode in ('workshop', 'field', 'parts')),
  name text not null check (char_length(trim(name)) between 2 and 80),
  position smallint not null check (position > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, service_mode),
  unique (organization_id, position)
);

insert into public.sales_offer_types (organization_id, service_mode, name, position)
select organization.id, type.service_mode, type.name, type.position
from public.organizations organization
cross join (values
  ('workshop', 'Servicio en taller', 10),
  ('field', 'Servicio en campo', 20),
  ('parts', 'Refaccionamiento', 30)
) as type(service_mode, name, position)
on conflict (organization_id, service_mode) do nothing;

create function private.seed_sales_offer_types()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sales_offer_types (organization_id, service_mode, name, position)
  values
    (new.id, 'workshop', 'Servicio en taller', 10),
    (new.id, 'field', 'Servicio en campo', 20),
    (new.id, 'parts', 'Refaccionamiento', 30);
  return new;
end;
$$;

create trigger seed_sales_offer_types_after_organization
after insert on public.organizations
for each row execute function private.seed_sales_offer_types();

create index sales_offer_types_active_idx
  on public.sales_offer_types (organization_id, position)
  where archived_at is null and is_active;

alter table public.sales_offer_types enable row level security;
revoke all on table public.sales_offer_types from anon;
grant select, insert, update, delete on table public.sales_offer_types to authenticated;
grant usage, select on sequence public.sales_offer_types_id_seq to authenticated;

create policy "sales_offer_types_select_member" on public.sales_offer_types for select to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'read')));
create policy "sales_offer_types_insert_admin" on public.sales_offer_types for insert to authenticated
  with check ((select private.has_module_access(organization_id, 'sales', 'admin')));
create policy "sales_offer_types_update_admin" on public.sales_offer_types for update to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'admin')))
  with check ((select private.has_module_access(organization_id, 'sales', 'admin')));
create policy "sales_offer_types_delete_admin" on public.sales_offer_types for delete to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'admin')));

drop policy "profiles_select_self" on public.profiles;
create policy "profiles_select_organization_member" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.organization_members mine
      join public.organization_members colleague
        on colleague.organization_id = mine.organization_id
       and colleague.user_id = profiles.id
       and colleague.status = 'active'
      where mine.user_id = (select auth.uid())
        and mine.status = 'active'
    )
  );

revoke all on function private.seed_sales_offer_types() from public, anon, authenticated;

commit;
