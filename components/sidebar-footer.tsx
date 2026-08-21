"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CaretUpDownIcon,
  DesktopIcon,
  MoonIcon,
  SignInIcon,
  SignOutIcon,
  SunIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { useTheme } from "next-themes";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  { value: "system", Icon: DesktopIcon, label: "System" },
  { value: "light", Icon: SunIcon, label: "Light" },
  { value: "dark", Icon: MoonIcon, label: "Dark" },
] as const;

export function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div
        aria-hidden
        className="h-14 shrink-0 border-t border-foreground/10"
      />
    );
  }

  const containerCls = cn(
    "flex h-14 shrink-0 items-center border-t border-foreground/10",
    collapsed ? "px-2" : "px-3",
  );

  if (!session) {
    return (
      <div className={containerCls}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-md text-foreground/75 transition-colors hover:bg-foreground/4 hover:text-foreground",
                collapsed ? "h-10 justify-center px-0" : "h-10 px-1.5",
              )}
              aria-label="Account & settings"
            >
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/8 text-foreground/55"
              >
                <UserIcon size={13} weight="regular" />
              </span>
              {!collapsed && (
                <>
                  <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                    <span className="truncate text-sm font-medium text-foreground">
                      Guest
                    </span>
                    <span className="truncate font-mono text-xs text-foreground/55">
                      Not signed in
                    </span>
                  </span>
                  <CaretUpDownIcon
                    size={13}
                    weight="regular"
                    className="shrink-0 text-foreground/55"
                  />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={collapsed ? "end" : "start"}
            side={collapsed ? "right" : "top"}
            sideOffset={8}
            className="w-60"
          >
            <ThemeRow />
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href="/signin"
                className="flex cursor-pointer items-center gap-2"
              >
                <SignInIcon size={16} weight="regular" />
                <span className="text-sm">Sign in</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/signup"
                className="flex cursor-pointer items-center gap-2 text-foreground/75"
              >
                <UserIcon size={16} weight="regular" />
                <span className="text-sm">Create account</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {collapsed && (
          <Tooltip>
            <TooltipTrigger
              render={<span className="sr-only">Open menu</span>}
            />
            <TooltipContent side="right" sideOffset={8}>
              Account &amp; settings
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  const user = session.user;
  const display = user.name?.trim() || user.email.split("@")[0];

  async function handleSignOut() {
    await signOut();
    router.refresh();
  }

  return (
    <div className={containerCls}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full cursor-pointer items-center gap-3 rounded-md transition-colors hover:bg-foreground/4",
              collapsed ? "h-10 justify-center px-0" : "h-10 px-1.5",
            )}
            aria-label={`Account · ${user.email}`}
          >
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/8 text-foreground/55"
            >
              <UserIcon size={13} weight="regular" />
            </span>
            {!collapsed && (
              <>
                <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                  <span className="truncate text-sm font-medium text-foreground">
                    {display}
                  </span>
                  <span className="truncate font-mono text-xs text-foreground/55">
                    {user.email}
                  </span>
                </span>
                <CaretUpDownIcon
                  size={13}
                  weight="regular"
                  className="shrink-0 text-foreground/55"
                />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={collapsed ? "end" : "start"}
          side={collapsed ? "right" : "top"}
          sideOffset={8}
          className="w-60"
        >
          <div className="flex items-center gap-3 px-2 py-2">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/8 text-foreground/55"
            >
              <UserIcon size={15} weight="regular" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {display}
              </p>
              <p className="truncate font-mono text-sm text-foreground/55">
                {user.email}
              </p>
            </div>
          </div>
          <DropdownMenuSeparator />
          <ThemeRow />
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleSignOut}>
            <SignOutIcon size={16} weight="regular" />
            <span className="text-sm">Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ThemeRow() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5">
      <span className="text-sm text-foreground/75">Theme</span>
      <div className="flex items-center gap-0.5 rounded-md border border-foreground/10 bg-background/40 p-0.5">
        {THEME_OPTIONS.map(({ value, Icon, label }) => {
          const active = mounted && theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={label}
              title={label}
              onClick={() => setTheme(value)}
              className={cn(
                "flex size-6 cursor-pointer items-center justify-center rounded-[3px] transition-colors",
                active
                  ? "bg-foreground/10 text-foreground"
                  : "text-foreground/55 hover:text-foreground",
              )}
            >
              <Icon size={12} weight="regular" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
