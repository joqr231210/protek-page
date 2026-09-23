begin;

alter table public.pipeline_stages
  add column color_code text not null default '#8B8B91'
    check (color_code ~ '^#[0-9A-Fa-f]{6}$');

update public.pipeline_stages
set color_code = case stage_key
  when 'new' then '#EF5B50'
  when 'diagnosis' then '#D8943E'
  when 'quoted' then '#668CB8'
  when 'negotiation' then '#9277AE'
  when 'won' then '#639A75'
  when 'lost' then '#888890'
  else '#8B8B91'
end;

create or replace function private.seed_sales_pipeline()
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

  insert into public.pipeline_stages
    (organization_id, pipeline_id, stage_key, name, position, probability_percent, is_closed, outcome, color_code)
  values
    (new.id, v_pipeline_id, 'new', 'Nueva oportunidad', 10, 10, false, null, '#EF5B50'),
    (new.id, v_pipeline_id, 'diagnosis', 'Diagnóstico', 20, 25, false, null, '#D8943E'),
    (new.id, v_pipeline_id, 'quoted', 'Oferta enviada', 30, 60, false, null, '#668CB8'),
    (new.id, v_pipeline_id, 'negotiation', 'Negociación', 40, 75, false, null, '#9277AE'),
    (new.id, v_pipeline_id, 'won', 'Ganada', 50, 100, true, 'won', '#639A75'),
    (new.id, v_pipeline_id, 'lost', 'Perdida', 60, 0, true, 'lost', '#888890');
  return new;
end;
$$;

create function public.manage_sales_offer(
  p_organization_id bigint,
  p_quote_id bigint,
  p_action text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quote public.quotes%rowtype;
begin
  if p_action not in ('archive', 'restore', 'delete') then
    raise exception 'Unsupported offer action';
  end if;
  if not (select private.has_module_access(p_organization_id, 'sales',
    case when p_action = 'delete' then 'admin' else 'write' end)) then
    raise exception 'Sales permission is required for this action';
  end if;

  select * into v_quote from public.quotes quote
  where quote.id = p_quote_id and quote.organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'Offer is not available in this organization';
  end if;

  if p_action = 'archive' then
    if v_quote.archived_at is not null then return; end if;
    update public.quotes set archived_at = now()
    where id = p_quote_id and organization_id = p_organization_id;
    if v_quote.opportunity_id is not null and not exists (
      select 1 from public.quotes quote
      where quote.opportunity_id = v_quote.opportunity_id
        and quote.organization_id = p_organization_id and quote.archived_at is null
    ) then
      update public.sales_opportunities set archived_at = now()
      where id = v_quote.opportunity_id and organization_id = p_organization_id;
    end if;
    insert into public.activity_events (organization_id, entity_type, entity_id, event_type, summary)
    values (p_organization_id, 'quote', p_quote_id, 'quote_archived', format('Offer Q-%s archived.', v_quote.quote_number));
  elsif p_action = 'restore' then
    if v_quote.archived_at is null then return; end if;
    update public.quotes set archived_at = null
    where id = p_quote_id and organization_id = p_organization_id;
    if v_quote.opportunity_id is not null then
      update public.sales_opportunities set archived_at = null
      where id = v_quote.opportunity_id and organization_id = p_organization_id;
    end if;
    insert into public.activity_events (organization_id, entity_type, entity_id, event_type, summary)
    values (p_organization_id, 'quote', p_quote_id, 'quote_restored', format('Offer Q-%s restored.', v_quote.quote_number));
  else
    delete from public.quote_lines
    where quote_id = p_quote_id and organization_id = p_organization_id;
    delete from public.quotes
    where id = p_quote_id and organization_id = p_organization_id;
    if v_quote.opportunity_id is not null and not exists (
      select 1 from public.quotes quote
      where quote.opportunity_id = v_quote.opportunity_id
        and quote.organization_id = p_organization_id
    ) then
      delete from public.sales_opportunities
      where id = v_quote.opportunity_id and organization_id = p_organization_id;
    end if;
    insert into public.activity_events (organization_id, entity_type, entity_id, event_type, summary)
    values (p_organization_id, 'quote', p_quote_id, 'quote_deleted', format('Offer Q-%s deleted.', v_quote.quote_number));
  end if;
end;
$$;

revoke all on function public.manage_sales_offer(bigint, bigint, text) from public, anon;
grant execute on function public.manage_sales_offer(bigint, bigint, text) to authenticated;

commit;
