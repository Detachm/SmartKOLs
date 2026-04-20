"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { TrendingUp, Shield, ShieldAlert, BarChart3, FileText, Send, Database, AlertTriangle } from "lucide-react";
import { getAccountAnalytics, type AccountAnalyticsResponse } from "@/lib/live-api";

function formatNumber(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const WEEKDAY_LABEL: Record<AccountAnalyticsResponse["publish_heatmap"][number]["weekday_code"], string> = {
  mon: "周一",
  tue: "周二",
  wed: "周三",
  thu: "周四",
  fri: "周五",
  sat: "周六",
  sun: "周日",
};

export default function AnalyticsPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<AccountAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const result = await getAccountAnalytics(id, 30);
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "加载账号分析失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const chart = useMemo(() => {
    if (!data || data.daily_activity.length === 0) return null;
    const points = data.daily_activity;
    const chartWidth = 720;
    const chartHeight = 220;
    const maxValue = Math.max(1, ...points.map((point) => point.drafts_created + point.posts_published + point.source_documents));
    const polyline = points.map((point, index) => {
      const total = point.drafts_created + point.posts_published + point.source_documents;
      const x = (index / Math.max(1, points.length - 1)) * chartWidth;
      const y = chartHeight - (total / maxValue) * (chartHeight - 24) - 12;
      return `${x},${y}`;
    }).join(" ");

    return { points, chartWidth, chartHeight, maxValue, polyline };
  }, [data]);

  const heatmapRows = useMemo(() => {
    if (!data) return [];
    return (["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((weekday) => ({
      weekday,
      hours: Array.from({ length: 24 }, (_, hour) => data.publish_heatmap.find((point) => point.weekday_code === weekday && point.hour === hour)?.published_posts ?? 0),
    }));
  }, [data]);

  if (loading) {
    return <div className="text-sm text-[#999999]">正在加载真实数据...</div>;
  }

  if (error || !data) {
    return <div className="rounded-xl border border-[#F1D0D0] bg-red-50 px-4 py-3 text-sm text-[#B04A4A]">{error || "加载失败"}</div>;
  }

  const maxHeat = Math.max(1, ...heatmapRows.flatMap((row) => row.hours));
  const riskLevel = data.summary.current_risk_level;
  const HealthIcon = riskLevel === "high" ? ShieldAlert : Shield;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-[#111111] mb-1 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          数据分析
        </h2>
        <p className="text-[#999999] text-sm">基于真实 drafts / publish / source / connector 数据的 30 天分析。</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-[#999999] text-xs">草稿数</span>
            <FileText className="w-4 h-4 text-[#999999]" />
          </div>
          <p className="text-[#111111] text-2xl font-bold mt-2">{formatNumber(data.summary.drafts_created)}</p>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-[#999999] text-xs">批准率</span>
            <TrendingUp className="w-4 h-4 text-[#00BA7C]" />
          </div>
          <p className="text-[#111111] text-2xl font-bold mt-2">{data.summary.approval_rate !== undefined ? `${Math.round(data.summary.approval_rate * 100)}%` : "-"}</p>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-[#999999] text-xs">已发布</span>
            <Send className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-[#111111] text-2xl font-bold mt-2">{formatNumber(data.summary.posts_published)}</p>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-[#999999] text-xs">Source 文档</span>
            <Database className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-[#111111] text-2xl font-bold mt-2">{formatNumber(data.summary.source_documents)}</p>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-[#999999] text-xs">连接器失败</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-[#111111] text-2xl font-bold mt-2">{formatNumber(data.summary.connector_failures)}</p>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-[#999999] text-xs">当前健康分</span>
            <HealthIcon className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-[#111111] text-2xl font-bold mt-2">{data.summary.current_health_score ?? "-"}</p>
        </div>
      </div>

      <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
        <h3 className="text-[#111111] font-semibold text-sm mb-4">每日活动趋势</h3>
        {!chart ? (
          <div className="text-sm text-[#999999] py-6">这个时间窗口内还没有可视化数据。</div>
        ) : (
          <>
            <svg viewBox={`0 0 ${chart.chartWidth} ${chart.chartHeight + 20}`} className="w-full h-auto">
              <defs>
                <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#111111" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#111111" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon fill="url(#activityGradient)" points={`0,${chart.chartHeight} ${chart.polyline} ${chart.chartWidth},${chart.chartHeight}`} />
              <polyline fill="none" stroke="#111111" strokeWidth="2" points={chart.polyline} />
            </svg>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              {chart.points.slice(-3).map((point) => (
                <div key={point.date} className="rounded-lg bg-[#F7F7F7] px-3 py-3">
                  <p className="text-[#999999]">{point.date}</p>
                  <p className="text-[#111111] font-medium mt-1">
                    草稿 {point.drafts_created} / 发布 {point.posts_published} / 文档 {point.source_documents}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
        <h3 className="text-[#111111] font-semibold text-sm mb-4">发帖热力图</h3>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="w-14" />
                {Array.from({ length: 24 }, (_, hour) => (
                  <th key={hour} className="text-center text-[#999999] font-normal w-6 text-[10px]">{hour}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapRows.map((row) => (
                <tr key={row.weekday}>
                  <td className="text-[#999999] text-xs pr-2">{WEEKDAY_LABEL[row.weekday]}</td>
                  {row.hours.map((value, hour) => {
                    const intensity = value / maxHeat;
                    return (
                      <td key={hour} className="p-0.5">
                        <div
                          className="w-5 h-5 rounded"
                          style={{ backgroundColor: `rgba(17, 17, 17, ${intensity * 0.85 + 0.05})` }}
                          title={`${WEEKDAY_LABEL[row.weekday]} ${hour}:00 · ${value} 条`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
          <h3 className="text-[#111111] font-semibold text-sm mb-4">最近已发布内容</h3>
          {data.recent_published_posts.length === 0 ? (
            <div className="text-sm text-[#999999] py-6">近 30 天还没有已发布内容。</div>
          ) : (
            <div className="space-y-3">
              {data.recent_published_posts.map((post) => (
                <a
                  key={post.id}
                  href={post.external_post_url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-[#E8E8E8] p-4 hover:border-[#D5D5D5]"
                >
                  <p className="text-sm text-[#111111] whitespace-pre-line">{post.content}</p>
                  <p className="text-xs text-[#999999] mt-2">{formatTime(post.published_at)}</p>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
          <h3 className="text-[#111111] font-semibold text-sm mb-4">最近连接器失败</h3>
          {data.recent_connector_failures.length === 0 ? (
            <div className="text-sm text-[#999999] py-6">近 30 天没有 connector failure。</div>
          ) : (
            <div className="space-y-3">
              {data.recent_connector_failures.map((failure) => (
                <div key={failure.id} className="rounded-xl border border-[#F1D0D0] bg-red-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[#111111]">{failure.endpoint_code}</p>
                    <span className="text-[11px] text-[#999999]">{formatTime(failure.started_at)}</span>
                  </div>
                  <p className="text-xs text-[#B04A4A] mt-2">{failure.error_message || failure.error_code || "unknown error"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
