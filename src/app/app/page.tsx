import { demoSalesOverview } from "@/features/sales/demo-data";
import { getSalesOverview } from "@/features/sales/server";
import { SalesWorkspace } from "@/features/sales/sales-workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppPage() {
  const supabase = await createSupabaseServerClient();
  const liveOverview = supabase ? await getSalesOverview(supabase) : null;
  return <SalesWorkspace initialOverview={liveOverview ?? demoSalesOverview} />;
}
