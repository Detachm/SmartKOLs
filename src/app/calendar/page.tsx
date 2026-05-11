"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLiveSession } from "@/lib/session-client";
import { listSchedulesInRange, type ScheduleRangeResponse } from "@/lib/live-api";
import { Button } from "@/components/ui/button";

const DAY_NAMES_CN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

interface ScheduledPost {
  id: string;
  accountId: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  scheduledFor: string;
  time: string;
  topic: string;
  content: string;
  status: "scheduled" | "queued" | "published" | "failed" | "cancelled";
}

const STATUS_LABELS: Record<ScheduledPost["status"], string> = {
  scheduled: "已排程",
  queued: "待发布",
  published: "已发布",
  failed: "发布失败",
  cancelled: "已取消",
};

const STATUS_STYLES: Record<ScheduledPost["status"], string> = {
  scheduled: "bg-[#F3F3F3] text-[#666666]",
  queued: "bg-[#EAF7F1] text-[#00BA7C]",
  published: "bg-[#EEF5FF] text-[#3378FF]",
  failed: "bg-[#FFF1F1] text-[#D93025]",
  cancelled: "bg-[#F5F5F5] text-[#999999]",
};

function startOfWeek(input: Date) {
  const next = new Date(input);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function addDays(input: Date, days: number) {
  const next = new Date(input);
  next.setDate(next.getDate() + days);
  return next;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function toScheduledPost(item: ScheduleRangeResponse["schedules"][number]): ScheduledPost {
  return {
    id: item.schedule.id,
    accountId: item.account.id,
    handle: item.account.handle,
    displayName: item.account.display_name,
    avatarUrl: item.account.avatar_url,
    scheduledFor: item.schedule.scheduled_for,
    time: formatTime(item.schedule.scheduled_for),
    topic: item.draft.topic,
    content: item.current_version?.content ?? "当前草稿版本为空",
    status: item.schedule.status,
  };
}

export default function CalendarPage() {
  const [baseDate, setBaseDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const week = useMemo(() => {
    const start = startOfWeek(baseDate);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [baseDate]);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await getLiveSession();
      const from = week[0]?.toISOString();
      const to = addDays(week[6] ?? new Date(), 1).toISOString();
      const response = await listSchedulesInRange({
        workspaceId: session.selected_workspace.id,
        from,
        to,
        limit: 1000,
      });
      setScheduledPosts(
        response.schedules
          .map(toScheduledPost)
          .sort((left, right) => new Date(left.scheduledFor).getTime() - new Date(right.scheduledFor).getTime()),
      );
    } catch (cause) {
      setScheduledPosts([]);
      setError(cause instanceof Error ? cause.message : "加载发布日历失败");
    } finally {
      setLoading(false);
    }
  }, [week]);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  const getSchedule = (date: Date) =>
    scheduledPosts.filter((post) => new Date(post.scheduledFor).toDateString() === date.toDateString());

  const prevWeek = () => {
    setBaseDate((current) => addDays(current, -7));
  };

  const nextWeek = () => {
    setBaseDate((current) => addDays(current, 7));
  };

  const goToday = () => {
    const today = new Date();
    setBaseDate(today);
    setSelectedDay(today);
  };

  const todayStr = new Date().toDateString();
  const totalThisWeek = scheduledPosts.length;

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#111111] flex items-center gap-2">
            <CalendarDays className="w-6 h-6" />
            内容日历
          </h1>
          <p className="text-[#999999] text-sm mt-1">
            这里只展示已经真正进入发布排程的内容 · 本周共 {totalThisWeek} 条真实排期
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="p-2 rounded-lg hover:bg-[#F0F0F0] text-[#999999] hover:text-[#111111]">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={goToday} className="px-3 py-1.5 rounded-lg text-xs bg-white border border-[#E8E8E8] hover:bg-[#F7F7F7] text-[#111111]">
            今天
          </button>
          <button onClick={nextWeek} className="p-2 rounded-lg hover:bg-[#F0F0F0] text-[#999999] hover:text-[#111111]">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-[#F2D5D5] bg-[#FFF7F7] px-4 py-3 text-sm text-[#D93025]">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-7 gap-3 mb-6">
        {week.map((date, index) => {
          const schedule = getSchedule(date);
          const isToday = date.toDateString() === todayStr;
          const isSelected = selectedDay ? date.toDateString() === selectedDay.toDateString() : false;

          return (
            <button
              key={index}
              onClick={() => setSelectedDay(date)}
              className={cn(
                "bg-white border rounded-xl p-3 text-left transition-colors min-h-[180px] flex flex-col",
                isSelected ? "border-[#111111]" : "border-[#E8E8E8] hover:border-[#CCCCCC]",
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#999999]">{DAY_NAMES_CN[date.getDay()]}</span>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    isToday ? "text-white bg-[#111111] rounded-full w-6 h-6 flex items-center justify-center" : "text-[#111111]",
                  )}
                >
                  {date.getDate()}
                </span>
              </div>
              <div className="flex-1 space-y-1 overflow-hidden">
                {loading ? <div className="text-xs text-[#CCCCCC] pl-1.5 pt-1">加载中...</div> : null}
                {!loading && schedule.slice(0, 4).map((post) => (
                  <div key={post.id} className="flex items-center gap-1 text-xs bg-[#F7F7F7] rounded px-1.5 py-1">
                    <span className="text-[#999999] text-[10px]">{post.time}</span>
                    <span className="text-[#111111] truncate">{post.displayName}</span>
                  </div>
                ))}
                {!loading && schedule.length > 4 ? (
                  <div className="text-xs text-[#999999] pl-1.5">+{schedule.length - 4} 更多</div>
                ) : null}
                {!loading && schedule.length === 0 ? (
                  <div className="text-xs text-[#CCCCCC] pl-1.5 pt-1">暂无真实排期</div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-[#111111] font-semibold">
              {selectedDay.getMonth() + 1} 月 {selectedDay.getDate()} 日 · {DAY_NAMES_CN[selectedDay.getDay()]} 的真实排期
            </h2>
            <Button variant="outline" onClick={() => void loadSchedules()} disabled={loading}>
              {loading ? "刷新中..." : "刷新排期"}
            </Button>
          </div>
          <div className="space-y-3 max-w-3xl">
            {getSchedule(selectedDay).map((post) => (
              <div key={post.id} className="flex items-start gap-3 py-3 border-b border-[#E8E8E8] last:border-b-0">
                <div className="text-xs text-[#999999] w-14 flex-shrink-0 pt-1">{post.time}</div>
                <img
                  src={post.avatarUrl || `https://unavatar.io/twitter/${post.handle.replace(/^@/, "")}`}
                  alt=""
                  className="w-8 h-8 rounded-full bg-[#E8E8E8] flex-shrink-0"
                  onError={(event) => {
                    (event.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.handle.replace(/^@/, "")}`;
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[#111111] font-medium text-sm">{post.displayName}</span>
                    <span className="text-[#999999] text-xs">{post.handle}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[#F0F0F0] text-[#999999]">{post.topic}</span>
                    <span className={cn("text-xs px-1.5 py-0.5 rounded", STATUS_STYLES[post.status])}>
                      {STATUS_LABELS[post.status]}
                    </span>
                  </div>
                  <p className="text-[#111111] text-sm line-clamp-3">{post.content}</p>
                </div>
              </div>
            ))}
            {!loading && getSchedule(selectedDay).length === 0 ? (
              <p className="text-[#999999] text-sm text-center py-6">这一天没有真实进入发布队列的内容。</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
