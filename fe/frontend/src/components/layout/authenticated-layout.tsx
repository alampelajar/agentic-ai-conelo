import { useEffect } from "react";
import { Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { getCookie } from "@/lib/cookies";
import { cn } from "@/lib/utils";

import { LayoutProvider } from "@/context/layout-provider";
import { SearchProvider } from "@/context/search-provider";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/theme-switch";
import { ConfigDrawer } from "@/components/config-drawer";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { SkipToMain } from "@/components/skip-to-main";

import { AgentTasksProvider } from "@/features/ai/components/agent-tasks-provider";

import { getCurrentUser } from '@/lib/api-auth'

import i18n from "@/i18n";

export function AuthenticatedLayout() {
  const defaultOpen = getCookie("sidebar_state") !== "false";

  const { i18n: currentI18n } = useTranslation();

  const currentLanguage = currentI18n.language;

  const isIndonesian = currentLanguage.startsWith("id");
  const isEnglish = currentLanguage.startsWith("en");

  // Ambil profile terbaru dari backend
  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      try {
        if (cancelled) return;

        await getCurrentUser()
      } catch (error) {
        console.error("Gagal mengambil profile user:", error);
      }
    }

    loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const changeLanguage = (language: "id" | "en") => {
    if (currentLanguage.startsWith(language)) return;

    i18n.changeLanguage(language);
  };

  return (
    <SearchProvider>
      <LayoutProvider>
        <AgentTasksProvider>
          <SidebarProvider defaultOpen={defaultOpen}>
            <SkipToMain />

            {/* ================================
                SIDEBAR
            ================================= */}
            <AppSidebar />

            <SidebarInset
              className={cn(
                "@container/content",
                "has-data-[layout=fixed]:h-svh",
                "peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]",
              )}
            >
              {/* ================================
                  GLOBAL HEADER
              ================================= */}
              <Header fixed>
                {/* Search */}
                <Search className="me-auto" />

                {/* ================================
                    LANGUAGE SWITCHER
                ================================= */}
                <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
                  {/* Indonesia */}
                  <button
                    type="button"
                    onClick={() => changeLanguage("id")}
                    aria-label="Bahasa Indonesia"
                    aria-pressed={isIndonesian}
                    className={cn(
                      "flex h-7 w-9 items-center justify-center rounded-md",
                      "text-xl transition-all duration-200",
                      "focus-visible:outline-none focus-visible:ring-2",
                      "focus-visible:ring-primary/50",
                      isIndonesian
                        ? "bg-primary/10 shadow-sm ring-1 ring-primary/20"
                        : "opacity-50 hover:bg-muted hover:opacity-100",
                    )}
                  >
                    🇮🇩
                  </button>

                  {/* English */}
                  <button
                    type="button"
                    onClick={() => changeLanguage("en")}
                    aria-label="English"
                    aria-pressed={isEnglish}
                    className={cn(
                      "flex h-7 w-9 items-center justify-center rounded-md",
                      "text-xl transition-all duration-200",
                      "focus-visible:outline-none focus-visible:ring-2",
                      "focus-visible:ring-primary/50",
                      isEnglish
                        ? "bg-primary/10 shadow-sm ring-1 ring-primary/20"
                        : "opacity-50 hover:bg-muted hover:opacity-100",
                    )}
                  >
                    🇬🇧
                  </button>
                </div>

                {/* Theme */}
                <ThemeSwitch />

                {/* Settings */}
                <ConfigDrawer />

                {/* Profile */}
                <ProfileDropdown />
              </Header>

              {/* ================================
                  PAGE CONTENT
              ================================= */}
              <Outlet />
            </SidebarInset>
          </SidebarProvider>
        </AgentTasksProvider>
      </LayoutProvider>
    </SearchProvider>
  );
}