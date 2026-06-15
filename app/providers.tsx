"use client";

import { ThemeProvider } from "next-themes";

import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider delay={200}>{children}</TooltipProvider>
    </ThemeProvider>
  );
}
