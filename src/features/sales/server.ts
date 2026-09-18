import type { SupabaseClient } from "@supabase/supabase-js";
import type { Opportunity, Quote, SalesOverview, Stage } from "./types";

type DatabaseRow = Record<string, unknown>;

function asNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function getSalesOverview(supabase: SupabaseClient): Promise<SalesOverview | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, organizations(name)")
    .eq("user_id", authData.user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) return null;

  const organizationId = asNumber(membership.organization_id);
  const organization = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;
  const organizationName = organization && typeof organization === "object" && "name" in organization
    ? asString(organization.name)
    : "Protek";

  const [stagesResult, customersResult, opportunitiesResult, quotesResult] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, stage_key, name, position, probability_percent, is_closed, outcome")
      .eq("organization_id", organizationId)
      .order("position"),
    supabase
      .from("customers")
      .select("id, display_name")
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
      .select("id, quote_number, customer_id, opportunity_id, title, service_mode, total_amount, estimated_margin_percent, status, updated_at, valid_until")
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
  const customerNameById = new Map(
    (customersResult.data as DatabaseRow[]).map((row) => [asNumber(row.id), asString(row.display_name)]),
  );
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
      customerName: customerNameById.get(asNumber(row.customer_id)) ?? "Cliente sin nombre",
      title: asString(row.title),
      serviceMode: asString(row.service_mode) as Quote["serviceMode"],
      totalAmount: asNumber(row.total_amount),
      estimatedMarginPercent: row.estimated_margin_percent === null ? null : asNumber(row.estimated_margin_percent),
      status: asString(row.status),
      stageKey: opportunity?.stageKey ?? "new",
      stageName: opportunity?.stageName ?? "Borrador",
      updatedAt: asString(row.updated_at),
      validUntil: typeof row.valid_until === "string" ? row.valid_until : null,
    };
  });

  return { organizationName, isDemo: false, stages, quotes, opportunities };
}

export async function getSalesContext(supabase: SupabaseClient) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return null;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", authData.user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return membership ? { organizationId: asNumber(membership.organization_id), userId: authData.user.id } : null;
}
