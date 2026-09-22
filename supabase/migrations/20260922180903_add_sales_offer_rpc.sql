begin;

create function public.create_sales_offer(
  p_organization_id bigint,
  p_customer_id bigint,
  p_title text,
  p_service_mode text,
  p_currency_code text,
  p_subtotal numeric,
  p_total_amount numeric,
  p_valid_until date default null,
  p_notes text default null
)
returns table (quote_id bigint, quote_number bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pipeline_id bigint;
  v_stage_id bigint;
  v_opportunity_id bigint;
  v_quote_id bigint;
  v_quote_number bigint;
  v_tax_percent numeric(5, 2);
begin
  if not (select private.has_module_access(p_organization_id, 'sales', 'write')) then
    raise exception 'Sales write access is required';
  end if;

  if p_title is null or char_length(trim(p_title)) < 3 then
    raise exception 'Offer title must contain at least 3 characters';
  end if;
  if p_service_mode not in ('workshop', 'field', 'parts') then
    raise exception 'Unsupported service mode';
  end if;
  if p_currency_code !~ '^[A-Z]{3}$' then
    raise exception 'Currency code must use ISO 4217 format';
  end if;
  if p_subtotal < 0 or p_total_amount < p_subtotal then
    raise exception 'Offer totals are invalid';
  end if;

  perform 1
  from public.customers customer
  where customer.id = p_customer_id
    and customer.organization_id = p_organization_id
    and customer.archived_at is null;
  if not found then
    raise exception 'Customer is not active in this organization';
  end if;

  select pipeline.id into v_pipeline_id
  from public.sales_pipelines pipeline
  where pipeline.organization_id = p_organization_id
    and pipeline.is_default
    and pipeline.archived_at is null;
  if v_pipeline_id is null then
    raise exception 'Default sales pipeline is missing';
  end if;

  select stage.id into v_stage_id
  from public.pipeline_stages stage
  where stage.organization_id = p_organization_id
    and stage.pipeline_id = v_pipeline_id
    and stage.stage_key = 'new';
  if v_stage_id is null then
    raise exception 'Initial sales stage is missing';
  end if;

  insert into public.sales_opportunities (
    organization_id, customer_id, pipeline_id, stage_id, title, service_mode,
    estimated_revenue, estimated_cost, owner_id
  ) values (
    p_organization_id, p_customer_id, v_pipeline_id, v_stage_id, trim(p_title), p_service_mode,
    p_total_amount, 0, (select auth.uid())
  ) returning id into v_opportunity_id;

  insert into public.quotes (
    organization_id, opportunity_id, customer_id, title, notes, service_mode,
    currency_code, estimated_cost, valid_until, status
  ) values (
    p_organization_id, v_opportunity_id, p_customer_id, trim(p_title), nullif(trim(p_notes), ''), p_service_mode,
    p_currency_code, 0, p_valid_until, 'draft'
  ) returning id, public.quotes.quote_number into v_quote_id, v_quote_number;

  v_tax_percent := case when p_subtotal > 0
    then round(((p_total_amount / p_subtotal) - 1) * 100, 2)
    else 0
  end;

  insert into public.quote_lines (
    organization_id, quote_id, position, line_type, description, quantity, unit_price, tax_percent
  ) values (
    p_organization_id, v_quote_id, 1, 'service', trim(p_title), 1, p_subtotal, v_tax_percent
  );

  insert into public.opportunity_stage_history (organization_id, opportunity_id, to_stage_id, note)
  values (p_organization_id, v_opportunity_id, v_stage_id, 'Opportunity created from sales intake.');
  insert into public.quote_status_history (organization_id, quote_id, to_status, note)
  values (p_organization_id, v_quote_id, 'draft', 'Quote created.');
  insert into public.activity_events (organization_id, entity_type, entity_id, event_type, summary)
  values (p_organization_id, 'quote', v_quote_id, 'quote_created', format('Quote Q-%s created.', v_quote_number));

  return query select v_quote_id, v_quote_number;
end;
$$;

revoke all on function public.create_sales_offer(bigint, bigint, text, text, text, numeric, numeric, date, text) from public, anon;
grant execute on function public.create_sales_offer(bigint, bigint, text, text, text, numeric, numeric, date, text) to authenticated;

commit;
