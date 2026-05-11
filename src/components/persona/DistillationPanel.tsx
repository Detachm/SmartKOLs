"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { distillPersona } from "@/lib/live-api";

interface Props {
  accountId: string;
  onQueued: () => void | Promise<void>;
}

function normalizeTargetHandle(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const withoutOrigin = trimmed.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "");
  const withoutAt = withoutOrigin.replace(/^@/, "");
  return withoutAt.split(/[/?#]/)[0]?.trim() ?? "";
}

function buildManualSamples(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line, index, collection) => line !== "" && collection.indexOf(line) === index)
    .map((content) => ({
      kind: "post" as const,
      content,
    }));
}

export default function DistillationPanel({ accountId, onQueued }: Props) {
  const [targetHandle, setTargetHandle] = useState("");
  const [tweets, setTweets] = useState("");
  const [loading, setLoading] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalizedTargetHandle = normalizeTargetHandle(targetHandle);
  const canSubmit = normalizedTargetHandle !== "" || tweets.trim() !== "";

  const handleExtract = async () => {
    const samples = buildManualSamples(tweets);
    if (!normalizedTargetHandle && samples.length === 0) {
      setError("请输入目标账号，或粘贴至少一条推文样本。");
      setDoneMessage(null);
      return;
    }

    setLoading(true);
    setDoneMessage(null);
    setError(null);

    try {
      const result = await distillPersona(accountId, normalizedTargetHandle
        ? {
            twitter_handle: normalizedTargetHandle,
            max_samples: 100,
          }
        : {
            samples,
          });
      await onQueued();
      setDoneMessage(
        normalizedTargetHandle
          ? `人格蒸馏任务已排队（${result.task_id}）。完成后会写回当前账号人格，请稍后刷新。`
          : `样本蒸馏任务已排队（${result.task_id}）。完成后会写回当前账号人格，请稍后刷新。`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "人格蒸馏失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-[#111111]" />
          <h3 className="text-[#111111] font-semibold text-sm">人格蒸馏</h3>
        </div>
        <p className="text-[#999999] text-xs">
          输入目标 X 账号后，将抓取其最近 100 条推文并蒸馏后直接应用到当前账号；不填目标账号时，可改用手动样本兜底。
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm text-[#999999] block">目标账号</label>
        <Input
          value={targetHandle}
          onChange={(e) => {
            setTargetHandle(e.target.value);
            setDoneMessage(null);
            setError(null);
          }}
          placeholder="@handle 或 https://x.com/handle"
        />
        <p className="text-[11px] text-[#999999]">
          将复用当前账号已绑定的 X 凭证抓取目标账号时间线。
        </p>
      </div>

      <Textarea
        value={tweets}
        onChange={(e) => {
          setTweets(e.target.value);
          setDoneMessage(null);
          setError(null);
        }}
        placeholder={"不填目标账号时，可在此粘贴推文样本，每行一条...\n\n示例：\n刚上线了一个新功能\n大胆预测：大多数 SaaS 不过是有 UI 的 Excel\n..."}
        rows={8}
        className="text-xs"
      />

      {error ? (
        <p className="text-sm text-[#D93025]">{error}</p>
      ) : null}

      {doneMessage ? (
        <p className="text-sm text-[#00BA7C]">{doneMessage}</p>
      ) : null}

      <Button
        onClick={handleExtract}
        disabled={!canSubmit || loading}
        className="w-full"
        variant={doneMessage ? "secondary" : "default"}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {normalizedTargetHandle ? "正在抓取最近 100 条推文并蒸馏..." : "正在根据样本蒸馏人格..."}
          </>
        ) : doneMessage ? (
          "✓ 蒸馏完成"
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            {normalizedTargetHandle ? "抓取并蒸馏目标账号" : "从样本蒸馏人格"}
          </>
        )}
      </Button>
    </div>
  );
}
