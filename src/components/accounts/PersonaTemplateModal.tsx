"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyPersonaTemplate, listPersonaTemplates, type BackendPersonaTemplate } from "@/lib/live-api";
import { getLiveSession } from "@/lib/session-client";

interface Props {
  accountIds: string[];
  onClose: () => void;
}

export default function PersonaTemplateModal({ accountIds, onClose }: Props) {
  const [personaTemplates, setPersonaTemplates] = useState<BackendPersonaTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState(false);
  const [appliedCount, setAppliedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      setLoading(true);
      setError(null);
      try {
        const session = await getLiveSession();
        const response = await listPersonaTemplates(session.selected_workspace.id);
        if (!cancelled) {
          setPersonaTemplates(response.templates);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "加载人格模板失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleApply = async () => {
    if (!selectedId) return;
    setApplying(true);
    setError(null);
    try {
      const session = await getLiveSession();
      const result = await applyPersonaTemplate(selectedId, {
        account_ids: accountIds,
        actor_id: session.user.id,
      });
      setAppliedCount(result.applied_count);
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "应用人格模板失败");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>套用人格模板</DialogTitle>
          <DialogDescription>为选中的 {accountIds.length} 个账号批量应用人格配置。</DialogDescription>
        </DialogHeader>

        {!done ? (
          <div className="space-y-3">
            {loading ? (
              <div className="py-8 text-center text-sm text-[#999999]">
                <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" />
                正在加载真实模板...
              </div>
            ) : null}
            {personaTemplates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => setSelectedId(tpl.id)}
                className={cn(
                  "w-full text-left p-4 rounded-xl border transition-colors",
                  selectedId === tpl.id
                    ? "border-[#CCCCCC] bg-black/5"
                    : "border-[#E8E8E8] hover:border-[#E0E0E0] bg-white"
                )}
              >
                <div className="flex items-start justify-between">
                  <p className="text-[#111111] font-medium text-sm">{tpl.name}</p>
                  {selectedId === tpl.id && <CheckCircle className="w-4 h-4 text-[#111111] flex-shrink-0" />}
                </div>
                <p className="text-[#999999] text-xs mt-1">{tpl.description}</p>
                <div className="flex gap-1 flex-wrap mt-2">
                  {tpl.persona.personality_traits.slice(0, 3).map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full bg-[#E8E8E8] text-[#999999] text-xs">{t}</span>
                  ))}
                </div>
              </button>
            ))}
            {!loading && personaTemplates.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#999999]">当前 workspace 还没有可用人格模板。</p>
            ) : null}
            {error ? <p className="text-sm text-[#D93025]">{error}</p> : null}

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={onClose}>取消</Button>
              <Button onClick={() => void handleApply()} disabled={!selectedId || applying}>
                {applying ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />应用中...</> : "应用模板"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 text-[#00BA7C]" />
            <p className="text-[#111111] font-medium">已为 {appliedCount} 个账号套用模板</p>
            <Button className="mt-4" onClick={onClose}>完成</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
