export type OperatorErrorCategory =
  | "configuration_error"
  | "temporary_external_error"
  | "rate_limited"
  | "operator_required"
  | "system_failure";

export interface OperatorErrorClassification {
  category: OperatorErrorCategory;
  user_message: string;
  retry_advice: string;
  auto_retry_recommended: boolean;
}

export function classifyOperatorError(input: {
  status?: string | null;
  error_code?: string | null;
  error_message?: string | null;
}): OperatorErrorClassification | undefined {
  const code = (input.error_code ?? "").trim();
  const message = (input.error_message ?? "").trim();
  const haystack = `${code} ${message}`.toLowerCase();

  if (!code && !message) {
    return undefined;
  }

  if (code.includes("RATE_LIMITED") || haystack.includes("rate limit") || haystack.includes("429")) {
    return {
      category: "rate_limited",
      user_message: "外部平台限流，系统需要等限流窗口恢复后再继续。",
      retry_advice: "不要连续手动重试；优先等待系统延迟重试，或稍后再点重试。",
      auto_retry_recommended: true,
    };
  }

  if (haystack.includes("does not have any credits") || haystack.includes("insufficient credits") || haystack.includes("no credits")) {
    return {
      category: "configuration_error",
      user_message: "发布通道账号额度不足，系统重试不会恢复。",
      retry_advice: "先检查 X 开发者账号/API 套餐额度或更换可发布的凭证，再重新发布。",
      auto_retry_recommended: false,
    };
  }

  if (
    haystack.includes("x_permission_denied")
    || haystack.includes("x_auth_invalid")
    || haystack.includes("x_auth_expired")
    || haystack.includes("permission")
    || haystack.includes("not authorized")
    || haystack.includes("unauthorized")
    || haystack.includes("forbidden")
    || haystack.includes("oauth")
    || haystack.includes("scope")
  ) {
    return {
      category: "configuration_error",
      user_message: "X 账号授权或权限不足，关注/转发/发布不会靠重试自动恢复。",
      retry_advice: "进入账号凭证页重新绑定 X，确认 OAuth scope/API 权限包含读写能力后再重试。",
      auto_retry_recommended: false,
    };
  }

  if (
    haystack.includes("x_resource_not_found")
    || haystack.includes("could not find user")
    || haystack.includes("not found")
    || haystack.includes("does not exist")
  ) {
    return {
      category: "operator_required",
      user_message: "目标账号或内容不存在，系统不应盲目重复重试。",
      retry_advice: "检查互动策略里的白名单账号、目标帖子或关键词候选；删除失效目标后再刷新自动化。",
      auto_retry_recommended: false,
    };
  }

  if (code === "VALIDATION_ERROR" && (haystack.includes("length limit") || haystack.includes("too long") || haystack.includes("exceeds"))) {
    return {
      category: "operator_required",
      user_message: "内容不满足发布平台限制，需要先编辑或重新生成，系统不会靠重试自动修好。",
      retry_advice: "进入草稿箱缩短内容或要求重写，确认长度合规后再重新排程/发布。",
      auto_retry_recommended: false,
    };
  }

  if (
    code === "VALIDATION_ERROR"
    || code === "FORBIDDEN"
    || code === "UNAUTHORIZED"
    || code === "SOURCE_FETCH_UNSUPPORTED"
    || haystack.includes("credential")
    || haystack.includes("policy")
    || haystack.includes("config")
    || haystack.includes("must include")
    || haystack.includes("not configured")
  ) {
    return {
      category: "configuration_error",
      user_message: "配置或授权不满足运行条件，系统不会靠重试自动修好。",
      retry_advice: "先按建议入口修配置、凭证或策略，再重新触发任务。",
      auto_retry_recommended: false,
    };
  }

  if (
    code.includes("TIMEOUT")
    || code.includes("NETWORK")
    || code.includes("UPSTREAM_5XX")
    || code === "EXTERNAL_DEPENDENCY_ERROR"
    || haystack.includes("timeout")
    || haystack.includes("network")
    || haystack.includes("5xx")
    || haystack.includes("temporar")
  ) {
    return {
      category: "temporary_external_error",
      user_message: "外部服务或网络临时异常，通常可以自动或手动重试恢复。",
      retry_advice: "可以先让后台自动重试；如果长时间未恢复，再使用一键重试。",
      auto_retry_recommended: true,
    };
  }

  if (code === "LEASE_EXPIRED") {
    return {
      category: "system_failure",
      user_message: "后台 worker 执行中断或超时，系统已把过期租约恢复为可处理状态。",
      retry_advice: "确认 worker 心跳正常后重试；如果反复出现，需要查看容器日志。",
      auto_retry_recommended: true,
    };
  }

  if (code === "CONFLICT" || code === "INVALID_STATE" || haystack.includes("pending review") || haystack.includes("manual review")) {
    return {
      category: "operator_required",
      user_message: "当前需要人工处理或等待已有任务完成，不适合盲目重复触发。",
      retry_advice: "先处理待审核、待发送或运行中的项目，再刷新状态。",
      auto_retry_recommended: false,
    };
  }

  if (code === "INTERNAL_ERROR" || code.includes("SCHEMA") || code.includes("INVALID_OUTPUT") || code.includes("TOOL_PLAN")) {
    return {
      category: "system_failure",
      user_message: "系统内部执行异常，需要先看运行日志或修复实现后再重试。",
      retry_advice: "不要连续重试；先查看监控详情和 worker 日志。",
      auto_retry_recommended: false,
    };
  }

  return {
    category: input.status === "failed" ? "system_failure" : "operator_required",
    user_message: message || code,
    retry_advice: "查看详情后决定是修配置、等待恢复，还是重新触发。",
    auto_retry_recommended: false,
  };
}
