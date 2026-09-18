import { NextResponse } from "next/server";
import { z } from "zod";
import { getSalesContext } from "@/features/sales/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createQuoteSchema = z.object({
  customerName: z.string().trim().min(2).max(160),
  title: z.string().trim().min(3).max(220),
  serviceMode: z.enum(["workshop", "field", "parts"]),
  estimatedRevenue: z.coerce.number().min(0).max(999_999_999),
  estimatedCost: z.coerce.number().min(0).max(999_999_999),
  validUntil: z.string().date().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const parsed = createQuoteSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Review the required quote fields." }, { status: 400 });

  const context = await getSalesContext(supabase);
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

  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("display_name", parsed.data.customerName)
    .is("archived_at", null)
    .maybeSingle();

  const customerResult = existingCustomer
    ? { data: existingCustomer, error: null }
    : await supabase
      .from("customers")
      .insert({ organization_id: context.organizationId, display_name: parsed.data.customerName, status: "prospect" })
      .select("id")
      .single();
  if (customerResult.error || !customerResult.data) {
    return NextResponse.json({ error: "The customer could not be saved." }, { status: 500 });
  }

  const { data: opportunity, error: opportunityError } = await supabase
    .from("sales_opportunities")
    .insert({
      organization_id: context.organizationId,
      customer_id: customerResult.data.id,
      pipeline_id: pipeline.id,
      stage_id: newStage.id,
      title: parsed.data.title,
      service_mode: parsed.data.serviceMode,
      estimated_revenue: parsed.data.estimatedRevenue,
      estimated_cost: parsed.data.estimatedCost,
      owner_id: context.userId,
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
      customer_id: customerResult.data.id,
      title: parsed.data.title,
      service_mode: parsed.data.serviceMode,
      estimated_cost: parsed.data.estimatedCost,
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
    unit_price: parsed.data.estimatedRevenue,
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
