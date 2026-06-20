import { cookies } from "next/headers";

import { AppShell } from "@/components/app-shell";
import { MetricsPage } from "@/components/pages/metrics-page";

export default async function Metrics() {
  const store = await cookies();
  const defaultCollapsed = store.get("sidebar-collapsed")?.value === "true";

  return (
    <AppShell defaultCollapsed={defaultCollapsed}>
      <MetricsPage />
    </AppShell>
  );
}
