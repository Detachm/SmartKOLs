"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getWorkspaceSettingsOverview, type WorkspaceSettingsOverviewResponse } from "@/lib/live-api";
import { getLiveSession, logoutLiveSession, type LiveSessionResponse } from "@/lib/session-client";
import { CheckCircle, LogOut, RefreshCw, Users } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

const ROLE_TONES: Record<string, string> = {
  owner: "bg-[#111111] text-white",
  admin: "bg-blue-100 text-blue-700",
  editor: "bg-emerald-100 text-emerald-700",
  viewer: "bg-[#F0F0F0] text-[#777777]",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export default function SettingsPage() {
  const router = useRouter();
  const [session, setSession] = useState<LiveSessionResponse | null>(null);
  const [settings, setSettings] = useState<WorkspaceSettingsOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [compactMode, setCompactMode] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextSession = await getLiveSession();
      const overview = await getWorkspaceSettingsOverview(nextSession.selected_workspace.id);
      setSession(nextSession);
      setSettings(overview);
    } catch (cause) {
      setSession(null);
      setSettings(null);
      setError(cause instanceof Error ? cause.message : "加载设置失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const handleSaveLocalPreferences = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleLogout = () => {
    void logoutLiveSession().finally(() => {
      router.push("/login");
    });
  };

  return (
    <div className="max-w-4xl p-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">设置</h1>
          <p className="text-[#999999] text-sm mt-1">当前 workspace、成员权限与本地界面偏好。</p>
        </div>
        <Button variant="outline" onClick={() => void loadSettings()} disabled={loading}>
          {loading ? "刷新中..." : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />刷新</>}
        </Button>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-[#F2D5D5] bg-[#FFF7F7] px-4 py-3 text-sm text-[#D93025]">
          {error}
        </div>
      ) : null}

      <div className="space-y-6">
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
          <h2 className="text-[#111111] font-semibold text-sm">当前登录</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-[#EFEFEF] bg-[#FAFAFA] p-4">
              <p className="text-xs text-[#999999]">用户</p>
              <p className="mt-1 text-sm font-medium text-[#111111]">{session?.user.name ?? "加载中"}</p>
              <p className="mt-1 text-xs text-[#999999]">{session?.user.email ?? ""}</p>
            </div>
            <div className="rounded-lg border border-[#EFEFEF] bg-[#FAFAFA] p-4">
              <p className="text-xs text-[#999999]">Workspace</p>
              <p className="mt-1 text-sm font-medium text-[#111111]">{settings?.workspace.name ?? session?.selected_workspace.name ?? "加载中"}</p>
              <p className="mt-1 text-xs text-[#999999]">
                {settings?.workspace.slug ? `/${settings.workspace.slug}` : ""}
                {session?.selected_role_code ? ` · ${ROLE_LABELS[session.selected_role_code] ?? session.selected_role_code}` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[#111111] font-semibold text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              团队成员
              <span className="text-xs text-[#999999] font-normal">· {settings?.summary.member_count ?? 0} 人</span>
            </h2>
            <span className="text-xs text-[#999999]">成员管理接口已接入，邀请 UI 后续单独做。</span>
          </div>

          {loading && !settings ? (
            <p className="py-8 text-center text-sm text-[#999999]">正在加载团队成员...</p>
          ) : null}

          <div className="space-y-2">
            {settings?.members.map((member) => (
              <div key={member.user.id} className="flex items-center gap-3 py-2">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#111111] text-xs font-semibold text-white">
                  {member.user.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#111111] text-sm font-medium">{member.user.name}</p>
                  <p className="text-[#999999] text-xs">{member.user.email}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ROLE_TONES[member.membership.role_code] ?? ROLE_TONES.viewer}`}>
                  {ROLE_LABELS[member.membership.role_code] ?? member.membership.role_code}
                </span>
                <span className="text-xs text-[#999999] ml-2">加入 {formatDate(member.membership.joined_at)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 space-y-4">
          <h2 className="text-[#111111] font-semibold text-sm">本地界面偏好</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#111111] text-sm">自动刷新运行概览</p>
              <p className="text-[#999999] text-xs">只影响当前浏览器会话；后台自动化不依赖这个开关。</p>
            </div>
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#111111] text-sm">紧凑显示</p>
              <p className="text-[#999999] text-xs">后续接入表格密度和列表间距；当前仅记录用户偏好。</p>
            </div>
            <Switch checked={compactMode} onCheckedChange={setCompactMode} />
          </div>
          <Button onClick={handleSaveLocalPreferences}>保存本地偏好</Button>
          {saved ? <span className="ml-3 text-[#00BA7C] text-sm inline-flex items-center gap-1.5"><CheckCircle className="w-4 h-4" />已保存</span> : null}
        </div>

        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 space-y-4">
          <h2 className="text-[#111111] font-semibold text-sm">账户操作</h2>
          <Button variant="outline" onClick={handleLogout} className="text-red-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200">
            <LogOut className="w-3.5 h-3.5 mr-1.5" />退出登录
          </Button>
        </div>
      </div>
    </div>
  );
}
