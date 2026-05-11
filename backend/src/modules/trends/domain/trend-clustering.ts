const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "but",
  "for",
  "from",
  "has",
  "have",
  "how",
  "into",
  "its",
  "new",
  "not",
  "now",
  "off",
  "the",
  "their",
  "this",
  "that",
  "they",
  "was",
  "were",
  "what",
  "when",
  "with",
]);

const SPECIAL_DISPLAY_TERMS = new Map([
  ["ai", "AI"],
  ["btc", "BTC"],
  ["cefi", "CeFi"],
  ["cpi", "CPI"],
  ["dao", "DAO"],
  ["defi", "DeFi"],
  ["dex", "DEX"],
  ["dxy", "DXY"],
  ["ecb", "ECB"],
  ["eth", "ETH"],
  ["etf", "ETF"],
  ["evm", "EVM"],
  ["fed", "Fed"],
  ["ipo", "IPO"],
  ["nft", "NFT"],
  ["otc", "OTC"],
  ["pce", "PCE"],
  ["sec", "SEC"],
  ["sol", "SOL"],
  ["ton", "TON"],
  ["tvl", "TVL"],
  ["usd", "USD"],
  ["usdt", "USDT"],
  ["xrp", "XRP"],
]);

export function normalizeTrendClusterKey(value: string): string {
  return extractTrendClusterTerms(value).join(" ");
}

export function buildTrendTopicSnapshot(title: string): { cluster_key: string; topic: string } {
  const clusterKey = normalizeTrendClusterKey(title);
  return {
    cluster_key: clusterKey,
    topic: formatTrendDisplayTopic(clusterKey, title),
  };
}

export function formatTrendDisplayTopic(clusterKey: string, sourceTitle?: string): string {
  const terms = clusterKey
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  if (terms.length === 0) {
    return "";
  }

  const sourceTokenMap = buildSourceTokenMap(sourceTitle ?? "");
  return terms
    .map((term) => sourceTokenMap.get(term) ?? formatFallbackDisplayTerm(term))
    .join(" ");
}

export function shouldRepairTrendTopic(topic: string | undefined, clusterKey: string): boolean {
  const normalizedTopic = normalizeWhitespace(topic ?? "");
  if (!normalizedTopic) {
    return true;
  }

  return normalizeTrendClusterKey(normalizedTopic) === clusterKey && normalizedTopic === normalizedTopic.toLowerCase();
}

function extractTrendClusterTerms(value: string): string[] {
  const terms: string[] = [];
  const seen = new Set<string>();

  for (const token of tokenize(value)) {
    const normalized = token.toLowerCase();
    if (!shouldKeepTerm(normalized) || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    terms.push(normalized);

    if (terms.length >= 6) {
      break;
    }
  }

  return terms;
}

function buildSourceTokenMap(value: string): Map<string, string> {
  const map = new Map<string, string>();

  for (const token of tokenize(value)) {
    const normalized = token.toLowerCase();
    if (!shouldKeepTerm(normalized) || map.has(normalized)) {
      continue;
    }

    if (containsCjk(token)) {
      map.set(normalized, token);
      continue;
    }

    if (SPECIAL_DISPLAY_TERMS.has(normalized)) {
      map.set(normalized, SPECIAL_DISPLAY_TERMS.get(normalized)!);
      continue;
    }

    if (/[A-Z]/.test(token)) {
      map.set(normalized, token);
      continue;
    }

    map.set(normalized, formatFallbackDisplayTerm(normalized));
  }

  return map;
}

function tokenize(value: string): string[] {
  return value
    .replace(/https?:\/\/\S+/gi, " ")
    .match(/[\u4e00-\u9fff]+|[A-Za-z0-9]+/g) ?? [];
}

function shouldKeepTerm(term: string): boolean {
  if (!term || /^\d+$/.test(term)) {
    return false;
  }

  if (containsCjk(term)) {
    return term.length >= 2;
  }

  if (term.length < 2 || STOP_WORDS.has(term)) {
    return false;
  }

  return true;
}

function formatFallbackDisplayTerm(term: string): string {
  if (containsCjk(term)) {
    return term;
  }

  if (SPECIAL_DISPLAY_TERMS.has(term)) {
    return SPECIAL_DISPLAY_TERMS.get(term)!;
  }

  return term.charAt(0).toUpperCase() + term.slice(1);
}

function containsCjk(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
