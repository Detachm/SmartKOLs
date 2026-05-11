import { AppError } from "../../../core/errors/app-error";

export const MAX_X_POST_WEIGHTED_LENGTH = 280;
export const SHORTENED_X_URL_LENGTH = 23;

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>()]+/gi;
const SINGLE_WEIGHT_CODE_POINT_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x10ff],
  [0x2000, 0x200d],
  [0x2010, 0x201f],
  [0x2032, 0x2037],
];

let cachedSegmenter: Intl.Segmenter | null | undefined;

export interface XPostLengthDiagnostics {
  weighted_length: number;
  max_weighted_length: number;
  overflow_by: number;
  url_count: number;
}

export interface TruncateXPostResult {
  text: string;
  truncated: boolean;
  diagnostics: XPostLengthDiagnostics;
  original_diagnostics: XPostLengthDiagnostics;
}

export function getXPostLengthDiagnostics(text: string): XPostLengthDiagnostics {
  let weightedLength = 0;
  let urlCount = 0;
  let offset = 0;

  const urlPattern = new RegExp(URL_PATTERN.source, URL_PATTERN.flags);
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(text)) !== null) {
    const url = match[0];
    const index = match.index ?? 0;
    weightedLength += getNonUrlWeightedLength(text.slice(offset, index));
    weightedLength += SHORTENED_X_URL_LENGTH;
    urlCount += 1;
    offset = index + url.length;
  }

  weightedLength += getNonUrlWeightedLength(text.slice(offset));

  return {
    weighted_length: weightedLength,
    max_weighted_length: MAX_X_POST_WEIGHTED_LENGTH,
    overflow_by: Math.max(weightedLength - MAX_X_POST_WEIGHTED_LENGTH, 0),
    url_count: urlCount,
  };
}

export function assertXPostWithinLimit(
  text: string,
  input?: {
    message?: string;
    details?: Record<string, unknown>;
  },
): XPostLengthDiagnostics {
  const diagnostics = getXPostLengthDiagnostics(text);
  if (diagnostics.weighted_length <= diagnostics.max_weighted_length) {
    return diagnostics;
  }

  throw new AppError(
    "VALIDATION_ERROR",
    input?.message ?? `post exceeds X weighted length limit (${diagnostics.weighted_length}/${diagnostics.max_weighted_length})`,
    {
      details: {
        ...input?.details,
        ...diagnostics,
      },
    },
  );
}

export function truncateXPostToLimit(
  text: string,
  input?: {
    max_weighted_length?: number;
    suffix?: string;
  },
): TruncateXPostResult {
  const maxWeightedLength = input?.max_weighted_length ?? MAX_X_POST_WEIGHTED_LENGTH;
  const suffix = input?.suffix ?? "...";
  const originalDiagnostics = getXPostLengthDiagnostics(text);

  if (originalDiagnostics.weighted_length <= maxWeightedLength) {
    return {
      text,
      truncated: false,
      diagnostics: originalDiagnostics,
      original_diagnostics: originalDiagnostics,
    };
  }

  const suffixWeight = suffix ? getXPostLengthDiagnostics(suffix).weighted_length : 0;
  const bodyBudget = Math.max(0, maxWeightedLength - suffixWeight);

  let truncatedText = "";
  let weightedLength = 0;

  for (const token of tokenizeXPost(text)) {
    if (token.kind === "url") {
      if (weightedLength + SHORTENED_X_URL_LENGTH > bodyBudget) {
        break;
      }

      truncatedText += token.text;
      weightedLength += SHORTENED_X_URL_LENGTH;
      continue;
    }

    if (weightedLength + token.weight > bodyBudget) {
      break;
    }

    truncatedText += token.text;
    weightedLength += token.weight;
  }

  let finalized = truncatedText.replace(/[\s,.;:!?，。！？、；：]+$/u, "").trimEnd();
  if (finalized === "") {
    finalized = truncatedText.trimEnd();
  }

  if (suffix && finalized !== "") {
    finalized += suffix;
  }

  const diagnostics = getXPostLengthDiagnostics(finalized);
  return {
    text: diagnostics.weighted_length <= maxWeightedLength ? finalized : truncatedText.trimEnd(),
    truncated: true,
    diagnostics: diagnostics.weighted_length <= maxWeightedLength
      ? diagnostics
      : getXPostLengthDiagnostics(truncatedText.trimEnd()),
    original_diagnostics: originalDiagnostics,
  };
}

function getNonUrlWeightedLength(text: string): number {
  let total = 0;
  for (const grapheme of segmentGraphemes(text)) {
    if (containsEmojiLikeCodePoint(grapheme)) {
      total += 2;
      continue;
    }

    for (const symbol of Array.from(grapheme)) {
      total += getCodePointWeight(symbol.codePointAt(0) ?? 0);
    }
  }

  return total;
}

function getCodePointWeight(codePoint: number): number {
  for (const [start, end] of SINGLE_WEIGHT_CODE_POINT_RANGES) {
    if (codePoint >= start && codePoint <= end) {
      return 1;
    }
  }

  return 2;
}

function segmentGraphemes(text: string): string[] {
  if (!text) {
    return [];
  }

  const segmenter = getSegmenter();
  if (!segmenter) {
    return Array.from(text);
  }

  return Array.from(segmenter.segment(text), (entry) => entry.segment);
}

function containsEmojiLikeCodePoint(grapheme: string): boolean {
  for (const symbol of Array.from(grapheme)) {
    const codePoint = symbol.codePointAt(0) ?? 0;
    if (
      isInRange(codePoint, 0x1f000, 0x1ffff)
      || isInRange(codePoint, 0x2600, 0x27bf)
      || isInRange(codePoint, 0xfe00, 0xfe0f)
      || isInRange(codePoint, 0x1f1e6, 0x1f1ff)
      || codePoint === 0x200d
      || codePoint === 0x20e3
    ) {
      return true;
    }
  }

  return false;
}

function isInRange(value: number, start: number, end: number) {
  return value >= start && value <= end;
}

function getSegmenter(): Intl.Segmenter | null {
  if (cachedSegmenter !== undefined) {
    return cachedSegmenter;
  }

  try {
    cachedSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  } catch {
    cachedSegmenter = null;
  }

  return cachedSegmenter;
}

function tokenizeXPost(text: string): Array<
  | { kind: "url"; text: string }
  | { kind: "text"; text: string; weight: number }
> {
  const tokens: Array<
    | { kind: "url"; text: string }
    | { kind: "text"; text: string; weight: number }
  > = [];
  let offset = 0;
  const urlPattern = new RegExp(URL_PATTERN.source, URL_PATTERN.flags);
  let match: RegExpExecArray | null;

  while ((match = urlPattern.exec(text)) !== null) {
    const url = match[0];
    const index = match.index ?? 0;
    pushTextTokens(tokens, text.slice(offset, index));
    tokens.push({ kind: "url", text: url });
    offset = index + url.length;
  }

  pushTextTokens(tokens, text.slice(offset));
  return tokens;
}

function pushTextTokens(
  tokens: Array<
    | { kind: "url"; text: string }
    | { kind: "text"; text: string; weight: number }
  >,
  text: string,
) {
  for (const grapheme of segmentGraphemes(text)) {
    tokens.push({
      kind: "text",
      text: grapheme,
      weight: getNonUrlWeightedLength(grapheme),
    });
  }
}
