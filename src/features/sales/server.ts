import type { SupabaseClient } from "@supabase/supabase-js";
import type { Customer, Opportunity, Quote, SalesOverview, Stage } from "./types";

type DatabaseRow = Record<string, unknown>;

function asNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function getSalesOverview(supabase: SupabaseClient, requestedOrganizationId?: number): Promise<SalesOverview | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, organizations(name)")
    .eq("user_id", authData.user.id)
    .eq("status", "active")
    .order("organization_id");

  if (membershipError || !memberships?.length) return null;

  const organizations = (memberships as DatabaseRow[]).map((membership) => {
    const organization = Array.isArray(membership.organizations)
      ? membership.organizations[0]
      : membership.organizations;
    return {
      id: asNumber(membership.organization_id),
      name: organization && typeof organization === "object" && "name" in organization
        ? asString(organization.name)
        : "Empresa sin nombre",
    };
  });
  const selectedOrganization = requestedOrganizationId
    ? organizations.find((organization) => organization.id === requestedOrganizationId)
    : organizations[0];
  if (!selectedOrganization) return null;

  const organizationId = selectedOrganization.id;
  const organizationName = selectedOrganization.name;

  const [stagesResult, customersResult, opportunitiesResult, quotesResult] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, stage_key, name, position, probability_percent, is_closed, outcome")
      .eq("organization_id", organizationId)
      .order("position"),
    supabase
      .from("customers")
      .select("id, display_name, legal_name, tax_id, account_code, status")
      .eq("organization_id", organizationId)
      .is("archived_at", null),
    supabase
      .from("sales_opportunities")
      .select("id, customer_id, title, service_mode, estimated_revenue, stage_id, expected_close_at")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false }),
    supabase
      .from("quotes")
      .select("id, quote_number, customer_id, opportunity_id, title, notes, service_mode, currency_code, total_amount, estimated_margin_percent, status, updated_at, valid_until")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false }),
  ]);

  if (stagesResult.error || customersResult.error || opportunitiesResult.error || quotesResult.error) {
    return null;
  }

  const stages: Stage[] = (stagesResult.data as DatabaseRow[]).map((row) => ({
    id: asNumber(row.id),
    key: asString(row.stage_key),
    name: asString(row.name),
    position: asNumber(row.position),
    probability: asNumber(row.probability_percent),
    isClosed: Boolean(row.is_closed),
    outcome: row.outcome === "won" || row.outcome === "lost" ? row.outcome : null,
  }));
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const customers: Customer[] = (customersResult.data as DatabaseRow[]).map((row) => ({
    id: asNumber(row.id),
    displayName: asString(row.display_name),
    legalName: typeof row.legal_name === "string" ? row.legal_name : null,
    taxId: typeof row.tax_id === "string" ? row.tax_id : null,
    accountCode: typeof row.account_code === "string" ? row.account_code : null,
    status: row.status === "active" || row.status === "inactive" || row.status === "prospect" ? row.status : "prospect",
  }));
  const customerNameById = new Map(customers.map((customer) => [customer.id, customer.displayName]));
  const opportunities: Opportunity[] = (opportunitiesResult.data as DatabaseRow[]).map((row) => {
    const stage = stageById.get(asNumber(row.stage_id));
    return {
      id: asNumber(row.id),
      customerName: customerNameById.get(asNumber(row.customer_id)) ?? "Cliente sin nombre",
      title: asString(row.title),
      serviceMode: asString(row.service_mode) as Opportunity["serviceMode"],
      estimatedRevenue: asNumber(row.estimated_revenue),
      stageId: asNumber(row.stage_id),
      stageKey: stage?.key ?? "new",
      stageName: stage?.name ?? "Sin etapa",
      expectedCloseAt: typeof row.expected_close_at === "string" ? row.expected_close_at : null,
    };
  });
  const opportunityById = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));
  const quotes: Quote[] = (quotesResult.data as DatabaseRow[]).map((row) => {
    const opportunity = opportunityById.get(asNumber(row.opportunity_id));
    return {
      id: asNumber(row.id),
      quoteNumber: asNumber(row.quote_number),
      customerId: asNumber(row.customer_id),
      customerName: customerNameById.get(asNumber(row.customer_id)) ?? "Cliente sin nombre",
      title: asString(row.title),
      notes: typeof row.notes === "string" ? row.notes : null,
      serviceMode: asString(row.service_mode) as Quote["serviceMode"],
      currencyCode: row.currency_code === "USD" || row.currency_code === "EUR" ? row.currency_code : "MXN",
      totalAmount: asNumber(row.total_amount),
      estimatedMarginPercent: row.estimated_margin_percent === null ? null : asNumber(row.estimated_margin_percent),
      status: asString(row.status),
      stageKey: opportunity?.stageKey ?? "new",
      stageName: opportunity?.stageName ?? "Borrador",
      updatedAt: asString(row.updated_at),
      validUntil: typeof row.valid_until === "string" ? row.valid_until : null,
    };
  });

  return { organizationId, organizationName, organizations, isDemo: false, customers, stages, quotes, opportunities };
}

export async function getSalesContext(supabase: SupabaseClient, requestedOrganizationId?: number) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  let membershipQuery = supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", authData.user.id)
    .eq("status", "active");
  if (requestedOrganizationId) membershipQuery = membershipQuery.eq("organization_id", requestedOrganizationId);

  const { data: membership } = await membershipQuery.limit(1).maybeSingle();

  return membership ? { organizationId: asNumber(membership.organization_id), userId: authData.user.id } : null;
}
