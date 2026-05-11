import { AppError } from "../../../core/errors/app-error";

export interface DraftVoiceGuardIssue {
  code:
    | "formulaic_contrast"
    | "generic_builder_slogan"
    | "generic_utility_slogan"
    | "generic_resilience_slogan"
    | "bilingual_slogan";
  message: string;
  severity: 1 | 2;
}

export interface DraftVoiceGuardSummary {
  status: "passed" | "failed";
  issues: DraftVoiceGuardIssue[];
}

const GENERIC_BUILDER_SLOGANS = [
  /\bkeep building\b/i,
  /\bkeep going\b/i,
  /\bcontinue building\b/i,
  /继续建设/,
  /持续建设/,
  /开始建设/,
];

const GENERIC_UTILITY_SLOGANS = [
  /\breal utility\b/i,
  /\butility needs no permission\b/i,
  /\bno politics,\s*just scale\b/i,
  /\bscale wins\b/i,
];

const GENERIC_RESILIENCE_SLOGANS = [
  /\bunstoppable infrastructure\b/i,
  /\bborderless infrastructure\b/i,
  /\bneutral global mediator\b/i,
  /\bcentralized systems are fragile\b/i,
  /\btraditional diplomacy (is )?dead\b/i,
  /传统外交.*死/,
];

export function evaluateDraftVoiceGuard(content: string): DraftVoiceGuardSummary {
  const issues: DraftVoiceGuardIssue[] = [];
  const normalized = content.trim();

  if (/\bwhile\b.{0,90}\b(builds?|building|keeps moving)\b/i.test(normalized)) {
    issues.push({
      code: "formulaic_contrast",
      message: "Avoid the repeated 'While X, Y builds' contrast template.",
      severity: 2,
    });
  }

  if (GENERIC_BUILDER_SLOGANS.some((pattern) => pattern.test(normalized))) {
    issues.push({
      code: "generic_builder_slogan",
      message: "Avoid generic builder slogans such as 'keep building' or '继续建设'.",
      severity: 1,
    });
  }

  if (GENERIC_UTILITY_SLOGANS.some((pattern) => pattern.test(normalized))) {
    issues.push({
      code: "generic_utility_slogan",
      message: "Avoid generic utility slogans; make the implication specific.",
      severity: 1,
    });
  }

  if (GENERIC_RESILIENCE_SLOGANS.some((pattern) => pattern.test(normalized))) {
    issues.push({
      code: "generic_resilience_slogan",
      message: "Avoid generic resilience/decentralization slogans without concrete support.",
      severity: 1,
    });
  }

  if (hasMixedLanguageSlogan(normalized)) {
    issues.push({
      code: "bilingual_slogan",
      message: "Avoid tacked-on bilingual slogans unless the source persona consistently writes that way.",
      severity: 1,
    });
  }

  const score = issues.reduce((sum, issue) => sum + issue.severity, 0);
  return {
    status: score >= 3 ? "failed" : "passed",
    issues,
  };
}

export function assertDraftVoiceGuardPassed(input: {
  content: string;
  topic?: string;
}) {
  const summary = evaluateDraftVoiceGuard(input.content);
  if (summary.status === "passed") {
    return summary;
  }

  throw new AppError("MODEL_INVALID_OUTPUT", "draft failed voice quality guard", {
    details: {
      topic: input.topic,
      issues: summary.issues,
    },
  });
}

function hasMixedLanguageSlogan(content: string): boolean {
  const hasCjk = /[\u3400-\u9fff]/.test(content);
  const hasLatin = /[A-Za-z]/.test(content);
  if (!hasCjk || !hasLatin) {
    return false;
  }

  return /(keep|build|utility|scale|decentralized|on-chain|tron|btc|stablecoin|signal)/i.test(content)
    && /(建设|去中心化|投机|暴政|坚持|出路)/.test(content);
}
