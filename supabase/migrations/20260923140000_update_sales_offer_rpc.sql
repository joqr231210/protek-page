begin;

create function public.update_sales_offer(
  p_organization_id bigint,
  p_quote_id bigint,
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
  v_quote public.quotes%rowtype;
  v_line_id bigint;
  v_line_count integer;
  v_tax_percent numeric(5, 2);
  v_actual_total numeric(14, 2);
begin
  if not (select private.has_module_access(p_organization_id, 'sales', 'write')) then
    raise exception 'Sales write access is required';
  end if;
  if p_title is null or char_length(trim(p_title)) not between 3 and 220 then
    raise exception 'Offer title must contain between 3 and 220 characters';
  end if;
  if p_service_mode not in ('workshop', 'field', 'parts') then
    raise exception 'Unsupported service mode';
  end if;
  if p_currency_code !~ '^[A-Z]{3}$' then
    raise exception 'Currency code must use ISO 4217 format';
  end if;
  if p_subtotal is null or p_total_amount is null or p_subtotal < 0
    or p_total_amount < p_subtotal or p_total_amount > 999999999999.99
    or (p_subtotal = 0 and p_total_amount > 0)
    or (p_subtotal > 0 and p_total_amount > p_subtotal * 2) then
    raise exception 'Offer totals are invalid';
  end if;

  select * into v_quote from public.quotes quote
  where quote.id = p_quote_id and quote.organization_id = p_organization_id
    and quote.archived_at is null for update;
  if not found or v_quote.opportunity_id is null then
    raise exception 'Offer is not available in this organization';
  end if;
  perform 1 from public.customers customer
  where customer.id = p_customer_id and customer.organization_id = p_organization_id
    and customer.archived_at is null;
  if not found then
    raise exception 'Customer is not active in this organization';
  end if;

  select count(*), min(line.id) into v_line_count, v_line_id
  from public.quote_lines line
  where line.quote_id = p_quote_id and line.organization_id = p_organization_id;
  if v_line_count <> 1 then
    raise exception 'Only single-line sales offers can be edited here';
  end if;
  v_tax_percent := case when p_subtotal > 0
    then round(((p_total_amount / p_subtotal) - 1) * 100, 2)
    else 0 end;

  update public.quotes quote set customer_id = p_customer_id, title = trim(p_title),
    notes = nullif(trim(p_notes), ''), service_mode = p_service_mode,
    currency_code = p_currency_code, valid_until = p_valid_until
  where quote.id = p_quote_id and quote.organization_id = p_organization_id;

  update public.quote_lines line set description = trim(p_title),
    unit_price = p_subtotal, tax_percent = v_tax_percent
  where line.id = v_line_id and line.organization_id = p_organization_id;

  select quote.total_amount into v_actual_total
  from public.quotes quote where quote.id = p_quote_id;
  update public.sales_opportunities opportunity set customer_id = p_customer_id,
    title = trim(p_title), service_mode = p_service_mode,
    estimated_revenue = v_actual_total
  where opportunity.id = v_quote.opportunity_id
    and opportunity.organization_id = p_organization_id;
  if not found then
    raise exception 'Linked opportunity is not available';
  end if;

  insert into public.activity_events (organization_id, entity_type, entity_id, event_type, summary)
  values (p_organization_id, 'quote', p_quote_id, 'quote_updated',
    format('Quote Q-%s updated.', v_quote.quote_number));
  return query select v_quote.id, v_quote.quote_number;
end;
$$;

revoke all on function public.update_sales_offer(bigint, bigint, bigint, text, text, text, numeric, numeric, date, text) from public, anon;
grant execute on function public.update_sales_offer(bigint, bigint, bigint, text, text, text, numeric, numeric, date, text) to authenticated;

commit;
