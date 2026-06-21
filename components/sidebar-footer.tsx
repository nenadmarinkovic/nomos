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

/**
 * Bottom of the sidebar. A full-row profile button — avatar + name + email
 * — opens a dropdown with the user info, theme picker, and sign-out. When
 * signed out the same slot shows a "Sign in" link with the theme picker
 * sitting under the same dropdown.
 *
 * Pattern adapted from Monolinie's `UserSection`: trigger fills the row
 * (`gap-3 h-9`) with a 28px avatar, two lines of identity, and a
 * caret-up-down on the right. Menu opens upward when expanded, rightward
 * when collapsed.
 */
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

  // Same `h-14` as `SiteFooter` so the two borders line up across the
  // sidebar / main split.
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
                "flex w-full cursor-pointer items-center gap-3 rounded-md text-foreground/70 transition-colors hover:bg-foreground/[0.04] hover:text-foreground",
                collapsed ? "h-10 justify-center px-0" : "h-10 px-1.5",
              )}
              aria-label="Account & settings"
            >
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/[0.08] text-muted-foreground"
              >
                <UserIcon size={13} weight="regular" />
              </span>
              {!collapsed && (
                <>
                  <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                    <span className="truncate text-[13px] font-medium text-foreground">
                      Guest
                    </span>
                    <span className="truncate font-mono text-[10px] text-muted-foreground">
                      Not signed in
                    </span>
                  </span>
                  <CaretUpDownIcon
                    size={13}
                    weight="regular"
                    className="shrink-0 text-muted-foreground"
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
                <SignInIcon size={14} weight="regular" />
                <span className="font-sans text-[12px]">Sign in</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/signup"
                className="flex cursor-pointer items-center gap-2 text-muted-foreground"
              >
                <UserIcon size={14} weight="regular" />
                <span className="font-sans text-[12px]">Create account</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {collapsed && (
          <Tooltip>
            <TooltipTrigger render={<span className="sr-only">Open menu</span>} />
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
              "flex w-full cursor-pointer items-center gap-3 rounded-md transition-colors hover:bg-foreground/[0.04]",
              collapsed ? "h-10 justify-center px-0" : "h-10 px-1.5",
            )}
            aria-label={`Account · ${user.email}`}
          >
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/[0.08] text-muted-foreground"
            >
              <UserIcon size={13} weight="regular" />
            </span>
            {!collapsed && (
              <>
                <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                  <span className="truncate text-[13px] font-medium text-foreground">
                    {display}
                  </span>
                  <span className="truncate font-mono text-[10px] text-muted-foreground">
                    {user.email}
                  </span>
                </span>
                <CaretUpDownIcon
                  size={13}
                  weight="regular"
                  className="shrink-0 text-muted-foreground"
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
          {/* User identity block */}
          <div className="flex items-center gap-3 px-2 py-2">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/[0.08] text-muted-foreground"
            >
              <UserIcon size={15} weight="regular" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-sans text-[13px] font-medium text-foreground">
                {display}
              </p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
          <DropdownMenuSeparator />
          <ThemeRow />
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleSignOut}>
            <SignOutIcon size={14} weight="regular" />
            <span className="font-sans text-[12px]">Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Theme picker row, styled to live inside the dropdown menu. */
function ThemeRow() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5">
      <span className="font-sans text-[12px] text-muted-foreground">Theme</span>
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
                  : "text-muted-foreground hover:text-foreground",
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
