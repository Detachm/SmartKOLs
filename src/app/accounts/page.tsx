"use client";

import { Suspense, useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import AddAccountModal from "@/components/accounts/AddAccountModal";
import CsvImportModal from "@/components/accounts/CsvImportModal";
import PersonaTemplateModal from "@/components/accounts/PersonaTemplateModal";
import HealthCard from "@/components/accounts/HealthCard";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Upload, Search, Trash2, Users, Layers, ChevronRight, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  assignAccountsToGroup,
  createAccountGroup,
  deleteAccount,
  listAccountGroups,
  listAccounts,
  updatePersona,
  type BackendAccount,
  type BackendAccountGroup,
} from "@/lib/live-api";
import { getLiveSession } from "@/lib/session-client";

interface AccountRow {
  id: string;
  handle: string;
  displayName: string;
  avatarSeed: string;
  avatarUrl?: string;
  followersCount: number;
  tweetsCount: number;
  active: boolean;
  groupId?: string;
}

interface GroupRow {
  id: string;
  name: string;
  color: string;
}

function formatNumber(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

function mapAccount(account: BackendAccount): AccountRow {
  return {
    id: account.id,
    handle: account.handle,
    displayName: account.display_name,
    avatarSeed: account.handle.replace(/^@/, "") || account.avatar_url || "smartkols",
    avatarUrl: account.avatar_url,
    followersCount: account.follower_count,
    tweetsCount: account.post_count,
    active: account.status === "active",
    groupId: account.group_id,
  };
}

function mapGroup(group: BackendAccountGroup): GroupRow {
  return {
    id: group.id,
    name: group.name,
    color: group.color,
  };
}

function AccountsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newGroupName, setNewGroupName] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [hideConnectionBanner, setHideConnectionBanner] = useState(false);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const session = await getLiveSession();
      const currentWorkspaceId = session.selected_workspace.id;
      const [accountResponse, groupResponse] = await Promise.all([
        listAccounts(currentWorkspaceId),
        listAccountGroups(currentWorkspaceId),
      ]);

      setWorkspaceId(currentWorkspaceId);
      setAccounts(accountResponse.accounts.map(mapAccount));
      setGroups(groupResponse.groups.map((item) => mapGroup(item.group)));
    } catch (cause) {
      setAccounts([]);
      setGroups([]);
      setActionError(cause instanceof Error ? cause.message : "加载账号列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const connected = searchParams.get("connected") === "1";
  const connectedAccountId = searchParams.get("account_id");
  const connectedAccount = connectedAccountId
    ? accounts.find((account) => account.id === connectedAccountId)
    : undefined;

  useEffect(() => {
    if (connected && connectedAccountId && !loading) {
      router.replace(`/accounts/${connectedAccountId}/persona?connected=1`);
    }
  }, [connected, connectedAccountId, loading, router]);

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      const matchGroup = selectedGroup === null || a.groupId === selectedGroup || (selectedGroup === "ungrouped" && !a.groupId);
      const matchSearch = !search || a.handle.toLowerCase().includes(search.toLowerCase()) || a.displayName.toLowerCase().includes(search.toLowerCase());
      return matchGroup && matchSearch;
    });
  }, [accounts, selectedGroup, search]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((a) => a.id)));
    }
  };

  const handleDelete = async () => {
    const ids = Array.from(selected);
    setSelected(new Set());
    setActionError(null);
    const results = await Promise.allSettled(ids.map((id) => deleteAccount(id)));
    const failed = results.filter((result) => result.status === "rejected").length;
    if (failed > 0) {
      setActionError(`${failed} 个账号删除失败，请刷新后重试。`);
    }
    await loadAccounts();
  };

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return;
    if (!workspaceId) {
      setActionError("workspace 未就绪，暂时无法新建分组。");
      return;
    }
    setActionError(null);
    await createAccountGroup({
      workspace_id: workspaceId,
      name: newGroupName.trim(),
      color: "#555555",
    });
    setNewGroupName("");
    setAddingGroup(false);
    await loadAccounts();
  };

  const handleMoveSelectedToFirstGroup = async () => {
    const groupId = groups[0]?.id;
    if (!groupId) return;
    setActionError(null);
    await assignAccountsToGroup({ account_ids: Array.from(selected), group_id: groupId });
    setSelected(new Set());
    await loadAccounts();
  };

  const handleRandomizePersonas = async () => {
    const ids = Array.from(selected);
    setSelected(new Set());
    setActionError(null);
    const results = await Promise.allSettled(ids.map((id) => updatePersona(id, {
      workspace_id: workspaceId ?? "",
      gender: "male",
      nationality: "中国",
      age: 28,
      interests: ["AI", "Crypto", "Tech"],
      personality_traits: ["直接", "幽默", "分析型"],
      writing_style: "短句，观点鲜明",
      bio: "",
      distillation_sample_tweets: "",
      source: "manual",
      actor_type: "user",
    })));
    const failed = results.filter((result) => result.status === "rejected").length;
    if (failed > 0) {
      setActionError(`${failed} 个账号人格生成失败，请进入人格页单独处理。`);
    }
    await loadAccounts();
  };

  const groupCounts = useMemo(() => {
    const map: Record<string, number> = {};
    accounts.forEach((a) => {
      if (a.groupId) map[a.groupId] = (map[a.groupId] || 0) + 1;
    });
    return map;
  }, [accounts]);

  const ungroupedCount = accounts.filter((a) => !a.groupId).length;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Group Sidebar - Desktop only */}
      <aside data-tour="group-sidebar" className="hidden md:block w-52 border-r border-[#E8E8E8] flex-shrink-0 py-6 px-3 space-y-1">
        <p className="text-xs text-[#999999] uppercase tracking-wider px-3 mb-3">分组</p>
        <button
          onClick={() => setSelectedGroup(null)}
          className={cn("w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors", selectedGroup === null ? "bg-[#E8E8E8] text-[#111111]" : "text-[#999999] hover:text-[#333333] hover:bg-white")}
        >
          <span className="flex items-center gap-2"><Users className="w-3.5 h-3.5" />全部账号</span>
          <span className="text-xs">{accounts.length}</span>
        </button>
        {groups.map((g) => (
          <button
            key={g.id}
            onClick={() => setSelectedGroup(g.id)}
            className={cn("w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors", selectedGroup === g.id ? "bg-[#E8E8E8] text-[#111111]" : "text-[#999999] hover:text-[#333333] hover:bg-white")}
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
              {g.name}
            </span>
            <span className="text-xs">{groupCounts[g.id] || 0}</span>
          </button>
        ))}
        {ungroupedCount > 0 && (
          <button
            onClick={() => setSelectedGroup("ungrouped")}
            className={cn("w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors", selectedGroup === "ungrouped" ? "bg-[#E8E8E8] text-[#111111]" : "text-[#999999] hover:text-[#333333] hover:bg-white")}
          >
            <span className="flex items-center gap-2"><Layers className="w-3.5 h-3.5" />未分组</span>
            <span className="text-xs">{ungroupedCount}</span>
          </button>
        )}
        <div className="pt-2">
          {addingGroup ? (
            <div className="px-2 space-y-2">
              <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="分组名称" className="h-8 text-xs" onKeyDown={(e) => e.key === "Enter" && void handleAddGroup()} />
              <div className="flex gap-1">
                <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => void handleAddGroup()}>确认</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddingGroup(false)}>取消</Button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingGroup(true)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#999999] hover:text-[#333333] transition-colors">
              <Plus className="w-3 h-3" />新建分组
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 md:px-6 py-4 md:py-5 border-b border-[#E8E8E8] flex flex-wrap items-center gap-3">
          {/* Mobile Group Selector */}
          <select
            value={selectedGroup || "all"}
            onChange={(e) => setSelectedGroup(e.target.value === "all" ? null : e.target.value)}
            className="md:hidden text-sm bg-white border border-[#E8E8E8] rounded-lg px-2 py-2 text-[#111111] max-w-[140px]"
          >
            <option value="all">全部 ({accounts.length})</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name} ({groupCounts[g.id] || 0})</option>
            ))}
            {ungroupedCount > 0 && <option value="ungrouped">未分组 ({ungroupedCount})</option>}
          </select>
          <div className="relative flex-1 min-w-[140px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索账号..." className="pl-9" />
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCsv(true)}>
              <Upload className="w-4 h-4 md:mr-1.5" /><span className="hidden md:inline">批量导入</span>
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4 md:mr-1.5" /><span className="hidden md:inline">添加账号</span>
            </Button>
          </div>
        </div>

        {connected && !hideConnectionBanner ? (
          <div className="mx-6 mt-4 rounded-xl border border-[#D5F5E7] bg-[#F4FCF8] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#00BA7C]" />
                <div>
                  <p className="text-sm font-medium text-[#111111]">X 账号已绑定完成</p>
                  <p className="mt-1 text-xs text-[#666666]">
                    {connectedAccount
                      ? `已成功绑定 ${connectedAccount.displayName}（${connectedAccount.handle}），并完成 credential 校验与资料同步。`
                      : "已成功完成 credential 绑定、校验与资料同步。"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHideConnectionBanner(true);
                  router.replace("/accounts");
                }}
                className="text-[#999999] hover:text-[#333333]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        {actionError ? (
          <div className="mx-6 mt-4 rounded-xl border border-[#F5D3D0] bg-[#FFF5F4] px-4 py-3 text-sm text-[#D93025]">
            {actionError}
          </div>
        ) : null}

        {/* Bulk Action Bar */}
        {selected.size > 0 && (
          <div className="px-6 py-2.5 bg-black/5 border-b border-[#E8E8E8] flex items-center gap-3">
            <span className="text-[#111111] text-sm font-medium">已选中 {selected.size} 个账号</span>
            <div className="flex gap-2 ml-2">
              <Button size="sm" variant="outline" className="h-7 text-xs border-[#E0E0E0] text-[#111111] hover:bg-black/4" onClick={() => setShowTemplate(true)}>套用人格模板</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs border-[#E0E0E0] text-[#111111] hover:bg-black/4" onClick={() => void handleRandomizePersonas()}>随机生成人格</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs border-[#E0E0E0] text-[#999999]" onClick={() => {
                void handleMoveSelectedToFirstGroup();
              }}>移入分组</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:bg-red-900/20" onClick={() => void handleDelete()}>
                <Trash2 className="w-3.5 h-3.5 mr-1" />删除
              </Button>
            </div>
            <button className="ml-auto text-xs text-[#999999] hover:text-[#333333]" onClick={() => setSelected(new Set())}>取消选择</button>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-[#E8E8E8] text-[#999999] text-xs">
                <th className="pl-6 py-3 text-left w-10">
                  <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="accent-white cursor-pointer" />
                </th>
                <th className="py-3 text-left font-medium">账号</th>
                <th className="py-3 text-left font-medium">分组</th>
                <th className="py-3 text-left font-medium">状态</th>
                <th data-tour="health-column" className="py-3 text-left font-medium">健康</th>
                <th className="py-3 text-left font-medium">粉丝数</th>
                <th className="py-3 text-left font-medium">推文数</th>
                <th className="py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((account) => {
                const group = groups.find((g) => g.id === account.groupId);
                const isSelected = selected.has(account.id);
                return (
                  <tr key={account.id} className={cn("border-b border-[#E8E8E8]/50 hover:bg-white/50 transition-colors", isSelected && "bg-white/[0.04]")}>
                    <td className="pl-6 py-3">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(account.id)} className="accent-white cursor-pointer" />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <img src={account.avatarUrl || `https://unavatar.io/twitter/${account.avatarSeed}`} alt={account.displayName} className="w-8 h-8 rounded-full bg-[#E8E8E8] flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${account.avatarSeed}`; }} />
                        <div>
                          <p className="text-[#111111] font-medium text-sm">{account.displayName}</p>
                          <p className="text-[#999999] text-xs">{account.handle}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {group ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#999999]">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                          {group.name}
                        </span>
                      ) : (
                        <span className="text-xs text-[#999999]/50">未分组</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={account.active ? "success" : "secondary"}>
                        {account.active ? "运行中" : "已停用"}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <HealthCard accountId={account.id} compact />
                    </td>
                    <td className="py-3 pr-4 text-[#999999]">{formatNumber(account.followersCount)}</td>
                    <td className="py-3 pr-4 text-[#999999]">{formatNumber(account.tweetsCount)}</td>
                    <td className="py-3 pr-6">
                      <Link href={`/accounts/${account.id}/persona`}>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-[#111111] hover:text-[#999999] hover:bg-black/5 gap-1">
                          管理 <ChevronRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {loading && (
            <div className="text-center py-20 text-[#999999]">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">正在加载真实账号...</p>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-20 text-[#999999]">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search ? "没有匹配的账号" : "还没有账号"}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#E8E8E8] text-xs text-[#999999]">
          共 {accounts.length} 个账号 · 显示 {filtered.length} 个
        </div>
      </div>

      <AddAccountModal open={showAdd} onClose={() => { setShowAdd(false); void loadAccounts(); }} />
      <CsvImportModal open={showCsv} onClose={() => { setShowCsv(false); void loadAccounts(); }} />
      {showTemplate && (
        <PersonaTemplateModal
          accountIds={Array.from(selected)}
          onClose={() => { setShowTemplate(false); setSelected(new Set()); }}
        />
      )}
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[#999999]">正在加载账号管理...</div>}>
      <AccountsPageContent />
    </Suspense>
  );
}
