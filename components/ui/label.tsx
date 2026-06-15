import * as React from "react";

import { cn } from "@/lib/utils";

function Label({
  className,
  ...props
}: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-1 font-sans text-[0.7rem] font-medium uppercase tracking-wider text-zinc-700 select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:text-zinc-300",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
