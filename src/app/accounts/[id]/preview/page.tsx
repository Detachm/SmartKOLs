"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMockStore } from "@/lib/mock-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Heart, Repeat2, MessageCircle, Share, Files, Wand2 } from "lucide-react";
import {
  generateContentBrief,
  generateDraftFromContentBrief,
  getContentBrief,
  listAccountSourceDocuments,
  listDrafts,
  type BackendAccountSourceDocumentItem,
  type ContentBriefDetailResponse,
  type DraftListResponse,
} from "@/lib/live-api";
import { waitForAgentTask } from "@/lib/agent-task-client";

function formatTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function PreviewPage() {
  const params = useParams();
  const id = params.id as string;
  const { accounts } = useMockStore();
  const account = accounts.find((a) => a.id === id);
  const [documents, setDocuments] = useState<BackendAccountSourceDocumentItem[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [topicHint, setTopicHint] = useState("");
  const [angleHint, setAngleHint] = useState("");
  const [audience, setAudience] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<ContentBriefDetailResponse | null>(null);
  const [draft, setDraft] = useState<DraftListResponse["drafts"][number] | null>(null);

  async function loadDocuments(nextQuery?: string) {
    setLoading(true);
    try {
      const result = await listAccountSourceDocuments(id, {
        limit: 80,
        query: nextQuery?.trim() || undefined,
      });
      setDocuments(result.documents);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载 source 文档失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
  }, [id]);

  const selectedDocuments = useMemo(
    () => documents.filter((item) => selectedDocumentIds.includes(item.document.id)),
    [documents, selectedDocumentIds],
  );

  async function handleGenerate() {
    if (selectedDocumentIds.length === 0) {
      setError("先选择至少一篇 source 文档。");
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const briefResult = await generateContentBrief(id, {
        source_document_ids: selectedDocumentIds,
        topic_hint: topicHint.trim() || undefined,
        angle_hint: angleHint.trim() || undefined,
        audience: audience.trim() || undefined,
      });
      await waitForAgentTask(briefResult.task_id, { maxAttempts: 90, intervalMs: 2000 });
      const briefDetail = await getContentBrief(briefResult.brief_id);
      setBrief(briefDetail);

      const draftResult = await generateDraftFromContentBrief(briefResult.brief_id);
      await waitForAgentTask(draftResult.task_id, { maxAttempts: 90, intervalMs: 2000 });

      const drafts = await listDrafts({ accountId: id, limit: 20 });
      const nextDraft = [...drafts.drafts]
        .sort((a, b) => new Date(b.draft.created_at).getTime() - new Date(a.draft.created_at).getTime())
        .find((item) => item.draft.topic === briefDetail.brief.topic) ?? drafts.drafts[0] ?? null;
      setDraft(nextDraft);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "生成推文失败");
    } finally {
      setGenerating(false);
    }
  }

  if (!account) {
    return <div className="text-sm text-[#999999]">Account not found</div>;
  }

  const avatarSrc = `https://unavatar.io/twitter/${account.avatarSeed}`;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-[#111111] mb-1">AI 推文预览</h2>
        <p className="text-[#999999] text-sm">
          直接从各个信息源抓到的文档里选材料，生成 brief，再生成真实 draft。
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-[#F1D0D0] bg-red-50 px-4 py-3 text-sm text-[#B04A4A]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
        <div className="space-y-6">
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[#111111]">生成参数</h3>
                <p className="text-xs text-[#999999] mt-1">这些参数会参与 brief 生成，不再只是前端占位。</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#999999] mb-1.5 block">Topic Hint</label>
                <Input value={topicHint} onChange={(event) => setTopicHint(event.target.value)} placeholder="例如：OpenAI Agents 落地成本" />
              </div>
              <div>
                <label className="text-xs text-[#999999] mb-1.5 block">Angle Hint</label>
                <Input value={angleHint} onChange={(event) => setAngleHint(event.target.value)} placeholder="例如：不要复述发布会，要讲执行代价" />
              </div>
              <div>
                <label className="text-xs text-[#999999] mb-1.5 block">Audience</label>
                <Input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="例如：AI builder / operator" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[#111111]">选择 source 文档</h3>
                <p className="text-xs text-[#999999] mt-1">至少选 1 篇。选中的文档会直接进入 brief evidence。</p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索文档"
                  className="w-44"
                />
                <Button variant="outline" size="sm" onClick={() => void loadDocuments(query)}>
                  <Files className="w-4 h-4 mr-1.5" />
                  搜索
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="text-sm text-[#999999] py-8">正在加载文档...</div>
            ) : documents.length === 0 ? (
              <div className="text-sm text-[#999999] py-8">还没有抓取到可用文档，先去信息源页抓一轮。</div>
            ) : (
              <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
                {documents.map(({ document, source }) => {
                  const checked = selectedDocumentIds.includes(document.id);
                  return (
                    <label
                      key={document.id}
                      className={checked
                        ? "block rounded-xl border border-[#111111] bg-[#FAFAFA] p-4"
                        : "block rounded-xl border border-[#E8E8E8] bg-white p-4 hover:border-[#D5D5D5]"}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setSelectedDocumentIds((prev) => checked ? prev.filter((item) => item !== document.id) : [...prev, document.id])}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-[11px] text-[#999999]">
                            <span>{source.name}</span>
                            <span>·</span>
                            <span>{formatTime(document.published_at || document.created_at)}</span>
                          </div>
                          <p className="text-sm font-medium text-[#111111] mt-1">{document.title}</p>
                          <p className="text-xs text-[#666666] mt-2 line-clamp-3">{document.summary}</p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <Button onClick={handleGenerate} disabled={generating || selectedDocumentIds.length === 0} className="w-full">
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                正在生成 brief 和推文...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                基于已选文档生成推文
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#111111] mb-4">Brief</h3>
            {!brief ? (
              <div className="text-sm text-[#999999] py-6">生成后这里会显示真实 brief。</div>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-[11px] text-[#999999]">Topic</p>
                  <p className="text-[#111111] font-medium">{brief.brief.topic}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#999999]">Angle</p>
                  <p className="text-[#111111]">{brief.brief.angle}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#999999]">Audience</p>
                  <p className="text-[#111111]">{brief.brief.audience}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#999999]">Outline</p>
                  <p className="text-[#111111] whitespace-pre-line">{brief.brief.outline}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#999999]">Evidence</p>
                  <div className="mt-2 space-y-2">
                    {brief.evidence.map((item) => (
                      <div key={item.item.id} className="rounded-lg bg-[#F7F7F7] px-3 py-2 text-xs text-[#666666]">
                        <p className="font-medium text-[#111111]">{item.document.title}</p>
                        <p className="mt-1">{item.item.usage_reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white border border-[#E8E8E8] rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-[#111111] mb-4">Tweet Preview</h3>
            {!draft ? (
              <div className="text-sm text-[#999999] py-6">生成后这里会显示真实 draft 内容。</div>
            ) : (
              <>
                <div className="flex items-start gap-3 mb-3">
                  <img
                    src={avatarSrc}
                    onError={(event) => { (event.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${account.avatarSeed}`; }}
                    alt={account.displayName}
                    className="w-10 h-10 rounded-full bg-[#E8E8E8] flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[#111111] font-bold text-sm">{account.displayName}</span>
                      <span className="text-[#999999] text-sm">{account.handle}</span>
                      <span className="text-[#2a2a2a] text-sm">·</span>
                      <span className="text-[#999999] text-sm">{formatTime(draft.draft.created_at)}</span>
                    </div>
                    <p className="text-[#111111] text-sm mt-2 leading-relaxed whitespace-pre-line">
                      {draft.current_version?.content}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[#999999] pt-3 border-t border-[#E8E8E8]">
                  <button className="flex items-center gap-1.5 hover:text-blue-400 transition-colors text-xs">
                    <MessageCircle className="w-4 h-4" />
                    <span>12</span>
                  </button>
                  <button className="flex items-center gap-1.5 hover:text-green-400 transition-colors text-xs">
                    <Repeat2 className="w-4 h-4" />
                    <span>48</span>
                  </button>
                  <button className="flex items-center gap-1.5 hover:text-red-400 transition-colors text-xs">
                    <Heart className="w-4 h-4" />
                    <span>203</span>
                  </button>
                  <button className="flex items-center gap-1.5 hover:text-blue-400 transition-colors text-xs">
                    <Share className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>

          {selectedDocuments.length > 0 && (
            <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[#111111] mb-3">当前已选文档</h3>
              <div className="space-y-2">
                {selectedDocuments.map((item) => (
                  <div key={item.document.id} className="rounded-lg bg-[#F7F7F7] px-3 py-2 text-xs text-[#666666]">
                    <p className="font-medium text-[#111111]">{item.document.title}</p>
                    <p className="mt-1">{item.source.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
