import { NextResponse } from "next/server";
import { z } from "zod";
import { getSalesContext } from "@/features/sales/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const customerSchema = z.object({
  organizationId: z.coerce.number().int().positive(),
  id: z.coerce.number().int().positive().optional(),
  displayName: z.string().trim().min(2).max(160),
  legalName: z.string().trim().max(220).optional(),
  taxId: z.string().trim().max(32).optional(),
  accountCode: z.string().trim().max(64).optional(),
  status: z.enum(["active", "inactive", "prospect"]),
});

async function getRequestContext(request: Request) {
  const parsed = customerSchema.safeParse(await request.json());
  if (!parsed.success) return { error: NextResponse.json({ error: "Review the required customer fields." }, { status: 400 }) };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: NextResponse.json({ error: "Supabase is not configured." }, { status: 503 }) };
  const context = await getSalesContext(supabase, parsed.data.organizationId);
  if (!context) return { error: NextResponse.json({ error: "Sign in and select an active organization." }, { status: 401 }) };
  return { parsed: parsed.data, supabase, context };
}

function customerPayload(data: z.infer<typeof customerSchema>, organizationId: number) {
  return {
    organization_id: organizationId,
    display_name: data.displayName,
    legal_name: data.legalName || null,
    tax_id: data.taxId || null,
    account_code: data.accountCode || null,
    status: data.status,
  };
}

function toResponse(data: { id: number; display_name: string; legal_name: string | null; tax_id: string | null; account_code: string | null; status: string }) {
  return {
    id: data.id,
    displayName: data.display_name,
    legalName: data.legal_name,
    taxId: data.tax_id,
    accountCode: data.account_code,
    status: data.status,
  };
}

export async function POST(request: Request) {
  const result = await getRequestContext(request);
  if ("error" in result) return result.error;
  const { data, error } = await result.supabase
    .from("customers")
    .insert(customerPayload(result.parsed, result.context.organizationId))
    .select("id, display_name, legal_name, tax_id, account_code, status")
    .single();
  if (error || !data) return NextResponse.json({ error: "The customer could not be created." }, { status: 500 });
  return NextResponse.json(toResponse(data), { status: 201 });
}

export async function PATCH(request: Request) {
  const result = await getRequestContext(request);
  if ("error" in result) return result.error;
  if (!result.parsed.id) return NextResponse.json({ error: "Customer id is required." }, { status: 400 });
  const { data, error } = await result.supabase
    .from("customers")
    .update(customerPayload(result.parsed, result.context.organizationId))
    .eq("id", result.parsed.id)
    .eq("organization_id", result.context.organizationId)
    .select("id, display_name, legal_name, tax_id, account_code, status")
    .single();
  if (error || !data) return NextResponse.json({ error: "The customer could not be updated." }, { status: 500 });
  return NextResponse.json(toResponse(data));
}
