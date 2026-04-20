import { AppError } from "../../../core/errors/app-error";
import { requireIsoDateTimeString } from "../../../core/validation/guards";

const CHARACTER_NGRAM_SIZE = 5;
const TOKEN_NGRAM_SIZE = 4;
const MIN_FRAGMENT_LENGTH = 24;

export interface SourceBackedOriginalityGuardThresholds {
  evidence_char_overlap_ratio: number;
  evidence_token_overlap_ratio: number;
  evidence_reused_fragment_ratio: number;
  evidence_max_reused_fragment_chars: number;
  recent_draft_char_overlap_ratio: number;
  recent_draft_token_overlap_ratio: number;
  recent_draft_reused_fragment_ratio: number;
  recent_draft_max_reused_fragment_chars: number;
}

export interface SourceBackedOriginalityGuardEvidenceReference {
  source_document_id: string;
  canonical_url: string;
  similarity_text: string;
}

export interface SourceBackedOriginalityGuardDraftReference {
  draft_id: string;
  topic: string;
  content: string;
}

export interface SourceBackedOriginalityGuardEvidenceComparison {
  source_document_id: string;
  canonical_url: string;
  char_overlap_ratio: number;
  token_overlap_ratio: number;
  reused_fragment_ratio: number;
  max_reused_fragment_chars: number;
}

export interface SourceBackedOriginalityGuardDraftComparison {
  draft_id: string;
  topic: string;
  char_overlap_ratio: number;
  token_overlap_ratio: number;
  reused_fragment_ratio: number;
  max_reused_fragment_chars: number;
}

export interface SourceBackedOriginalityGuardSummary {
  status: "passed" | "failed";
  checked_at: string;
  compared_evidence_count: number;
  compared_recent_draft_count: number;
  thresholds: SourceBackedOriginalityGuardThresholds;
  max_evidence_overlap?: SourceBackedOriginalityGuardEvidenceComparison;
  max_recent_draft_overlap?: SourceBackedOriginalityGuardDraftComparison;
  failed_reason?:
    | "evidence_char_overlap"
    | "evidence_token_overlap"
    | "evidence_fragment_reuse"
    | "recent_draft_char_overlap"
    | "recent_draft_token_overlap"
    | "recent_draft_fragment_reuse";
}

interface PreparedSimilarityText {
  normalized: string;
  char_ngrams: Set<string>;
  token_ngrams: Set<string>;
  fragments: string[];
}

const DEFAULT_THRESHOLDS: SourceBackedOriginalityGuardThresholds = {
  evidence_char_overlap_ratio: 0.58,
  evidence_token_overlap_ratio: 0.34,
  evidence_reused_fragment_ratio: 0.32,
  evidence_max_reused_fragment_chars: 120,
  recent_draft_char_overlap_ratio: 0.78,
  recent_draft_token_overlap_ratio: 0.48,
  recent_draft_reused_fragment_ratio: 0.4,
  recent_draft_max_reused_fragment_chars: 160,
};

export function evaluateSourceBackedOriginalityGuard(input: {
  checked_at: string;
  draft_content: string;
  evidence_documents: SourceBackedOriginalityGuardEvidenceReference[];
  recent_drafts: SourceBackedOriginalityGuardDraftReference[];
  thresholds?: Partial<SourceBackedOriginalityGuardThresholds>;
}): SourceBackedOriginalityGuardSummary {
  const checkedAt = requireIsoDateTimeString(input.checked_at, "checked_at");
  const thresholds = {
    ...DEFAULT_THRESHOLDS,
    ...input.thresholds,
  };
  const draft = prepareSimilarityText(input.draft_content);

  const evidenceComparisons = input.evidence_documents.map((document) => ({
    source_document_id: document.source_document_id,
    canonical_url: document.canonical_url,
    ...comparePreparedSimilarityText(draft, prepareSimilarityText(document.similarity_text)),
  }));
  const recentDraftComparisons = input.recent_drafts.map((draftReference) => ({
    draft_id: draftReference.draft_id,
    topic: draftReference.topic,
    ...comparePreparedSimilarityText(draft, prepareSimilarityText(draftReference.content)),
  }));

  const maxEvidenceOverlap = pickWorstComparison(evidenceComparisons);
  const maxRecentDraftOverlap = pickWorstComparison(recentDraftComparisons);
  const failedReason = determineFailureReason({
    thresholds,
    maxEvidenceOverlap,
    maxRecentDraftOverlap,
  });

  return {
    status: failedReason ? "failed" : "passed",
    checked_at: checkedAt,
    compared_evidence_count: evidenceComparisons.length,
    compared_recent_draft_count: recentDraftComparisons.length,
    thresholds,
    max_evidence_overlap: maxEvidenceOverlap,
    max_recent_draft_overlap: maxRecentDraftOverlap,
    failed_reason: failedReason,
  };
}

export function assertSourceBackedOriginalityGuardPassed(input: {
  brief_id: string;
  summary: SourceBackedOriginalityGuardSummary;
}) {
  if (!input.summary.failed_reason) {
    return;
  }

  throw new AppError("VALIDATION_ERROR", "source-backed draft failed originality guard", {
    details: {
      brief_id: input.brief_id,
      failed_reason: input.summary.failed_reason,
      max_evidence_overlap: input.summary.max_evidence_overlap,
      max_recent_draft_overlap: input.summary.max_recent_draft_overlap,
    },
  });
}

function determineFailureReason(input: {
  thresholds: SourceBackedOriginalityGuardThresholds;
  maxEvidenceOverlap?: SourceBackedOriginalityGuardEvidenceComparison;
  maxRecentDraftOverlap?: SourceBackedOriginalityGuardDraftComparison;
}): SourceBackedOriginalityGuardSummary["failed_reason"] {
  const evidence = input.maxEvidenceOverlap;
  if (evidence) {
    if (evidence.char_overlap_ratio > input.thresholds.evidence_char_overlap_ratio) {
      return "evidence_char_overlap";
    }
    if (evidence.token_overlap_ratio > input.thresholds.evidence_token_overlap_ratio) {
      return "evidence_token_overlap";
    }
    if (
      evidence.reused_fragment_ratio > input.thresholds.evidence_reused_fragment_ratio
      || evidence.max_reused_fragment_chars > input.thresholds.evidence_max_reused_fragment_chars
    ) {
      return "evidence_fragment_reuse";
    }
  }

  const recentDraft = input.maxRecentDraftOverlap;
  if (recentDraft) {
    if (recentDraft.char_overlap_ratio > input.thresholds.recent_draft_char_overlap_ratio) {
      return "recent_draft_char_overlap";
    }
    if (recentDraft.token_overlap_ratio > input.thresholds.recent_draft_token_overlap_ratio) {
      return "recent_draft_token_overlap";
    }
    if (
      recentDraft.reused_fragment_ratio > input.thresholds.recent_draft_reused_fragment_ratio
      || recentDraft.max_reused_fragment_chars > input.thresholds.recent_draft_max_reused_fragment_chars
    ) {
      return "recent_draft_fragment_reuse";
    }
  }

  return undefined;
}

function comparePreparedSimilarityText(
  left: PreparedSimilarityText,
  right: PreparedSimilarityText,
) {
  const reusedFragments = left.fragments.filter((fragment) => fragment.length >= MIN_FRAGMENT_LENGTH && right.normalized.includes(fragment));
  const totalFragmentChars = left.fragments.reduce((sum, fragment) => sum + fragment.length, 0);
  const reusedFragmentChars = reusedFragments.reduce((sum, fragment) => sum + fragment.length, 0);

  return {
    char_overlap_ratio: calculateSetOverlapRatio(left.char_ngrams, right.char_ngrams),
    token_overlap_ratio: calculateSetOverlapRatio(left.token_ngrams, right.token_ngrams),
    reused_fragment_ratio: totalFragmentChars > 0 ? reusedFragmentChars / totalFragmentChars : 0,
    max_reused_fragment_chars: reusedFragments.reduce((max, fragment) => Math.max(max, fragment.length), 0),
  };
}

function calculateSetOverlapRatio(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersectionCount = 0;
  left.forEach((item) => {
    if (right.has(item)) {
      intersectionCount += 1;
    }
  });

  return intersectionCount / Math.min(left.size, right.size);
}

function prepareSimilarityText(value: string): PreparedSimilarityText {
  const normalized = normalizeSimilarityText(value);
  return {
    normalized,
    char_ngrams: buildCharacterNgrams(normalized, CHARACTER_NGRAM_SIZE),
    token_ngrams: buildTokenNgrams(tokenizeSimilarityText(value), TOKEN_NGRAM_SIZE),
    fragments: splitSimilarityFragments(value),
  };
}

function splitSimilarityFragments(value: string) {
  return value
    .split(/[\n\r。！？!?；;:：]+/g)
    .map((fragment) => normalizeSimilarityText(fragment))
    .filter((fragment) => fragment.length >= MIN_FRAGMENT_LENGTH);
}

function buildCharacterNgrams(value: string, size: number): Set<string> {
  if (value.length < size) {
    return value ? new Set([value]) : new Set();
  }

  const grams = new Set<string>();
  for (let index = 0; index <= value.length - size; index += 1) {
    grams.add(value.slice(index, index + size));
  }

  return grams;
}

function buildTokenNgrams(tokens: string[], size: number): Set<string> {
  if (tokens.length < size) {
    return tokens.length > 0 ? new Set([tokens.join(" ")]) : new Set();
  }

  const grams = new Set<string>();
  for (let index = 0; index <= tokens.length - size; index += 1) {
    grams.add(tokens.slice(index, index + size).join(" "));
  }

  return grams;
}

function tokenizeSimilarityText(value: string) {
  const lower = value.toLowerCase().replace(/https?:\/\/\S+/g, " ");
  const matches = lower.match(/[a-z0-9]+|[\u4e00-\u9fff]/g);
  return matches ?? [];
}

function normalizeSimilarityText(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, " ")
    .replace(/\s+/g, "")
    .trim();
}

function pickWorstComparison<T extends {
  char_overlap_ratio: number;
  token_overlap_ratio: number;
  reused_fragment_ratio: number;
  max_reused_fragment_chars: number;
}>(items: T[]): T | undefined {
  return items.reduce<T | undefined>((best, current) => {
    if (!best) {
      return current;
    }

    if (scoreComparison(current) > scoreComparison(best)) {
      return current;
    }

    return best;
  }, undefined);
}

function scoreComparison(value: {
  char_overlap_ratio: number;
  token_overlap_ratio: number;
  reused_fragment_ratio: number;
  max_reused_fragment_chars: number;
}) {
  return (
    value.char_overlap_ratio * 4
    + value.token_overlap_ratio * 3
    + value.reused_fragment_ratio * 2
    + value.max_reused_fragment_chars / 1000
  );
}
