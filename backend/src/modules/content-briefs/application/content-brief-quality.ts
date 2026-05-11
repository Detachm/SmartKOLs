import type { ContentBriefEvidenceItem } from "../domain/content-brief-evidence-item";
import type { Source } from "../../sources/domain/source";
import type { SourceDocument } from "../../sources/domain/source-document";

export interface ContentBriefQualityEvidenceEntry {
  evidence: ContentBriefEvidenceItem;
  document: SourceDocument;
  source?: Source;
}

export interface ContentBriefQualitySummary {
  evidence_count: number;
  source_count: number;
  source_types: Source["type"][];
  claim_count: number;
  quoted_excerpt_count: number;
  oldest_published_at?: string;
  newest_published_at?: string;
  diversity_status: "single_source" | "multi_source" | "cross_type";
  coverage_status: "thin" | "grounded" | "broad";
}

export function buildContentBriefQualitySummary(entries: ContentBriefQualityEvidenceEntry[]): ContentBriefQualitySummary {
  const sourceIds = new Set<string>();
  const sourceTypes = new Set<Source["type"]>();
  const publishedTimestamps = entries
    .map((entry) => entry.document.published_at ?? entry.document.created_at)
    .filter((value) => typeof value === "string" && value !== "")
    .sort();
  let claimCount = 0;
  let quotedExcerptCount = 0;

  for (const entry of entries) {
    sourceIds.add(entry.document.source_id);
    if (entry.source) {
      sourceTypes.add(entry.source.type);
    }
    claimCount += entry.evidence.key_claims.length;
    if (entry.evidence.quoted_excerpt) {
      quotedExcerptCount += 1;
    }
  }

  const evidenceCount = entries.length;
  const uniqueSourceTypes = Array.from(sourceTypes).sort();
  const sourceCount = sourceIds.size;

  return {
    evidence_count: evidenceCount,
    source_count: sourceCount,
    source_types: uniqueSourceTypes,
    claim_count: claimCount,
    quoted_excerpt_count: quotedExcerptCount,
    oldest_published_at: publishedTimestamps[0],
    newest_published_at: publishedTimestamps[publishedTimestamps.length - 1],
    diversity_status: resolveDiversityStatus(sourceCount, uniqueSourceTypes.length),
    coverage_status: resolveCoverageStatus(evidenceCount, claimCount, quotedExcerptCount),
  };
}

function resolveDiversityStatus(
  sourceCount: number,
  sourceTypeCount: number,
): ContentBriefQualitySummary["diversity_status"] {
  if (sourceCount >= 2 && sourceTypeCount >= 2) {
    return "cross_type";
  }

  if (sourceCount >= 2) {
    return "multi_source";
  }

  return "single_source";
}

function resolveCoverageStatus(
  evidenceCount: number,
  claimCount: number,
  quotedExcerptCount: number,
): ContentBriefQualitySummary["coverage_status"] {
  if (evidenceCount >= 4 && claimCount >= 6 && quotedExcerptCount >= 2) {
    return "broad";
  }

  if (evidenceCount >= 2 && claimCount >= 3) {
    return "grounded";
  }

  return "thin";
}
