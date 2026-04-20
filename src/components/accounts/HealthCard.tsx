"use client";

import { useEffect, useState } from "react";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { postBackendData, requestBackendResult } from "@/lib/backend-client";

interface Props {
  accountId: string;
  compact?: boolean;
}

interface BackendHealthScore {
  id: string;
  workspace_id: string;
  account_id: string;
  score: number;
  risk_level: "low" | "medium" | "high";
  computed_at: string;
}

interface BackendHealthFactor {
  id: string;
  health_score_id: string;
  factor_code: string;
  contribution: number;
  description: string;
}

interface HealthFactorsResponse {
  health_score: BackendHealthScore;
  factors: BackendHealthFactor[];
}

function factorLabel(code: string) {
  switch (code) {
    case "account_status":
      return "账号状态";
    case "post_volume":
      return "发帖量";
    case "audience_size":
      return "受众规模";
    case "following_ratio":
      return "关注比";
    default:
      return code;
  }
}

function factorValue(contribution: number) {
  return Math.max(0, Math.min(25, 25 + contribution));
}

export default function HealthCard({ accountId, compact }: Props) {
  const [health, setHealth] = useState<HealthFactorsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      const factorsPath = `/api/backend/accounts/${accountId}/health-score/factors`;
      const scorePath = `/api/backend/accounts/${accountId}/health-score`;

      const { status, result } = await requestBackendResult<HealthFactorsResponse>(factorsPath);
      if (cancelled) return;

      if (result.ok) {
        setHealth(result.data);
        setError(null);
        return;
      }

      if (status === 404) {
        try {
          const computed = await postBackendData<HealthFactorsResponse>(scorePath, {});
          if (cancelled) return;
          setHealth(computed);
          setError(null);
          return;
        } catch (cause) {
          if (cancelled) return;
          setError(cause instanceof Error ? cause.message : "加载健康分失败");
          return;
        }
      }

      setError(result.error.message);
    }

    void loadHealth();

    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const colorMap = {
    low: "text-[#00BA7C] bg-green-50 border-green-100",
    medium: "text-orange-500 bg-orange-50 border-orange-100",
    high: "text-[#E05252] bg-red-50 border-red-100",
  };

  const riskLabel = { low: "健康", medium: "注意", high: "风险" };
  const riskLevel = health?.health_score.risk_level;
  const IconComp = riskLevel === "low" ? ShieldCheck : riskLevel === "medium" ? Shield : ShieldAlert;

  if (compact && !health && !error) {
    return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-[#E8E8E8] text-[#999999]">...</span>;
  }

  if (compact && error) {
    return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-red-100 text-[#E05252]">ERR</span>;
  }

  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border", colorMap[health!.health_score.risk_level])}>
        <IconComp className="w-3 h-3" />
        {health!.health_score.score}
      </span>
    );
  }

  if (!health && !error) {
    return (
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-5 text-sm text-[#999999]">
        正在加载健康分...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-[#F1D0D0] rounded-xl p-5 text-sm text-[#B04A4A]">
        {error}
      </div>
    );
  }

  const breakdown = health!.factors.map((factor) => ({
    label: factorLabel(factor.factor_code),
    value: factorValue(factor.contribution),
    max: 25,
    contribution: factor.contribution,
    description: factor.description,
  }));

  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border", colorMap[health!.health_score.risk_level])}>
          <IconComp className="w-6 h-6" />
        </div>
        <div>
          <p className="text-[#999999] text-xs">账号健康分</p>
          <div className="flex items-baseline gap-2">
            <p className="text-[#111111] text-2xl font-bold">{health!.health_score.score}</p>
            <p className={cn("text-xs font-medium", health!.health_score.risk_level === "low" ? "text-[#00BA7C]" : health!.health_score.risk_level === "medium" ? "text-orange-500" : "text-[#E05252]")}>
              {riskLabel[health!.health_score.risk_level]}
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-2.5">
        {breakdown.map((b) => (
          <div key={b.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[#999999]">{b.label}</span>
              <span className="text-[#111111] font-medium">{b.contribution >= 0 ? "+" : ""}{b.contribution}</span>
            </div>
            <div className="h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  b.value / b.max >= 0.8 ? "bg-[#00BA7C]" : b.value / b.max >= 0.6 ? "bg-orange-400" : "bg-[#E05252]"
                )}
                style={{ width: `${(b.value / b.max) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-[#999999]">{b.description}</p>
          </div>
        ))}
      </div>
      {health!.health_score.risk_level !== "low" && (
        <div className="mt-4 pt-4 border-t border-[#E8E8E8]">
          <p className="text-xs text-[#999999]">
            {health!.health_score.risk_level === "medium"
              ? "建议：检查发帖量、粉丝规模和关注比是否异常。"
              : "警告：当前账号健康分已进入高风险区，建议立即人工检查账号状态。"}
          </p>
        </div>
      )}
    </div>
  );
}
