"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, FileText, Flame, HeartPulse, Sparkles, TrendingUp, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getDashboardOverview,
  getMonitoringOverview,
  type BackendMonitoringOperatorQueueItem,
  type DashboardOverviewResponse,
  type MonitoringOverviewResponse,
} from "@/lib/live-api";
import { getLiveSession } from "@/lib/session-client";

function formatNumber(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function getHealthLabel(status?: MonitoringOverviewResponse["summary"]["operations_health_status"]) {
  switch (status) {
    case "healthy":
      return "健康";
    case "degraded":
      return "降级";
    case "unhealthy":
      return "异常";
    default:
      return "未知";
  }
}

function getHealthTone(status?: MonitoringOverviewResponse["summary"]["operations_health_status"]) {
  switch (status) {
    case "healthy":
      return "text-[#00BA7C]";
    case "degraded":
      return "text-[#C58A00]";
    case "unhealthy":
      return "text-[#D93025]";
    default:
      return "text-[#999999]";
  }
}

function getQueueItemHref(item: BackendMonitoringOperatorQueueItem) {
  if (item.target_url) {
    return item.target_url;
  }

  if (item.account_id) {
    return `/accounts/${item.account_id}/preview`;
  }

  return "/monitoring";
}

function getQueueStatusLabel(status: BackendMonitoringOperatorQueueItem["status"]) {
  switch (status) {
    case "failed":
      return "失败待处理";
    case "running":
      return "运行中";
    case "queued":
      return "排队中";
    case "cancelled":
      return "已取消";
    default:
      return status;
  }
}

function getQueueStatusTone(status: BackendMonitoringOperatorQueueItem["status"]) {
  switch (status) {
    case "failed":
      return "border-[#F5D3D0] bg-[#FFF5F4] text-[#D93025]";
    case "running":
      return "border-[#D7E7F7] bg-[#F5FAFF] text-[#245A8D]";
    case "queued":
      return "border-[#F3E6C7] bg-[#FFF9EF] text-[#C58A00]";
    default:
      return "border-[#E8E8E8] bg-[#FAFAFA] text-[#777777]";
  }
}

function getQueueErrorCategoryLabel(category?: BackendMonitoringOperatorQueueItem["error_category"]) {
  switch (category) {
    case "configuration_error":
      return "配置问题";
    case "temporary_external_error":
      return "外部临时异常";
    case "rate_limited":
      return "平台限流";
    case "operator_required":
      return "需要人工处理";
    case "system_failure":
      return "系统异常";
    default:
      return undefined;
  }
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardOverviewResponse | null>(null);
  const [monitoring, setMonitoring] = useState<MonitoringOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await getLiveSession();
      const workspaceId = session.selected_workspace.id;
      const [dashboardResponse, monitoringResponse] = await Promise.all([
        getDashboardOverview(workspaceId),
        getMonitoringOverview(workspaceId, 8),
      ]);
      setDashboard(dashboardResponse);
      setMonitoring(monitoringResponse);
    } catch (cause) {
      setDashboard(null);
      setMonitoring(null);
      setError(cause instanceof Error ? cause.message : "加载概览失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const summary = dashboard?.summary;
  const healthStatus = monitoring?.summary.operations_health_status;
  const failedQueueItems = monitoring?.summary.failed_queue_items ?? 0;
  const primaryQueueItems = monitoring?.operator_queues.slice(0, 3) ?? [];
  const stats = [
    {
      label: "总账号数",
      value: formatNumber(summary?.total_accounts ?? 0),
      sub: `${summary?.active_accounts ?? 0} 个运行中`,
      icon: Users,
      color: "text-[#111111]",
      href: "/accounts",
    },
    {
      label: "总粉丝数",
      value: formatNumber(summary?.total_followers ?? 0),
      sub: "跨所有账号",
      icon: TrendingUp,
      color: "text-[#00BA7C]",
      href: "/accounts",
    },
    {
      label: "待审核草稿",
      value: formatNumber(summary?.pending_drafts ?? 0),
      sub: "需要 operator 处理",
      icon: FileText,
      color: "text-orange-500",
      href: "/drafts?status=pending",
    },
    {
      label: "活跃趋势",
      value: formatNumber(summary?.active_trends ?? 0),
      sub: "来自真实 source documents",
      icon: Flame,
      color: "text-orange-500",
      href: "#trends",
    },
    {
      label: "未读通知",
      value: formatNumber(summary?.unread_notifications ?? monitoring?.summary.unread_notifications ?? 0),
      sub: `${monitoring?.summary.alert_items ?? 0} 条监控 feed`,
      icon: Bell,
      color: "text-[#999999]",
      href: "/monitoring",
    },
    {
      label: "运行健康",
      value: getHealthLabel(healthStatus),
      sub: failedQueueItems > 0 ? `${failedQueueItems} 个失败队列项` : `${monitoring?.summary.stale_processes ?? 0} 个 stale process`,
      icon: HeartPulse,
      color: getHealthTone(healthStatus),
      href: "/monitoring?tab=diagnostics",
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">概览</h1>
          <p className="text-[#999999] text-sm mt-1">真实运行态总览：账号、内容、趋势、队列和系统健康。</p>
        </div>
        <Button variant="outline" onClick={() => void loadDashboard()} disabled={loading}>
          {loading ? "刷新中..." : "刷新"}
        </Button>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-[#F5D3D0] bg-[#FFF5F4] px-4 py-3 text-sm text-[#D93025]">
          {error}
        </div>
      ) : null}

      <div className="mb-8 rounded-2xl border border-[#E8E8E8] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#C58A00]" />
              <h2 className="text-sm font-semibold text-[#111111]">现在需要处理什么</h2>
            </div>
            <p className="mt-1 text-xs text-[#999999]">
              Dashboard 第一屏只放会影响自动化闭环的事项：失败队列、排队积压、运行异常和需要人工处理的任务。
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/monitoring">进入监控中心</Link>
          </Button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {primaryQueueItems.map((item) => (
            <Link
              key={`${item.kind}:${item.id}`}
              href={getQueueItemHref(item)}
              className="rounded-xl border border-[#E8E8E8] bg-[#FAFAFA] p-4 transition-colors hover:border-[#CCCCCC] hover:bg-white"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${getQueueStatusTone(item.status)}`}>
                  {getQueueStatusLabel(item.status)}
                </span>
                <span className="text-[10px] text-[#999999]">{formatTimeAgo(item.created_at)}</span>
              </div>
              <p className="line-clamp-1 text-sm font-semibold text-[#111111]">{item.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-[#666666]">{item.subtitle}</p>
              <p className="mt-2 text-[11px] font-medium text-[#111111]">{item.blocking_chain}</p>
              {item.error_category ? (
                <p className="mt-2 text-[11px] font-medium text-[#D07800]">
                  {getQueueErrorCategoryLabel(item.error_category)}
                  {item.auto_retry_recommended ? " · 可等待系统重试" : " · 需先处理条件"}
                </p>
              ) : null}
              <p className="mt-3 text-[11px] text-[#999999]">
                {item.error_user_message ?? item.recommended_action}
              </p>
            </Link>
          ))}

          {!loading && primaryQueueItems.length === 0 ? (
            <div className="rounded-xl border border-[#D7F3E6] bg-[#F4FCF8] p-4 lg:col-span-3">
              <p className="text-sm font-semibold text-[#00BA7C]">当前没有待处理队列项</p>
              <p className="mt-1 text-xs text-[#666666]">
                后台 worker 会继续自动抓取信息源、刷新趋势并推进账号编排；你只需要在这里处理异常和审核类事项。
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        {stats.map(({ label, value, sub, icon: Icon, color, href }) => (
          <Link key={label} href={href} className="bg-white border border-[#E8E8E8] rounded-xl p-5 transition-colors hover:border-[#CCCCCC]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#999999] text-xs">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-[#111111] text-2xl font-bold">{loading ? "..." : value}</p>
            <p className="text-[#999999] text-xs mt-1">{sub}</p>
          </Link>
        ))}
      </div>

      <div id="trends" className="bg-white border border-[#E8E8E8] rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-4 h-4 text-orange-500" />
          <h2 className="text-[#111111] font-semibold text-sm">活跃趋势信号</h2>
          <span className="text-xs text-[#999999]">· 当前只展示信号，生成内容应走 brief-first 链路</span>
        </div>
        {dashboard?.trends.length ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {dashboard.trends.slice(0, 10).map((trend) => (
              <div
                key={trend.id}
                className="text-left bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#999999] uppercase">{trend.category}</span>
                  <div className="flex items-center gap-1 text-xs text-orange-500">
                    <Flame className="w-3 h-3" />
                    {Math.round(trend.score * 100)}
                  </div>
                </div>
                <p className="text-[#111111] text-xs font-medium line-clamp-2">{trend.topic}</p>
                <p className="mt-2 text-[10px] text-[#999999] line-clamp-2">
                  来源 {trend.source_count ?? trend.sources?.length ?? 0} · 账号 {trend.account_count ?? 0}
                </p>
                <p className="mt-2 text-[10px] text-[#666666]">
                  在账号推文预览页选择趋势后生成 Brief
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] px-4 py-6 text-sm text-[#777777]">
            还没有活跃趋势。先为账号配置并抓取 source，系统才能从文档中提取信号。
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[#111111] font-semibold text-sm">最近账号</h2>
            <Link href="/accounts" className="text-xs text-[#111111] hover:text-[#999999] flex items-center gap-1">
              查看全部 <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {dashboard?.recent_accounts.slice(0, 5).map((account) => {
              const avatarSeed = account.handle.replace(/^@/, "") || account.avatar_url || "smartkols";
              return (
                <Link key={account.id} href={`/accounts/${account.id}/preview`} className="flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-[#FAFAFA]">
                  <img
                    src={account.avatar_url || `https://unavatar.io/twitter/${avatarSeed}`}
                    className="w-8 h-8 rounded-full bg-[#E8E8E8]"
                    alt=""
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[#111111] text-sm font-medium truncate">{account.display_name}</p>
                    <p className="text-[#999999] text-xs">{account.handle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#999999]">{formatNumber(account.follower_count)}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${account.status === "active" ? "bg-[#00BA7C]" : "bg-[#E0E0E0]"}`} />
                  </div>
                </Link>
              );
            })}
            {!loading && !dashboard?.recent_accounts.length ? (
              <p className="text-sm text-[#999999]">还没有账号。</p>
            ) : null}
          </div>
        </div>

        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[#111111] font-semibold text-sm">Operator Queue / 最新运行信号</h2>
            <Link href="/monitoring" className="text-xs text-[#111111] hover:text-[#999999] flex items-center gap-1">
              查看全部 <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {monitoring?.operator_queues.slice(0, 5).map((item) => (
              <Link key={`${item.kind}:${item.id}`} href={getQueueItemHref(item)} className="flex items-start gap-3 rounded-lg p-1 transition-colors hover:bg-[#FAFAFA]">
                <Zap className="mt-0.5 h-4 w-4 text-[#C58A00]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[#111111] text-xs font-medium">{item.title}</p>
                  <p className="text-[#999999] text-xs truncate">{item.subtitle}</p>
                </div>
                <span className="text-[10px] text-[#999999]">{formatTimeAgo(item.created_at)}</span>
              </Link>
            ))}
            {monitoring && monitoring.operator_queues.length === 0 ? monitoring.feed.slice(0, 5).map((item) => (
              <Link key={item.id} href="/monitoring" className="flex items-start gap-3 rounded-lg p-1 transition-colors hover:bg-[#FAFAFA]">
                <Sparkles className="mt-0.5 h-4 w-4 text-[#999999]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[#111111] text-xs font-medium">{item.title}</p>
                  <p className="text-[#999999] text-xs truncate">{item.detail}</p>
                </div>
                <span className="text-[10px] text-[#999999]">{formatTimeAgo(item.created_at)}</span>
              </Link>
            )) : null}
            {!loading && monitoring?.operator_queues.length === 0 && monitoring.feed.length === 0 ? (
              <p className="text-sm text-[#999999]">暂无需要处理的运行事项。</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
