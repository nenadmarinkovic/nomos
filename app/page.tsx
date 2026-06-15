import { cookies } from "next/headers";

import { HomeShell } from "@/components/home-shell";

export default async function Home() {
  const store = await cookies();
  const defaultCollapsed = store.get("sidebar-collapsed")?.value === "true";

  return <HomeShell defaultCollapsed={defaultCollapsed} />;
}
