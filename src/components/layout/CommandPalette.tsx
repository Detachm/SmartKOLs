"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, FileText, LayoutDashboard, Bell, Settings, CalendarDays, Radar } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchAppCommandTargets, type AppCommandSearchResult } from "@/lib/live-api";
import { getLiveSession } from "@/lib/session-client";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Result {
  id: string;
  label: string;
  sub?: string;
  icon: ReactNode;
  href: string;
  group: string;
}

const PAGES: Result[] = [
  { id: "p1", label: "概览", sub: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" />, href: "/dashboard", group: "页面" },
  { id: "p2", label: "账号管理", sub: "Accounts", icon: <Users className="w-4 h-4" />, href: "/accounts", group: "页面" },
  { id: "p3", label: "内容日历", sub: "Calendar", icon: <CalendarDays className="w-4 h-4" />, href: "/calendar", group: "页面" },
  { id: "p4", label: "内容审核", sub: "Drafts", icon: <FileText className="w-4 h-4" />, href: "/drafts", group: "页面" },
  { id: "p5", label: "AI BD", sub: "Asset Outreach", icon: <Radar className="w-4 h-4" />, href: "/ai-bd", group: "页面" },
  { id: "p6", label: "监控中心", sub: "Monitoring", icon: <Bell className="w-4 h-4" />, href: "/monitoring", group: "页面" },
  { id: "p7", label: "设置", sub: "Settings", icon: <Settings className="w-4 h-4" />, href: "/settings", group: "页面" },
];

export default function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [liveResults, setLiveResults] = useState<AppCommandSearchResult[]>([]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const q = query.trim();
    if (!q) {
      setLiveResults([]);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        const session = await getLiveSession();
        const response = await searchAppCommandTargets(session.selected_workspace.id, {
          query: q,
          limit: 18,
        });
        if (!cancelled) {
          setLiveResults(response.results);
        }
      } catch {
        if (!cancelled) {
          setLiveResults([]);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [open, query]);

  const results = useMemo<Result[]>(() => {
    const q = query.toLowerCase().trim();
    if (!q) return PAGES;

    const pages = PAGES.filter((p) => p.label.toLowerCase().includes(q) || p.sub?.toLowerCase().includes(q));

    const remoteResults: Result[] = liveResults.map((item) => ({
      id: item.id,
      label: item.label,
      sub: item.sublabel ?? item.badge,
      icon: item.kind === "account" || item.kind === "account_group"
        ? <Users className="w-4 h-4" />
        : <FileText className="w-4 h-4" />,
      href: item.href,
      group: item.kind === "account" || item.kind === "account_group" ? "账号" : "内容",
    }));

    return [...pages, ...remoteResults];
  }, [query, liveResults]);

  const handleSelect = (r: Result) => {
    router.push(r.href);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, results.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
      if (e.key === "Enter") {
        e.preventDefault();
        const selected = results[selectedIdx];
        if (selected) {
          router.push(selected.href);
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, results, selectedIdx, router, onClose]);

  if (!open) return null;

  // Group results
  const grouped: Record<string, Result[]> = {};
  results.forEach((r) => {
    if (!grouped[r.group]) grouped[r.group] = [];
    grouped[r.group].push(r);
  });

  let flatIdx = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl border border-[#E8E8E8] w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E8E8E8]">
          <Search className="w-4 h-4 text-[#999999]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            placeholder="搜索账号、草稿、消息或跳转到页面..."
            className="flex-1 bg-transparent text-sm text-[#111111] placeholder:text-[#999999] focus:outline-none"
          />
          <kbd className="text-[10px] text-[#999999] bg-[#F0F0F0] px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {results.length === 0 && (
            <p className="text-center text-[#999999] text-sm py-10">没有找到匹配项</p>
          )}
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <p className="text-[10px] text-[#999999] uppercase tracking-wider px-4 pt-3 pb-1 font-medium">{group}</p>
              {items.map((r) => {
                const currentIdx = flatIdx++;
                const isSelected = currentIdx === selectedIdx;
                return (
                  <button
                    key={r.id}
                    onClick={() => handleSelect(r)}
                    onMouseEnter={() => setSelectedIdx(currentIdx)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                      isSelected ? "bg-[#F0F0F0] text-[#111111]" : "text-[#111111] hover:bg-[#F7F7F7]"
                    )}
                  >
                    <span className="text-[#999999]">{r.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{r.label}</p>
                      {r.sub && <p className="text-xs text-[#999999] truncate">{r.sub}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
