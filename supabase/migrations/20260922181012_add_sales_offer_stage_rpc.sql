begin;

create function public.move_sales_offer_stage(
  p_organization_id bigint,
  p_quote_id bigint,
  p_stage_id bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_opportunity_id bigint;
  v_previous_stage_id bigint;
  v_stage_key text;
  v_stage_name text;
  v_is_closed boolean;
  v_quote_status text;
begin
  if not (select private.has_module_access(p_organization_id, 'sales', 'write')) then
    raise exception 'Sales write access is required';
  end if;

  select quote.opportunity_id into v_opportunity_id
  from public.quotes quote
  where quote.id = p_quote_id
    and quote.organization_id = p_organization_id
    and quote.archived_at is null;
  if v_opportunity_id is null then
    raise exception 'Offer does not belong to this organization';
  end if;

  select stage.stage_key, stage.name, stage.is_closed into v_stage_key, v_stage_name, v_is_closed
  from public.pipeline_stages stage
  where stage.id = p_stage_id
    and stage.organization_id = p_organization_id;
  if v_stage_key is null then
    raise exception 'Sales stage does not belong to this organization';
  end if;

  select opportunity.stage_id into v_previous_stage_id
  from public.sales_opportunities opportunity
  where opportunity.id = v_opportunity_id
    and opportunity.organization_id = p_organization_id;

  v_quote_status := case v_stage_key
    when 'new' then 'draft'
    when 'diagnosis' then 'pending_approval'
    when 'quoted' then 'sent'
    when 'negotiation' then 'negotiation'
    when 'won' then 'approved'
    when 'lost' then 'rejected'
    else 'draft'
  end;

  update public.sales_opportunities
  set stage_id = p_stage_id,
      closed_at = case when v_is_closed then now() else null end
  where id = v_opportunity_id
    and organization_id = p_organization_id;

  update public.quotes
  set status = v_quote_status
  where id = p_quote_id
    and organization_id = p_organization_id;

  insert into public.opportunity_stage_history (organization_id, opportunity_id, from_stage_id, to_stage_id, note)
  values (p_organization_id, v_opportunity_id, v_previous_stage_id, p_stage_id, format('Moved to %s.', v_stage_name));
  insert into public.quote_status_history (organization_id, quote_id, to_status, note)
  values (p_organization_id, p_quote_id, v_quote_status, format('Stage moved to %s.', v_stage_name));
  insert into public.activity_events (organization_id, entity_type, entity_id, event_type, summary)
  values (p_organization_id, 'quote', p_quote_id, 'quote_stage_changed', format('Offer moved to %s.', v_stage_name));
end;
$$;

revoke all on function public.move_sales_offer_stage(bigint, bigint, bigint) from public, anon;
grant execute on function public.move_sales_offer_stage(bigint, bigint, bigint) to authenticated;

commit;
