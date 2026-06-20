import { cookies } from "next/headers";

import { AppShell } from "@/components/app-shell";

export default async function SimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  const defaultCollapsed = store.get("sidebar-collapsed")?.value === "true";

  return <AppShell defaultCollapsed={defaultCollapsed}>{children}</AppShell>;
}
