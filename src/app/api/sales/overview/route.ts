import { NextResponse } from "next/server";
import { getSalesOverview } from "@/features/sales/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const requestedOrganizationId = Number(new URL(request.url).searchParams.get("organizationId"));
  const overview = await getSalesOverview(
    supabase,
    Number.isSafeInteger(requestedOrganizationId) && requestedOrganizationId > 0 ? requestedOrganizationId : undefined,
  );
  if (!overview) {
    return NextResponse.json({ error: "Sign in and select an active organization." }, { status: 401 });
  }

  return NextResponse.json(overview);
}
