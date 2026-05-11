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
