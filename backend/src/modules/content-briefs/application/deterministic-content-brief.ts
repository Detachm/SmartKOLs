export interface DeterministicContentBriefInput {
  topic_hint?: string;
  angle_hint?: string;
  audience?: string;
  trend?: {
    topic: string;
    category: string;
    score: number;
  };
  documents: Array<{
    source_document_id: string;
    title: string;
    summary: string;
    canonical_url: string;
    published_at?: string;
  }>;
  persona: {
    writing_style?: string;
    bio?: string;
    interests: string[];
    personality_traits?: string[];
  };
}

export interface DeterministicContentBriefResult {
  topic: string;
  angle: string;
  audience: string;
  outline: string;
  rationale: string;
  evidence_items: Array<{
    source_document_id: string;
    usage_reason: string;
    key_claims: string[];
    quoted_excerpt?: string;
  }>;
}

export function buildDeterministicContentBrief(input: DeterministicContentBriefInput): DeterministicContentBriefResult {
  const evidenceDocuments = input.documents.slice(0, Math.min(input.documents.length, 3));
  const primary = evidenceDocuments[0];
  const topic = firstNonEmpty(
    input.topic_hint,
    input.trend?.topic,
    deriveFallbackTopic(primary?.title, primary?.summary),
    "Current source-backed topic",
  );
  const audience = firstNonEmpty(
    input.audience,
    deriveFallbackAudience(input.persona.interests),
    "Operators following this account",
  );
  const angle = firstNonEmpty(
    input.angle_hint,
    buildFallbackAngle(primary?.summary),
    "Ground the post in concrete source evidence and one practical takeaway.",
  );
  const outline = buildFallbackOutline(angle, audience, evidenceDocuments);

  return {
    topic,
    angle,
    audience,
    outline,
    rationale: "Deterministic brief generated from selected documents for fast preview.",
    evidence_items: evidenceDocuments.map((document, index) => ({
      source_document_id: document.source_document_id,
      usage_reason: index === 0
        ? `Use as the primary anchor for ${topic}.`
        : "Use as supporting evidence to reinforce the core angle.",
      key_claims: extractFallbackClaims(document),
      quoted_excerpt: extractQuotedExcerpt(document.summary),
    })),
  };
}

function deriveFallbackAudience(interests: string[]): string {
  const selected = interests.map((item) => item.trim()).filter(Boolean).slice(0, 2);
  if (selected.length === 0) {
    return "Operators and builders following this account";
  }

  return `${selected.join(" / ")} builders and practitioners`;
}

function deriveFallbackTopic(title?: string, summary?: string): string | undefined {
  const raw = firstNonEmpty(title, summary);
  if (!raw) {
    return undefined;
  }

  const firstClause = raw
    .split(/[:：|!！?？]+/g)
    .map((item) => item.trim())
    .find((item) => item !== "");

  return (firstClause ?? raw).slice(0, 72).trim();
}

function buildFallbackAngle(summary?: string): string {
  const claim = extractSentences(summary).find((sentence) => sentence.length >= 24);
  if (claim) {
    return "Turn the strongest source-backed claim into one practical operator takeaway.";
  }

  return "Extract one concrete takeaway that this account can explain with conviction.";
}

function buildFallbackOutline(
  angle: string,
  audience: string,
  documents: DeterministicContentBriefInput["documents"],
): string {
  const bullets = [
    "Hook: explain in one sentence why this matters right now.",
    `Point: explain the angle "${angle}" with 1-2 concrete details from the selected evidence.`,
  ];
  const supportingTitle = documents[1]?.title ?? documents[0]?.title;
  if (supportingTitle) {
    bullets.push(`Support: use ${supportingTitle} as proof, contrast, or context.`);
  }
  bullets.push(`Close: end with one practical implication for ${audience}.`);
  return bullets.join("\n");
}

function extractFallbackClaims(document: {
  title: string;
  summary: string;
}): string[] {
  const claims = [
    document.title.trim(),
    ...extractSentences(document.summary),
  ].filter(Boolean);

  return claims.slice(0, 3);
}

function extractQuotedExcerpt(summary: string): string | undefined {
  const excerpt = extractSentences(summary)[0];
  if (!excerpt) {
    return undefined;
  }

  return excerpt.slice(0, 220);
}

function extractSentences(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[\n。！？!?]+/g)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length >= 12);
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return "";
}
