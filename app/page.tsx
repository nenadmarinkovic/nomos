import { cookies } from "next/headers";

import { HomeShell } from "@/components/home-shell";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const store = await cookies();
  const defaultCollapsed = store.get("sidebar-collapsed")?.value === "true";
  const { run } = await searchParams;

  return <HomeShell defaultCollapsed={defaultCollapsed} sharedRunId={run} />;
}
