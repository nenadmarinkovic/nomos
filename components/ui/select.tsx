"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";
import {
  CaretDownIcon,
  CaretUpIcon,
  CheckIcon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-foreground/15 bg-field px-3 py-2 font-sans text-sm text-foreground transition-[color,box-shadow,border-color] outline-none",
        "placeholder:text-zinc-500 dark:placeholder:text-zinc-500",
        "focus-visible:border-foreground/40 focus-visible:ring-2 focus-visible:ring-foreground/10",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[placeholder]:text-zinc-500 [&>span]:line-clamp-1",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <CaretDownIcon
          weight="bold"
          className="size-3.5 shrink-0 text-zinc-500"
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up"
      className={cn(
        "flex cursor-default items-center justify-center py-1 text-zinc-500",
        className,
      )}
      {...props}
    >
      <CaretUpIcon weight="bold" className="size-3.5" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down"
      className={cn(
        "flex cursor-default items-center justify-center py-1 text-zinc-500",
        className,
      )}
      {...props}
    >
      <CaretDownIcon weight="bold" className="size-3.5" />
    </SelectPrimitive.ScrollDownButton>
  );
}

function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        className={cn(
          "relative z-50 max-h-[var(--radix-select-content-available-height)] min-w-[8rem] overflow-hidden rounded-md border border-foreground/10 bg-card font-sans text-sm text-foreground",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className,
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn(
        "px-2 py-1.5 font-sans text-xs font-medium uppercase tracking-wider text-zinc-500",
        className,
      )}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  description,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item> & {
  description?: React.ReactNode;
}) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-pointer select-none items-start gap-2 rounded-sm py-2 pl-2 pr-8 font-sans text-sm outline-none",
        "focus:bg-foreground/[0.06] focus:text-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        {description && (
          <span className="text-[11px] leading-snug text-muted-foreground">
            {description}
          </span>
        )}
      </div>
      <span className="absolute right-2 top-2.5 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon
            weight="bold"
            className="size-3.5 text-[#F25022]"
          />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("-mx-1 my-1 h-px bg-foreground/10", className)}
      {...props}
    />
  );
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
