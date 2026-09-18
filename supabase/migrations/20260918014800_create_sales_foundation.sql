begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id bigint generated always as identity primary key,
  name text not null check (char_length(trim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.organization_members (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (id, organization_id)
);

create table public.organization_member_module_permissions (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations (id) on delete cascade,
  organization_member_id bigint not null,
  module_key text not null check (module_key in ('sales', 'purchases', 'orders', 'quality', 'agent_ai', 'warehouse', 'resources', 'planning', 'engineering')),
  access_level text not null check (access_level in ('read', 'write', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_member_id, module_key),
  foreign key (organization_member_id, organization_id)
    references public.organization_members (id, organization_id) on delete cascade
);

create table public.sales_pipelines (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, organization_id)
);

create table public.pipeline_stages (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations (id) on delete cascade,
  pipeline_id bigint not null,
  stage_key text not null check (stage_key ~ '^[a-z0-9_]+$'),
  name text not null check (char_length(trim(name)) between 2 and 80),
  position smallint not null check (position >= 0),
  probability_percent numeric(5, 2) not null default 0 check (probability_percent between 0 and 100),
  is_closed boolean not null default false,
  outcome text check (outcome in ('won', 'lost') or outcome is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (pipeline_id, stage_key),
  unique (pipeline_id, position),
  foreign key (pipeline_id, organization_id) references public.sales_pipelines (id, organization_id) on delete cascade,
  check ((is_closed and outcome is not null) or (not is_closed and outcome is null))
);

create table public.customers (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 160),
  legal_name text,
  tax_id text,
  account_code text,
  status text not null default 'active' check (status in ('active', 'inactive', 'prospect')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, organization_id)
);

create table public.customer_contacts (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations (id) on delete cascade,
  customer_id bigint not null,
  name text not null check (char_length(trim(name)) between 2 and 160),
  email text,
  phone text,
  job_title text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  foreign key (customer_id, organization_id) references public.customers (id, organization_id) on delete cascade
);

create table public.assets (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations (id) on delete cascade,
  customer_id bigint not null,
  name text not null check (char_length(trim(name)) between 2 and 180),
  asset_type text,
  manufacturer text,
  model text,
  serial_number text,
  specifications jsonb not null default '{}'::jsonb check (jsonb_typeof(specifications) = 'object'),
  status text not null default 'active' check (status in ('active', 'out_of_service', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, organization_id),
  foreign key (customer_id, organization_id) references public.customers (id, organization_id) on delete restrict
);

create table public.sales_opportunities (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations (id) on delete cascade,
  customer_id bigint not null,
  asset_id bigint,
  pipeline_id bigint not null,
  stage_id bigint not null,
  title text not null check (char_length(trim(title)) between 3 and 220),
  service_mode text not null check (service_mode in ('workshop', 'field', 'parts')),
  estimated_revenue numeric(14, 2) not null default 0 check (estimated_revenue >= 0),
  estimated_cost numeric(14, 2) not null default 0 check (estimated_cost >= 0),
  estimated_margin_percent numeric(6, 2) generated always as (
    case when estimated_revenue > 0
      then round(((estimated_revenue - estimated_cost) / estimated_revenue) * 100, 2)
      else null
    end
  ) stored,
  owner_id uuid references auth.users (id) on delete set null,
  expected_close_at date,
  closed_at timestamptz,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  archived_at timestamptz,
  unique (id, organization_id),
  foreign key (customer_id, organization_id) references public.customers (id, organization_id) on delete restrict,
  foreign key (asset_id, organization_id) references public.assets (id, organization_id) on delete restrict,
  foreign key (pipeline_id, organization_id) references public.sales_pipelines (id, organization_id) on delete restrict,
  foreign key (stage_id, organization_id) references public.pipeline_stages (id, organization_id) on delete restrict
);

create table public.opportunity_stage_history (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations (id) on delete cascade,
  opportunity_id bigint not null,
  from_stage_id bigint,
  to_stage_id bigint not null,
  changed_by uuid default auth.uid() references auth.users (id) on delete set null,
  changed_at timestamptz not null default now(),
  note text,
  foreign key (opportunity_id, organization_id) references public.sales_opportunities (id, organization_id) on delete cascade,
  foreign key (from_stage_id, organization_id) references public.pipeline_stages (id, organization_id) on delete restrict,
  foreign key (to_stage_id, organization_id) references public.pipeline_stages (id, organization_id) on delete restrict
);

create table public.quotes (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations (id) on delete cascade,
  opportunity_id bigint,
  customer_id bigint not null,
  asset_id bigint,
  quote_number bigint generated always as identity unique,
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'sent', 'negotiation', 'approved', 'rejected', 'expired', 'cancelled')),
  service_mode text not null check (service_mode in ('workshop', 'field', 'parts')),
  title text not null check (char_length(trim(title)) between 3 and 220),
  notes text,
  currency_code text not null default 'MXN' check (currency_code ~ '^[A-Z]{3}$'),
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  tax_total numeric(14, 2) not null default 0 check (tax_total >= 0),
  total_amount numeric(14, 2) not null default 0 check (total_amount >= 0),
  estimated_cost numeric(14, 2) not null default 0 check (estimated_cost >= 0),
  estimated_margin_percent numeric(6, 2) generated always as (
    case when total_amount > 0
      then round(((total_amount - estimated_cost) / total_amount) * 100, 2)
      else null
    end
  ) stored,
  valid_until date,
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  archived_at timestamptz,
  unique (id, organization_id),
  foreign key (opportunity_id, organization_id) references public.sales_opportunities (id, organization_id) on delete restrict,
  foreign key (customer_id, organization_id) references public.customers (id, organization_id) on delete restrict,
  foreign key (asset_id, organization_id) references public.assets (id, organization_id) on delete restrict
);

create table public.quote_lines (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations (id) on delete cascade,
  quote_id bigint not null,
  position smallint not null check (position > 0),
  line_type text not null default 'service' check (line_type in ('service', 'material', 'labor', 'expense', 'discount')),
  description text not null check (char_length(trim(description)) between 2 and 500),
  quantity numeric(14, 4) not null default 1 check (quantity >= 0),
  unit_code text not null default 'EA' check (unit_code ~ '^[A-Z]{2,8}$'),
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  discount_percent numeric(5, 2) not null default 0 check (discount_percent between 0 and 100),
  tax_percent numeric(5, 2) not null default 0 check (tax_percent between 0 and 100),
  line_subtotal numeric(14, 2) generated always as (round(quantity * unit_price * (1 - discount_percent / 100), 2)) stored,
  line_tax_total numeric(14, 2) generated always as (round(quantity * unit_price * (1 - discount_percent / 100) * tax_percent / 100, 2)) stored,
  line_total numeric(14, 2) generated always as (round(quantity * unit_price * (1 - discount_percent / 100) * (1 + tax_percent / 100), 2)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (quote_id, organization_id) references public.quotes (id, organization_id) on delete cascade,
  unique (quote_id, position)
);

create table public.quote_status_history (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations (id) on delete cascade,
  quote_id bigint not null,
  from_status text,
  to_status text not null check (to_status in ('draft', 'pending_approval', 'sent', 'negotiation', 'approved', 'rejected', 'expired', 'cancelled')),
  changed_by uuid default auth.uid() references auth.users (id) on delete set null,
  changed_at timestamptz not null default now(),
  note text,
  foreign key (quote_id, organization_id) references public.quotes (id, organization_id) on delete cascade
);

create table public.activity_events (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations (id) on delete cascade,
  entity_type text not null check (entity_type in ('customer', 'asset', 'opportunity', 'quote')),
  entity_id bigint not null,
  event_type text not null check (char_length(trim(event_type)) between 2 and 100),
  summary text not null check (char_length(trim(summary)) between 2 and 500),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  actor_id uuid default auth.uid() references auth.users (id) on delete set null,
  occurred_at timestamptz not null default now()
);

create index organization_members_user_id_idx on public.organization_members (user_id);
create index organization_members_org_role_idx on public.organization_members (organization_id, role) where status = 'active';
create index organization_member_module_permissions_org_member_idx on public.organization_member_module_permissions (organization_id, organization_member_id);
create index organization_member_module_permissions_module_idx on public.organization_member_module_permissions (organization_id, module_key, access_level);
create index sales_pipelines_organization_id_idx on public.sales_pipelines (organization_id) where archived_at is null;
create unique index sales_pipelines_one_default_idx on public.sales_pipelines (organization_id) where is_default and archived_at is null;
create index pipeline_stages_organization_id_idx on public.pipeline_stages (organization_id, pipeline_id, position);
create index customers_organization_name_idx on public.customers (organization_id, display_name) where archived_at is null;
create unique index customers_account_code_idx on public.customers (organization_id, account_code) where account_code is not null and archived_at is null;
create index customer_contacts_customer_id_idx on public.customer_contacts (customer_id) where archived_at is null;
create index assets_customer_id_idx on public.assets (customer_id) where archived_at is null;
create unique index assets_serial_number_idx on public.assets (organization_id, serial_number) where serial_number is not null and archived_at is null;
create index sales_opportunities_customer_id_idx on public.sales_opportunities (customer_id);
create index sales_opportunities_asset_id_idx on public.sales_opportunities (asset_id) where asset_id is not null;
create index sales_opportunities_pipeline_stage_idx on public.sales_opportunities (organization_id, pipeline_id, stage_id, updated_at desc) where archived_at is null;
create index sales_opportunities_owner_id_idx on public.sales_opportunities (owner_id) where owner_id is not null and archived_at is null;
create index opportunity_stage_history_opportunity_id_idx on public.opportunity_stage_history (opportunity_id, changed_at desc);
create index quotes_customer_id_idx on public.quotes (customer_id);
create index quotes_opportunity_id_idx on public.quotes (opportunity_id) where opportunity_id is not null;
create index quotes_organization_status_idx on public.quotes (organization_id, status, updated_at desc) where archived_at is null;
create index quote_lines_quote_id_idx on public.quote_lines (quote_id, position);
create index quote_status_history_quote_id_idx on public.quote_status_history (quote_id, changed_at desc);
create index activity_events_entity_idx on public.activity_events (organization_id, entity_type, entity_id, occurred_at desc);

create function private.has_organization_access(p_organization_id bigint)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = p_organization_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
  );
$$;

create function private.can_manage_organization(p_organization_id bigint)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = p_organization_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
      and member.role in ('owner', 'admin')
  );
$$;

create function private.has_module_access(
  p_organization_id bigint,
  p_module_key text,
  p_minimum_level text default 'read'
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = p_organization_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
      and (
        member.role in ('owner', 'admin')
        or exists (
          select 1
          from public.organization_member_module_permissions permission
          where permission.organization_member_id = member.id
            and permission.organization_id = p_organization_id
            and permission.module_key = p_module_key
            and (
              permission.access_level = 'admin'
              or (p_minimum_level = 'read' and permission.access_level in ('read', 'write'))
              or (p_minimum_level = 'write' and permission.access_level = 'write')
            )
        )
      )
  );
$$;

revoke all on function private.has_organization_access(bigint) from public, anon;
revoke all on function private.can_manage_organization(bigint) from public, anon;
revoke all on function private.has_module_access(bigint, text, text) from public, anon;
grant execute on function private.has_organization_access(bigint) to authenticated;
grant execute on function private.can_manage_organization(bigint) to authenticated;
grant execute on function private.has_module_access(bigint, text, text) to authenticated;

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function private.touch_audited_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = (select auth.uid());
  return new;
end;
$$;

create function private.refresh_quote_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote_id bigint := coalesce(new.quote_id, old.quote_id);
begin
  update public.quotes quote
  set subtotal = coalesce((
        select sum(line.line_subtotal)
        from public.quote_lines line
        where line.quote_id = v_quote_id
      ), 0),
      tax_total = coalesce((
        select sum(line.line_tax_total)
        from public.quote_lines line
        where line.quote_id = v_quote_id
      ), 0),
      total_amount = coalesce((
        select sum(line.line_total)
        from public.quote_lines line
        where line.quote_id = v_quote_id
      ), 0),
      updated_at = now(),
      updated_by = (select auth.uid())
  where quote.id = v_quote_id;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create function private.seed_sales_pipeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pipeline_id bigint;
begin
  insert into public.sales_pipelines (organization_id, name, is_default)
  values (new.id, 'Pipeline comercial', true)
  returning id into v_pipeline_id;

  insert into public.pipeline_stages (organization_id, pipeline_id, stage_key, name, position, probability_percent, is_closed, outcome)
  values
    (new.id, v_pipeline_id, 'new', 'Nueva oportunidad', 10, 10, false, null),
    (new.id, v_pipeline_id, 'diagnosis', 'Diagnóstico', 20, 25, false, null),
    (new.id, v_pipeline_id, 'quoted', 'Oferta enviada', 30, 60, false, null),
    (new.id, v_pipeline_id, 'negotiation', 'Negociación', 40, 75, false, null),
    (new.id, v_pipeline_id, 'won', 'Ganada', 50, 100, true, 'won'),
    (new.id, v_pipeline_id, 'lost', 'Perdida', 60, 0, true, 'lost');

  return new;
end;
$$;

create function private.seed_member_module_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role in ('owner', 'admin') then
    insert into public.organization_member_module_permissions (
      organization_id,
      organization_member_id,
      module_key,
      access_level
    )
    select new.organization_id, new.id, module_key, 'admin'
    from (values
      ('sales'), ('purchases'), ('orders'), ('quality'), ('agent_ai'),
      ('warehouse'), ('resources'), ('planning'), ('engineering')
    ) as modules(module_key)
    on conflict (organization_member_id, module_key) do nothing;
  end if;

  return new;
end;
$$;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create function public.create_organization(p_name text, p_slug text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id bigint;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  insert into public.organizations (name, slug)
  values (trim(p_name), lower(trim(p_slug)))
  returning id into v_organization_id;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_organization_id, v_user_id, 'owner', 'active');

  return v_organization_id;
end;
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;
revoke all on function private.touch_audited_updated_at() from public, anon, authenticated;
revoke all on function private.refresh_quote_totals() from public, anon, authenticated;
revoke all on function private.seed_sales_pipeline() from public, anon, authenticated;
revoke all on function private.seed_member_module_permissions() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;

insert into public.profiles (id, display_name)
select
  user_record.id,
  coalesce(nullif(trim(user_record.raw_user_meta_data ->> 'full_name'), ''), split_part(user_record.email, '@', 1))
from auth.users user_record
on conflict (id) do nothing;

create trigger set_organizations_updated_at
before update on public.organizations
for each row execute function private.touch_updated_at();
create trigger set_organization_members_updated_at
before update on public.organization_members
for each row execute function private.touch_updated_at();
create trigger set_organization_member_module_permissions_updated_at
before update on public.organization_member_module_permissions
for each row execute function private.touch_updated_at();
create trigger set_sales_pipelines_updated_at
before update on public.sales_pipelines
for each row execute function private.touch_updated_at();
create trigger set_pipeline_stages_updated_at
before update on public.pipeline_stages
for each row execute function private.touch_updated_at();
create trigger set_customers_updated_at
before update on public.customers
for each row execute function private.touch_updated_at();
create trigger set_customer_contacts_updated_at
before update on public.customer_contacts
for each row execute function private.touch_updated_at();
create trigger set_assets_updated_at
before update on public.assets
for each row execute function private.touch_updated_at();
create trigger set_sales_opportunities_updated_at
before update on public.sales_opportunities
for each row execute function private.touch_audited_updated_at();
create trigger set_quotes_updated_at
before update on public.quotes
for each row execute function private.touch_audited_updated_at();
create trigger set_quote_lines_updated_at
before update on public.quote_lines
for each row execute function private.touch_updated_at();
create trigger refresh_quote_totals_after_line_change
after insert or update or delete on public.quote_lines
for each row execute function private.refresh_quote_totals();
create trigger create_default_sales_pipeline
after insert on public.organizations
for each row execute function private.seed_sales_pipeline();
create trigger seed_organization_member_module_permissions
after insert on public.organization_members
for each row execute function private.seed_member_module_permissions();
create trigger create_profile_for_auth_user
after insert on auth.users
for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_member_module_permissions enable row level security;
alter table public.sales_pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.assets enable row level security;
alter table public.sales_opportunities enable row level security;
alter table public.opportunity_stage_history enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_lines enable row level security;
alter table public.quote_status_history enable row level security;
alter table public.activity_events enable row level security;

revoke all on table public.profiles, public.organizations, public.organization_members, public.organization_member_module_permissions,
  public.sales_pipelines, public.pipeline_stages, public.customers, public.customer_contacts,
  public.assets, public.sales_opportunities, public.opportunity_stage_history, public.quotes,
  public.quote_lines, public.quote_status_history, public.activity_events from anon;
grant select, insert, update, delete on table public.profiles, public.organizations, public.organization_members, public.organization_member_module_permissions,
  public.sales_pipelines, public.pipeline_stages, public.customers, public.customer_contacts,
  public.assets, public.sales_opportunities, public.opportunity_stage_history, public.quotes,
  public.quote_lines, public.quote_status_history, public.activity_events to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy "profiles_select_self" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "organizations_select_member" on public.organizations for select to authenticated
  using ((select private.has_organization_access(id)));
create policy "organizations_update_manager" on public.organizations for update to authenticated
  using ((select private.can_manage_organization(id))) with check ((select private.can_manage_organization(id)));

create policy "organization_members_select_member" on public.organization_members for select to authenticated
  using ((select private.has_organization_access(organization_id)));
create policy "organization_members_insert_manager" on public.organization_members for insert to authenticated
  with check ((select private.can_manage_organization(organization_id)));
create policy "organization_members_update_manager" on public.organization_members for update to authenticated
  using ((select private.can_manage_organization(organization_id))) with check ((select private.can_manage_organization(organization_id)));
create policy "organization_members_delete_manager" on public.organization_members for delete to authenticated
  using ((select private.can_manage_organization(organization_id)));

create policy "member_permissions_select_member" on public.organization_member_module_permissions for select to authenticated
  using ((select private.has_organization_access(organization_id)));
create policy "member_permissions_insert_manager" on public.organization_member_module_permissions for insert to authenticated
  with check ((select private.can_manage_organization(organization_id)));
create policy "member_permissions_update_manager" on public.organization_member_module_permissions for update to authenticated
  using ((select private.can_manage_organization(organization_id))) with check ((select private.can_manage_organization(organization_id)));
create policy "member_permissions_delete_manager" on public.organization_member_module_permissions for delete to authenticated
  using ((select private.can_manage_organization(organization_id)));

create policy "sales_pipelines_select_member" on public.sales_pipelines for select to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'read')));
create policy "sales_pipelines_insert_manager" on public.sales_pipelines for insert to authenticated
  with check ((select private.has_module_access(organization_id, 'sales', 'admin')));
create policy "sales_pipelines_update_manager" on public.sales_pipelines for update to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'admin'))) with check ((select private.has_module_access(organization_id, 'sales', 'admin')));
create policy "sales_pipelines_delete_manager" on public.sales_pipelines for delete to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'admin')));

create policy "pipeline_stages_select_member" on public.pipeline_stages for select to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'read')));
create policy "pipeline_stages_insert_manager" on public.pipeline_stages for insert to authenticated
  with check ((select private.has_module_access(organization_id, 'sales', 'admin')));
create policy "pipeline_stages_update_manager" on public.pipeline_stages for update to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'admin'))) with check ((select private.has_module_access(organization_id, 'sales', 'admin')));
create policy "pipeline_stages_delete_manager" on public.pipeline_stages for delete to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'admin')));

create policy "customers_select_member" on public.customers for select to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'read')));
create policy "customers_insert_sales" on public.customers for insert to authenticated
  with check ((select private.has_module_access(organization_id, 'sales', 'write')));
create policy "customers_update_sales" on public.customers for update to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'write'))) with check ((select private.has_module_access(organization_id, 'sales', 'write')));
create policy "customers_delete_manager" on public.customers for delete to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'admin')));

create policy "customer_contacts_select_member" on public.customer_contacts for select to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'read')));
create policy "customer_contacts_insert_sales" on public.customer_contacts for insert to authenticated
  with check ((select private.has_module_access(organization_id, 'sales', 'write')));
create policy "customer_contacts_update_sales" on public.customer_contacts for update to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'write'))) with check ((select private.has_module_access(organization_id, 'sales', 'write')));
create policy "customer_contacts_delete_manager" on public.customer_contacts for delete to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'admin')));

create policy "assets_select_member" on public.assets for select to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'read')));
create policy "assets_insert_sales" on public.assets for insert to authenticated
  with check ((select private.has_module_access(organization_id, 'sales', 'write')));
create policy "assets_update_sales" on public.assets for update to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'write'))) with check ((select private.has_module_access(organization_id, 'sales', 'write')));
create policy "assets_delete_manager" on public.assets for delete to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'admin')));

create policy "opportunities_select_member" on public.sales_opportunities for select to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'read')));
create policy "opportunities_insert_sales" on public.sales_opportunities for insert to authenticated
  with check ((select private.has_module_access(organization_id, 'sales', 'write')));
create policy "opportunities_update_sales" on public.sales_opportunities for update to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'write'))) with check ((select private.has_module_access(organization_id, 'sales', 'write')));
create policy "opportunities_delete_manager" on public.sales_opportunities for delete to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'admin')));

create policy "opportunity_history_select_member" on public.opportunity_stage_history for select to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'read')));
create policy "opportunity_history_insert_sales" on public.opportunity_stage_history for insert to authenticated
  with check ((select private.has_module_access(organization_id, 'sales', 'write')));

create policy "quotes_select_member" on public.quotes for select to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'read')));
create policy "quotes_insert_sales" on public.quotes for insert to authenticated
  with check ((select private.has_module_access(organization_id, 'sales', 'write')));
create policy "quotes_update_sales" on public.quotes for update to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'write'))) with check ((select private.has_module_access(organization_id, 'sales', 'write')));
create policy "quotes_delete_manager" on public.quotes for delete to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'admin')));

create policy "quote_lines_select_member" on public.quote_lines for select to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'read')));
create policy "quote_lines_insert_sales" on public.quote_lines for insert to authenticated
  with check ((select private.has_module_access(organization_id, 'sales', 'write')));
create policy "quote_lines_update_sales" on public.quote_lines for update to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'write'))) with check ((select private.has_module_access(organization_id, 'sales', 'write')));
create policy "quote_lines_delete_sales" on public.quote_lines for delete to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'admin')));

create policy "quote_history_select_member" on public.quote_status_history for select to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'read')));
create policy "quote_history_insert_sales" on public.quote_status_history for insert to authenticated
  with check ((select private.has_module_access(organization_id, 'sales', 'write')));

create policy "activity_events_select_member" on public.activity_events for select to authenticated
  using ((select private.has_module_access(organization_id, 'sales', 'read')));
create policy "activity_events_insert_sales" on public.activity_events for insert to authenticated
  with check ((select private.has_module_access(organization_id, 'sales', 'write')));

commit;
