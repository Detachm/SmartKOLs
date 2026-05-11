"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Bell, Settings, CalendarDays, FileText, Search, Radar } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAppChromeOverview, type AppChromeOverviewResponse } from "@/lib/live-api";
import { getLiveSession } from "@/lib/session-client";
import NotificationBell from "./NotificationBell";
import CommandPalette from "./CommandPalette";

const navItems = [
  { label: "概览", href: "/dashboard", icon: LayoutDashboard },
  { label: "账号管理", href: "/accounts", icon: Users },
  { label: "内容日历", href: "/calendar", icon: CalendarDays },
  { label: "内容审核", href: "/drafts", icon: FileText },
  { label: "AI BD", href: "/ai-bd", icon: Radar },
  { label: "监控中心", href: "/monitoring", icon: Bell },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [chrome, setChrome] = useState<AppChromeOverviewResponse | null>(null);

  const pendingDrafts = chrome?.summary.pending_drafts ?? 0;
  const unreadNotifications = chrome?.summary.unread_notifications ?? 0;

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadChrome() {
      try {
        const session = await getLiveSession();
        const overview = await getAppChromeOverview(session.selected_workspace.id, {
          notificationLimit: 8,
          groupLimit: 8,
        });
        if (!cancelled) {
          setChrome(overview);
        }
      } catch {
        if (!cancelled) {
          setChrome(null);
        }
      }
    }

    if (pathname !== "/login") {
      void loadChrome();
    }

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Hide sidebar on login page
  if (pathname === "/login") return null;

  return (
    <>
      <aside className="fixed left-0 top-0 h-full w-56 bg-white border-r border-[#E8E8E8] flex flex-col z-40">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#E8E8E8]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#111111] flex items-center justify-center text-white text-xs font-black">
              SK
            </div>
            <span className="text-[#111111] font-semibold text-base tracking-tight">SmartKOLs</span>
          </div>
        </div>

        {/* Search Trigger */}
        <div className="px-3 pt-4">
          <button
            onClick={() => setPaletteOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#999999] bg-[#F7F7F7] hover:bg-[#F0F0F0] transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left text-xs">搜索...</span>
            <kbd className="text-[10px] text-[#999999] bg-white border border-[#E8E8E8] px-1.5 py-0.5 rounded">⌘K</kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pt-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-[#F0F0F0] text-[#111111] font-medium"
                    : "text-[#999999] hover:text-[#333333] hover:bg-[#F7F7F7]"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
                {href === "/drafts" && pendingDrafts > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-[#111111] text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {pendingDrafts}
                  </span>
                )}
                {href === "/monitoring" && unreadNotifications > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-[#E05252] text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {unreadNotifications}
                  </span>
                )}
              </Link>
            );
          })}
          <div className="pt-2">
            <NotificationBell notifications={chrome?.recent_notifications ?? []} unreadCount={unreadNotifications} />
          </div>
        </nav>

        {/* Settings */}
        <div className="px-3 pb-5 border-t border-[#E8E8E8] pt-3">
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              pathname === "/settings"
                ? "bg-[#F0F0F0] text-[#111111] font-medium"
                : "text-[#999999] hover:text-[#333333] hover:bg-[#F7F7F7]"
            )}
          >
            <Settings className="w-4 h-4" />
            设置
          </Link>
        </div>
      </aside>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
