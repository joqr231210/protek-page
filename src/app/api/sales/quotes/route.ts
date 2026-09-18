import { NextResponse } from "next/server";
import { z } from "zod";
import { getSalesContext } from "@/features/sales/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createQuoteSchema = z.object({
  organizationId: z.coerce.number().int().positive(),
  customerId: z.coerce.number().int().positive(),
  title: z.string().trim().min(3).max(220),
  notes: z.string().trim().max(5_000).optional(),
  responsibleId: z.string().uuid().optional().or(z.literal("")),
  serviceMode: z.enum(["workshop", "field", "parts"]),
  currencyCode: z.enum(["MXN", "USD", "EUR"]),
  amountBeforeTax: z.coerce.number().min(0).max(999_999_999),
  totalWithTax: z.coerce.number().min(0).max(999_999_999),
  validUntil: z.string().date().optional().or(z.literal("")),
}).refine((data) => data.totalWithTax >= data.amountBeforeTax, { message: "Total must include the amount before tax." });

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const parsed = createQuoteSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Review the required quote fields." }, { status: 400 });

  const context = await getSalesContext(supabase, parsed.data.organizationId);
  if (!context) return NextResponse.json({ error: "Sign in and select an active organization." }, { status: 401 });

  const { data: pipeline } = await supabase
    .from("sales_pipelines")
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("is_default", true)
    .is("archived_at", null)
    .maybeSingle();
  if (!pipeline) return NextResponse.json({ error: "The commercial pipeline has not been initialized." }, { status: 409 });

  const { data: newStage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("pipeline_id", pipeline.id)
    .eq("stage_key", "new")
    .maybeSingle();
  if (!newStage) return NextResponse.json({ error: "The initial pipeline stage is missing." }, { status: 409 });

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("id", parsed.data.customerId)
    .is("archived_at", null)
    .maybeSingle();
  if (customerError || !customer) {
    return NextResponse.json({ error: "Select an active customer from this company." }, { status: 400 });
  }
  if (parsed.data.responsibleId) {
    const { data: responsible } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", context.organizationId)
      .eq("user_id", parsed.data.responsibleId)
      .eq("status", "active")
      .maybeSingle();
    if (!responsible) return NextResponse.json({ error: "Select an active member of this company as responsible." }, { status: 400 });
  }

  const { data: opportunity, error: opportunityError } = await supabase
    .from("sales_opportunities")
    .insert({
      organization_id: context.organizationId,
      customer_id: customer.id,
      pipeline_id: pipeline.id,
      stage_id: newStage.id,
      title: parsed.data.title,
      service_mode: parsed.data.serviceMode,
      estimated_revenue: parsed.data.totalWithTax,
      estimated_cost: 0,
      owner_id: parsed.data.responsibleId || context.userId,
    })
    .select("id")
    .single();
  if (opportunityError || !opportunity) {
    return NextResponse.json({ error: "The opportunity could not be created." }, { status: 500 });
  }

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      organization_id: context.organizationId,
      opportunity_id: opportunity.id,
      customer_id: customer.id,
      title: parsed.data.title,
      notes: parsed.data.notes || null,
      service_mode: parsed.data.serviceMode,
      currency_code: parsed.data.currencyCode,
      estimated_cost: 0,
      valid_until: parsed.data.validUntil || null,
      status: "draft",
    })
    .select("id, quote_number")
    .single();
  if (quoteError || !quote) {
    return NextResponse.json({ error: "The quote could not be created." }, { status: 500 });
  }

  const { error: lineError } = await supabase.from("quote_lines").insert({
    organization_id: context.organizationId,
    quote_id: quote.id,
    position: 1,
    line_type: "service",
    description: parsed.data.title,
    quantity: 1,
    unit_price: parsed.data.amountBeforeTax,
    tax_percent: parsed.data.amountBeforeTax > 0 ? ((parsed.data.totalWithTax / parsed.data.amountBeforeTax) - 1) * 100 : 0,
  });
  if (lineError) return NextResponse.json({ error: "The initial quote line could not be created." }, { status: 500 });

  await supabase.from("opportunity_stage_history").insert({
    organization_id: context.organizationId,
    opportunity_id: opportunity.id,
    to_stage_id: newStage.id,
    note: "Opportunity created from quote intake.",
  });
  await supabase.from("quote_status_history").insert({
    organization_id: context.organizationId,
    quote_id: quote.id,
    to_status: "draft",
    note: "Quote created.",
  });
  await supabase.from("activity_events").insert({
    organization_id: context.organizationId,
    entity_type: "quote",
    entity_id: quote.id,
    event_type: "quote_created",
    summary: `Quote Q-${quote.quote_number} created.`,
  });

  return NextResponse.json({ id: quote.id, quoteNumber: quote.quote_number }, { status: 201 });
}
