import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

import { Logo } from "@/assets/logo";

import { NavGroup } from "./nav-group";
import { NavUser } from "./nav-user";
import { sidebarData } from "./data/sidebar-data";

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      {/* =====================================================
          LOGO
      ===================================================== */}

      <SidebarHeader>
        <div className="flex h-12 items-center gap-2 px-2">
          <Logo className="size-8 shrink-0" />

          <div className="grid flex-1 text-start leading-tight">
            <span className="truncate text-sm font-semibold">
              AGENTIC<span className="text-primary">AI</span>
            </span>

            <span className="truncate text-xs text-muted-foreground">
              SMART AGENTIC
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* =====================================================
          NAVIGATION
      ===================================================== */}

      <SidebarContent>
        {sidebarData.navGroups.map((group) => (
          <NavGroup
            key={group.title}
            title={group.title}
            items={group.items}
          />
        ))}
      </SidebarContent>

      {/* =====================================================
          USER
      ===================================================== */}

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>

      {/* =====================================================
          SIDEBAR RAIL
      ===================================================== */}

      <SidebarRail />
    </Sidebar>
  );
}