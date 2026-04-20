"use client";

import { useState, useMemo } from "react";
import { useMockStore, Draft } from "@/lib/mock-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, X, RefreshCw, Edit2, FileText, Filter, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "pending" | "approved" | "rejected";

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isPlaceholderDraft(draft: Draft) {
  return draft.id.startsWith("temp-") || draft.content.startsWith("正在基于「");
}

export default function DraftsPage() {
  const { drafts, accounts, approveDraft, rejectDraft, regenerateDraft, editDraft } = useMockStore();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [pendingDraftId, setPendingDraftId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | "regenerate" | "save" | null>(null);

  const filtered = useMemo(() => {
    return drafts
      .filter((d) => filter === "all" || d.status === filter)
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }, [drafts, filter]);

  const counts = useMemo(() => ({
    all: drafts.length,
    pending: drafts.filter((d) => d.status === "pending").length,
    approved: drafts.filter((d) => d.status === "approved").length,
    rejected: drafts.filter((d) => d.status === "rejected").length,
  }), [drafts]);

  const getAccount = (id: string) => accounts.find((a) => a.id === id);

  const startEdit = (d: Draft) => {
    setEditingId(d.id);
    setEditingContent(d.content);
  };

  const saveEdit = () => {
    if (!editingId) return;
    setPendingDraftId(editingId);
    setPendingAction("save");
    editDraft(editingId, editingContent);
    setEditingId(null);
    setTimeout(() => {
      setPendingDraftId((current) => (current === editingId ? null : current));
      setPendingAction((current) => (current === "save" ? null : current));
    }, 1200);
  };

  function runDraftAction(draftId: string, action: "approve" | "reject" | "regenerate", fn: () => void) {
    setPendingDraftId(draftId);
    setPendingAction(action);
    fn();
    setTimeout(() => {
      setPendingDraftId((current) => (current === draftId ? null : current));
      setPendingAction((current) => (current === action ? null : current));
    }, 1200);
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#111111] flex items-center gap-2">
          <FileText className="w-6 h-6" />
          内容审核
        </h1>
        <p className="text-[#999999] text-sm mt-1">AI 生成的推文草稿，待批准后才会进入发布排期</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 border-b border-[#E8E8E8] pb-0">
        {(["all", "pending", "approved", "rejected"] as StatusFilter[]).map((key) => {
          const labels = { all: "全部", pending: "待审核", approved: "已批准", rejected: "已拒绝" };
          const isActive = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                isActive ? "border-[#111111] text-[#111111]" : "border-transparent text-[#999999] hover:text-[#333333]"
              )}
            >
              {labels[key]} <span className="text-xs ml-1">({counts[key]})</span>
            </button>
          );
        })}
      </div>

      {/* Drafts List */}
      <div className="space-y-3 max-w-3xl">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-[#999999]">
            <Filter className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">这个分类下暂无草稿</p>
          </div>
        )}

        {filtered.map((draft) => {
          const account = getAccount(draft.accountId);
          const placeholder = isPlaceholderDraft(draft);
          const isEditing = editingId === draft.id;
          const isPendingAction = pendingDraftId === draft.id;
          return (
            <div key={draft.id} className="bg-white border border-[#E8E8E8] rounded-xl p-5">
              {/* Header */}
              <div className="flex items-start gap-3 mb-3">
                <img
                  src={`https://unavatar.io/twitter/${account?.avatarSeed}`}
                  alt=""
                  className="w-9 h-9 rounded-full bg-[#E8E8E8]"
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${account?.avatarSeed}`; }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[#111111] font-semibold text-sm">{account?.displayName || "Unknown"}</span>
                    <span className="text-[#999999] text-xs">{account?.handle}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#999999] mt-0.5">
                    <span>话题：{draft.topic}</span>
                    <span>·</span>
                    <span>计划 {formatTime(draft.scheduledTime)}</span>
                  </div>
                </div>
                <Badge
                  variant={placeholder ? "secondary" : draft.status === "pending" ? "secondary" : draft.status === "approved" ? "success" : "spam"}
                  className="text-xs"
                >
                  {placeholder ? "生成中" : draft.status === "pending" ? "待审核" : draft.status === "approved" ? "已批准" : "已拒绝"}
                </Badge>
              </div>

              {/* Content */}
              {isEditing ? (
                <Textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  rows={3}
                  className="mb-3"
                />
              ) : placeholder ? (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-[#F7F7F7] px-3 py-3 text-sm text-[#666666]">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  <span>{draft.content}</span>
                </div>
              ) : (
                <p className="text-[#111111] text-sm leading-relaxed mb-4 whitespace-pre-line">{draft.content}</p>
              )}

              {/* Actions */}
              {draft.status === "pending" && !placeholder && (
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button size="sm" onClick={saveEdit} disabled={isPendingAction}>
                        {isPendingAction && pendingAction === "save" ? <LoaderCircle className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                        保存
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={isPendingAction}>取消</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" onClick={() => runDraftAction(draft.id, "approve", () => approveDraft(draft.id))} disabled={isPendingAction}>
                        {isPendingAction && pendingAction === "approve" ? <LoaderCircle className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}批准
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startEdit(draft)} disabled={isPendingAction}>
                        <Edit2 className="w-3.5 h-3.5 mr-1" />编辑
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => runDraftAction(draft.id, "regenerate", () => regenerateDraft(draft.id))} disabled={isPendingAction}>
                        {isPendingAction && pendingAction === "regenerate" ? <LoaderCircle className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}重新生成
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => runDraftAction(draft.id, "reject", () => rejectDraft(draft.id))} className="text-red-500 hover:text-red-600 hover:bg-red-50" disabled={isPendingAction}>
                        {isPendingAction && pendingAction === "reject" ? <LoaderCircle className="w-3.5 h-3.5 mr-1 animate-spin" /> : <X className="w-3.5 h-3.5 mr-1" />}拒绝
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
