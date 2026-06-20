import { cookies } from "next/headers";

import { AppShell } from "@/components/app-shell";
import { AgentsPage } from "@/components/pages/agents-page";

export default async function Agents() {
  const store = await cookies();
  const defaultCollapsed = store.get("sidebar-collapsed")?.value === "true";

  return (
    <AppShell defaultCollapsed={defaultCollapsed}>
      <AgentsPage />
    </AppShell>
  );
}
