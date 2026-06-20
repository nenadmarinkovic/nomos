import { cookies } from "next/headers";

import { AppShell } from "@/components/app-shell";
import { NarratorPage } from "@/components/pages/narrator-page";

export default async function Narrator() {
  const store = await cookies();
  const defaultCollapsed = store.get("sidebar-collapsed")?.value === "true";

  return (
    <AppShell defaultCollapsed={defaultCollapsed}>
      <NarratorPage />
    </AppShell>
  );
}
