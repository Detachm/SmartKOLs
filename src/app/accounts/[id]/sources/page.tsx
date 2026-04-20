"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  createSource,
  deleteSourceWatchlist,
  executeSourceFetchRun,
  fetchSource,
  listAccountSourceDocuments,
  listSourceFetchRuns,
  listSourceWatchlists,
  listSources,
  pauseSource,
  removeSource,
  resumeSource,
  retrySourceFetchRun,
  upsertSourceWatchlist,
  type BackendAccountSourceDocumentItem,
  type BackendSource,
  type BackendSourceFetchRun,
  type BackendSourceWatchlist,
} from "@/lib/live-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Rss,
  Globe,
  AtSign,
  PlayCircle,
  BookOpen,
  Send,
  CheckCircle,
  RefreshCw,
  Files,
  Filter,
  ListFilter,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SOURCE_TYPE_ICONS: Record<string, React.ReactNode> = {
  rss: <Rss className="w-4 h-4" />,
  website: <Globe className="w-4 h-4" />,
  twitter: <AtSign className="w-4 h-4" />,
  youtube: <PlayCircle className="w-4 h-4" />,
  substack: <BookOpen className="w-4 h-4" />,
  telegram: <Send className="w-4 h-4" />,
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  rss: "RSS",
  website: "网站",
  twitter: "Twitter",
  youtube: "YouTube",
  substack: "Substack",
  telegram: "Telegram",
};

const SOURCE_TYPE_COLORS: Record<string, string> = {
  rss: "text-[#999999] bg-black/5",
  website: "text-sky-400 bg-sky-900/20",
  twitter: "text-blue-400 bg-blue-900/20",
  youtube: "text-red-400 bg-red-900/20",
  substack: "text-orange-400 bg-orange-900/20",
  telegram: "text-cyan-400 bg-cyan-900/20",
};

const PRESET_CATALOG = [
  { category: "加密/Web3", color: "#C8922A", sources: [
    { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", type: "rss" as const, domain: "coindesk.com" },
    { name: "CoinTelegraph", url: "https://cointelegraph.com", type: "rss" as const, domain: "cointelegraph.com" },
    { name: "The Block", url: "https://theblock.co", type: "rss" as const, domain: "theblock.co" },
    { name: "Decrypt", url: "https://decrypt.co", type: "rss" as const, domain: "decrypt.co" },
  ]},
  { category: "科技", color: "#4A9EDB", sources: [
    { name: "TechCrunch", url: "https://techcrunch.com", type: "rss" as const, domain: "techcrunch.com" },
    { name: "Hacker News", url: "https://news.ycombinator.com", type: "rss" as const, domain: "ycombinator.com" },
    { name: "The Verge", url: "https://theverge.com", type: "rss" as const, domain: "theverge.com" },
    { name: "Product Hunt", url: "https://producthunt.com", type: "website" as const, domain: "producthunt.com" },
  ]},
  { category: "AI / 研究", color: "#4CAF7D", sources: [
    { name: "OpenAI Blog", url: "https://openai.com/blog", type: "website" as const, domain: "openai.com" },
    { name: "Anthropic Blog", url: "https://anthropic.com/news", type: "website" as const, domain: "anthropic.com" },
    { name: "Alignment Forum", url: "https://alignmentforum.org", type: "website" as const, domain: "alignmentforum.org" },
    { name: "arXiv CS.AI", url: "https://arxiv.org/list/cs.AI/recent", type: "rss" as const, domain: "arxiv.org" },
  ]},
];

function formatTime(iso?: string) {
  if (!iso) return "从未";
  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function relativeTime(iso?: string) {
  if (!iso) return "暂无";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function hostnameOf(url: string) {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
  } catch {
    return url;
  }
}

export default function SourcesPage() {
  const params = useParams();
  const id = params.id as string;
  const [sources, setSources] = useState<BackendSource[]>([]);
  const [watchlists, setWatchlists] = useState<BackendSourceWatchlist[]>([]);
  const [documents, setDocuments] = useState<BackendAccountSourceDocumentItem[]>([]);
  const [runsBySourceId, setRunsBySourceId] = useState<Record<string, BackendSourceFetchRun[]>>({});
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newType, setNewType] = useState<BackendSource["type"]>("rss");
  const [watchlistName, setWatchlistName] = useState("");
  const [watchlistDescription, setWatchlistDescription] = useState("");
  const [watchlistQuery, setWatchlistQuery] = useState("");
  const [watchlistLimit, setWatchlistLimit] = useState("20");
  const [watchlistStatus, setWatchlistStatus] = useState<"active" | "paused">("active");
  const [watchlistSourceIds, setWatchlistSourceIds] = useState<string[]>([]);

  async function loadAll(selectedId?: string | null) {
    setLoading(true);
    try {
      const [sourceList, watchlistList, documentList] = await Promise.all([
        listSources(id),
        listSourceWatchlists(id),
        listAccountSourceDocuments(id, { limit: 120, query: query || undefined }),
      ]);

      const nextSources = sourceList.sources;
      const activeSelected = selectedId ?? selectedSourceId ?? nextSources[0]?.id ?? null;
      const runsEntries = await Promise.all(nextSources.map(async (source) => {
        const result = await listSourceFetchRuns(source.id).catch(() => ({ runs: [] }));
        return [source.id, result.runs] as const;
      }));

      setSources(nextSources);
      setWatchlists(watchlistList.watchlists);
      setDocuments(documentList.documents);
      setRunsBySourceId(Object.fromEntries(runsEntries));
      setSelectedSourceId(activeSelected && nextSources.some((source) => source.id === activeSelected) ? activeSelected : nextSources[0]?.id ?? null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载信息源失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [id]);

  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId) ?? null,
    [sources, selectedSourceId],
  );
  const selectedRuns = selectedSource ? (runsBySourceId[selectedSource.id] ?? []) : [];
  const selectedDocuments = selectedSource
    ? documents.filter((item) => item.source.id === selectedSource.id)
    : [];

  const sourceSummary = useMemo(() => ({
    active: sources.filter((source) => source.status === "active").length,
    errored: sources.filter((source) => source.status === "error").length,
    docs: documents.length,
  }), [sources, documents]);

  async function reloadAfterAction(preferSourceId?: string | null) {
    await loadAll(preferSourceId);
  }

  async function handleAddSource(payload: { name: string; url: string; type: BackendSource["type"] }) {
    setSubmitting(true);
    try {
      await createSource(id, payload);
      setShowAdd(false);
      setNewName("");
      setNewUrl("");
      setNewType("rss");
      await reloadAfterAction();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "添加信息源失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleSource(source: BackendSource) {
    setSubmitting(true);
    try {
      if (source.status === "active") {
        await pauseSource(source.id);
      } else {
        await resumeSource(source.id);
      }
      await reloadAfterAction(source.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "更新信息源状态失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFetch(sourceId: string) {
    setSubmitting(true);
    try {
      await fetchSource(sourceId);
      await reloadAfterAction(sourceId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "发起抓取失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetryRun(runId: string, sourceId: string) {
    setSubmitting(true);
    try {
      await retrySourceFetchRun(runId, { executeNow: true });
      await reloadAfterAction(sourceId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "重试抓取失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExecuteRun(runId: string, sourceId: string) {
    setSubmitting(true);
    try {
      await executeSourceFetchRun(runId);
      await reloadAfterAction(sourceId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "执行抓取失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteSource(sourceId: string) {
    setSubmitting(true);
    try {
      await removeSource(sourceId);
      await reloadAfterAction();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除信息源失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateWatchlist() {
    if (!watchlistName.trim()) return;
    setSubmitting(true);
    try {
      await upsertSourceWatchlist(id, {
        name: watchlistName.trim(),
        description: watchlistDescription.trim() || undefined,
        status: watchlistStatus,
        scope_body: {
          source_ids: watchlistSourceIds,
          source_types: [],
          preferred_source_ids: watchlistSourceIds,
          preferred_source_types: [],
          query: watchlistQuery.trim() || undefined,
          max_source_age_days: 30,
          limit: Number(watchlistLimit || "20"),
        },
      });
      setShowWatchlist(false);
      setWatchlistName("");
      setWatchlistDescription("");
      setWatchlistQuery("");
      setWatchlistLimit("20");
      setWatchlistStatus("active");
      setWatchlistSourceIds([]);
      await reloadAfterAction();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建 watchlist 失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteWatchlist(watchlistId: string) {
    setSubmitting(true);
    try {
      await deleteSourceWatchlist(id, watchlistId);
      await reloadAfterAction();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除 watchlist 失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#111111]">信息源管理</h2>
          <p className="text-[#999999] text-sm mt-1">把 source、抓取任务、抓取到的文档和 watchlist 放在同一个控制台里。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadAll()} disabled={loading || submitting}>
            <RefreshCw className={cn("w-4 h-4 mr-1.5", (loading || submitting) && "animate-spin")} />
            刷新
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCatalog(true)}>
            <Globe className="w-4 h-4 mr-1.5" />
            从预置库添加
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            自定义添加
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[#F1D0D0] bg-red-50 px-4 py-3 text-sm text-[#B04A4A]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
          <p className="text-[#999999] text-xs">信息源总数</p>
          <p className="text-[#111111] text-2xl font-bold mt-1">{sources.length}</p>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
          <p className="text-[#999999] text-xs">运行中</p>
          <p className="text-[#111111] text-2xl font-bold mt-1">{sourceSummary.active}</p>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
          <p className="text-[#999999] text-xs">已抓取文档</p>
          <p className="text-[#111111] text-2xl font-bold mt-1">{sourceSummary.docs}</p>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
          <p className="text-[#999999] text-xs">异常 source</p>
          <p className="text-[#111111] text-2xl font-bold mt-1">{sourceSummary.errored}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="space-y-6">
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[#111111] font-semibold text-sm">账号信息源</h3>
                <p className="text-[#999999] text-xs mt-1">每个 source 可以单独抓取、暂停、删除和查看抓取运行。</p>
              </div>
            </div>

            {loading ? (
              <div className="text-sm text-[#999999] py-10">正在加载 source...</div>
            ) : sources.length === 0 ? (
              <div className="text-center py-16 text-[#999999]">
                <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">还没有添加信息源</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sources.map((source) => {
                  const latestRun = (runsBySourceId[source.id] ?? [])[0];
                  const typeColor = SOURCE_TYPE_COLORS[source.type] || "text-[#999999] bg-[#E8E8E8]";
                  const selected = source.id === selectedSourceId;
                  return (
                    <div
                      key={source.id}
                      className={cn(
                        "rounded-xl border p-4 transition-colors",
                        selected ? "border-[#111111] bg-[#FAFAFA]" : "border-[#E8E8E8] bg-white hover:border-[#D5D5D5]",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => setSelectedSourceId(source.id)}
                          className="w-10 h-10 rounded-xl bg-[#E8E8E8] flex items-center justify-center flex-shrink-0 overflow-hidden"
                        >
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${hostnameOf(source.url)}&sz=64`}
                            alt=""
                            className="w-6 h-6"
                          />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[#111111] text-sm font-medium truncate">{source.name}</p>
                            <span className={cn("inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full", typeColor)}>
                              {SOURCE_TYPE_ICONS[source.type]}
                              {SOURCE_TYPE_LABELS[source.type]}
                            </span>
                          </div>
                          <p className="text-[#999999] text-xs truncate mt-1">{source.url}</p>
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-[#999999]">
                            <span>{source.status === "active" ? "运行中" : source.status === "paused" ? "已暂停" : "异常"}</span>
                            <span>上次抓取 {relativeTime(source.last_fetched_at)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch checked={source.status === "active"} onCheckedChange={() => void handleToggleSource(source)} />
                          <button
                            onClick={() => void handleFetch(source.id)}
                            className="inline-flex items-center gap-1 text-xs text-[#111111] hover:text-[#666666]"
                            disabled={submitting}
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            立即抓取
                          </button>
                        </div>
                        <button
                          onClick={() => void handleDeleteSource(source.id)}
                          className="text-[#999999] hover:text-red-400 transition-colors p-1"
                          disabled={submitting}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {latestRun && (
                        <div className="mt-3 rounded-lg bg-[#F7F7F7] px-3 py-2 text-[11px] text-[#666666]">
                          最近运行：{latestRun.status} · {formatTime(latestRun.started_at)}
                          {latestRun.error_message ? ` · ${latestRun.error_message}` : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[#111111] font-semibold text-sm">Watchlists</h3>
                <p className="text-[#999999] text-xs mt-1">给 brief / autopost 复用的信息源范围预设。</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowWatchlist(true)}>
                <ListFilter className="w-4 h-4 mr-1.5" />
                新建 watchlist
              </Button>
            </div>

            {watchlists.length === 0 ? (
              <div className="text-sm text-[#999999] py-6">还没有 watchlist。</div>
            ) : (
              <div className="space-y-3">
                {watchlists.map((watchlist) => (
                  <div key={watchlist.id} className="rounded-xl border border-[#E8E8E8] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-[#111111]">{watchlist.name}</p>
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[10px]",
                            watchlist.status === "active" ? "bg-green-50 text-[#00BA7C]" : "bg-[#F0F0F0] text-[#999999]",
                          )}>
                            {watchlist.status === "active" ? "启用" : "暂停"}
                          </span>
                        </div>
                        {watchlist.description && <p className="text-xs text-[#999999] mt-1">{watchlist.description}</p>}
                      </div>
                      <button onClick={() => void handleDeleteWatchlist(watchlist.id)} className="text-[#999999] hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-[#666666]">
                      <div className="rounded-lg bg-[#F7F7F7] px-3 py-2">source_ids: {watchlist.scope_body.source_ids.length}</div>
                      <div className="rounded-lg bg-[#F7F7F7] px-3 py-2">limit: {watchlist.scope_body.limit}</div>
                    </div>
                    {watchlist.scope_body.query && (
                      <div className="mt-2 rounded-lg bg-[#F7F7F7] px-3 py-2 text-[11px] text-[#666666]">
                        query: {watchlist.scope_body.query}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[#111111] font-semibold text-sm">抓取运行</h3>
                <p className="text-[#999999] text-xs mt-1">{selectedSource ? selectedSource.name : "选择一个 source 查看"} 的最近抓取任务。</p>
              </div>
            </div>

            {!selectedSource ? (
              <div className="text-sm text-[#999999] py-8">暂无已选择 source。</div>
            ) : selectedRuns.length === 0 ? (
              <div className="text-sm text-[#999999] py-8">这个 source 还没有抓取记录。</div>
            ) : (
              <div className="space-y-3">
                {selectedRuns.slice(0, 8).map((run) => (
                  <div key={run.id} className="rounded-xl border border-[#E8E8E8] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#111111]">{run.status}</p>
                        <p className="text-xs text-[#999999] mt-1">
                          开始于 {formatTime(run.started_at)} · 抓取 {run.fetched_count} 条
                        </p>
                        {run.error_message && (
                          <p className="text-xs text-[#B04A4A] mt-1">{run.error_message}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {run.status === "queued" && (
                          <Button size="sm" variant="outline" onClick={() => void handleExecuteRun(run.id, selectedSource.id)}>
                            执行
                          </Button>
                        )}
                        {run.status === "failed" && (
                          <Button size="sm" variant="outline" onClick={() => void handleRetryRun(run.id, selectedSource.id)}>
                            重试
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[#111111] font-semibold text-sm">已抓取文档</h3>
                <p className="text-[#999999] text-xs mt-1">这些文档会进入 trend / brief / draft 生成链路。</p>
              </div>
              <div className="relative w-56">
                <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="按标题或摘要过滤"
                  className="pl-8"
                />
              </div>
            </div>

            {selectedSource && selectedDocuments.length === 0 ? (
              <div className="text-sm text-[#999999] py-8">这个 source 还没有抓到文档。</div>
            ) : !selectedSource ? (
              <div className="text-sm text-[#999999] py-8">先选择一个 source 查看文档。</div>
            ) : (
              <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
                {selectedDocuments.slice(0, 20).map(({ document, source }) => (
                  <a
                    key={document.id}
                    href={document.canonical_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-[#E8E8E8] p-4 hover:border-[#D5D5D5]"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Files className="w-4 h-4 text-[#999999]" />
                      <span className="text-[11px] text-[#999999]">{source.name}</span>
                      <span className="text-[11px] text-[#999999]">·</span>
                      <span className="text-[11px] text-[#999999]">{formatTime(document.published_at || document.created_at)}</span>
                    </div>
                    <p className="text-sm font-medium text-[#111111]">{document.title}</p>
                    <p className="text-xs text-[#666666] mt-2 line-clamp-3">{document.summary}</p>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showAdd} onOpenChange={(value) => !value && setShowAdd(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>自定义添加信息源</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[#999999] mb-1.5 block">来源名称</label>
              <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="例如：TechCrunch" />
            </div>
            <div>
              <label className="text-xs text-[#999999] mb-1.5 block">URL 地址</label>
              <Input value={newUrl} onChange={(event) => setNewUrl(event.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label className="text-xs text-[#999999] mb-2 block">类型</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(SOURCE_TYPE_LABELS) as BackendSource["type"][]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setNewType(type)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-colors",
                      newType === type ? "border-[#CCCCCC] bg-black/5 text-[#111111]" : "border-[#E0E0E0] text-[#999999]",
                    )}
                  >
                    {SOURCE_TYPE_ICONS[type]}
                    {SOURCE_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>取消</Button>
              <Button onClick={() => void handleAddSource({ name: newName, url: newUrl, type: newType })} disabled={!newName || !newUrl || submitting}>
                添加
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCatalog} onOpenChange={(value) => !value && setShowCatalog(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>预置信息源库</DialogTitle></DialogHeader>
          <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-1">
            {PRESET_CATALOG.map(({ category, color, sources: presets }) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <p className="text-xs text-[#999999] uppercase tracking-wider font-medium">{category}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {presets.map((preset) => {
                    const already = sources.some((source) => source.url === preset.url);
                    return (
                      <div
                        key={preset.domain}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                          already ? "bg-white border-[#E0E0E0] opacity-60" : "bg-white border-[#E8E8E8] hover:border-[#E0E0E0]",
                        )}
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#E8E8E8] flex items-center justify-center flex-shrink-0 overflow-hidden">
                          <img src={`https://www.google.com/s2/favicons?domain=${preset.domain}&sz=64`} alt="" className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[#111111] text-xs font-medium">{preset.name}</p>
                          <p className="text-[#999999] text-[10px] truncate">{preset.domain}</p>
                        </div>
                        <button
                          onClick={() => void handleAddSource({ name: preset.name, url: preset.url, type: preset.type })}
                          disabled={already || submitting}
                          className={cn(
                            "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                            already ? "text-[#00BA7C]" : "text-[#999999] hover:text-[#333333] hover:bg-[#E0E0E0]",
                          )}
                        >
                          {already ? <CheckCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={() => setShowCatalog(false)} className="mt-2">关闭</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showWatchlist} onOpenChange={(value) => !value && setShowWatchlist(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>新建 Watchlist</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#999999] mb-1.5 block">名称</label>
                <Input value={watchlistName} onChange={(event) => setWatchlistName(event.target.value)} placeholder="例如：AI 英文一手源" />
              </div>
              <div>
                <label className="text-xs text-[#999999] mb-1.5 block">最大文档数</label>
                <Input value={watchlistLimit} onChange={(event) => setWatchlistLimit(event.target.value)} placeholder="20" />
              </div>
            </div>
            <div>
              <label className="text-xs text-[#999999] mb-1.5 block">描述</label>
              <Input value={watchlistDescription} onChange={(event) => setWatchlistDescription(event.target.value)} placeholder="给 recurring brief / autopost 复用" />
            </div>
            <div>
              <label className="text-xs text-[#999999] mb-1.5 block">查询词</label>
              <Input value={watchlistQuery} onChange={(event) => setWatchlistQuery(event.target.value)} placeholder="例如：openai agent benchmark" />
            </div>
            <div>
              <label className="text-xs text-[#999999] mb-2 block">绑定 source</label>
              <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto rounded-xl border border-[#E8E8E8] p-3">
                {sources.map((source) => {
                  const checked = watchlistSourceIds.includes(source.id);
                  return (
                    <label key={source.id} className="flex items-center gap-2 text-xs text-[#111111]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setWatchlistSourceIds((prev) => checked ? prev.filter((item) => item !== source.id) : [...prev, source.id])}
                      />
                      <span>{source.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-[#999999]">启用</label>
              <Switch checked={watchlistStatus === "active"} onCheckedChange={(checked) => setWatchlistStatus(checked ? "active" : "paused")} />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowWatchlist(false)}>取消</Button>
              <Button onClick={() => void handleCreateWatchlist()} disabled={!watchlistName || submitting}>
                创建
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
