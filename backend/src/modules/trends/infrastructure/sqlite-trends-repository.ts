import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { TrendsRepository } from "../application/ports/trends-repository";
import { createTrend, type Trend, type TrendSourcePreview } from "../domain/trend";
import { formatTrendDisplayTopic, normalizeTrendClusterKey, shouldRepairTrendTopic } from "../domain/trend-clustering";

interface TrendRow {
  id: string;
  workspace_id: string;
  cluster_key?: string | null;
  topic: string;
  category: string;
  score: number;
  status: Trend["status"];
  detected_at: string;
  updated_at: string;
}

interface TrendDocumentRow {
  title: string;
  source_id: string;
  source_name: string;
  source_type: string;
  account_id: string;
  account_handle: string;
  published_at?: string | null;
  created_at: string;
}

interface AggregatedTrendPreview {
  sources: Map<string, TrendSourcePreview>;
  account_ids: Set<string>;
  source_types: Set<string>;
  freshest_document_at?: string;
}

export class SqliteTrendsRepository implements TrendsRepository {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async findById(trendId: string): Promise<Trend | null> {
    const row = this.db.get<TrendRow>(
      `SELECT id, workspace_id, cluster_key, topic, category, score, status, detected_at, updated_at
      FROM trends
      WHERE id = ?`,
      [trendId],
    );
    return row ? mapTrendRow(row) : null;
  }

  async findByWorkspaceAndClusterKey(workspaceId: string, clusterKey: string): Promise<Trend | null> {
    const row = this.db.get<TrendRow>(
      `SELECT id, workspace_id, cluster_key, topic, category, score, status, detected_at, updated_at
      FROM trends
      WHERE workspace_id = ? AND cluster_key = ?
      ORDER BY updated_at DESC, id DESC
      LIMIT 1`,
      [workspaceId, clusterKey],
    );
    return row ? mapTrendRow(row) : null;
  }

  async listByWorkspaceId(workspaceId: string): Promise<Trend[]> {
    const rows = this.db.all<TrendRow>(
      `SELECT id, workspace_id, cluster_key, topic, category, score, status, detected_at, updated_at
      FROM trends
      WHERE workspace_id = ?
      ORDER BY score DESC, updated_at DESC`,
      [workspaceId],
    );

    const deduped = new Map<string, Trend>();
    for (const row of rows) {
      const trend = mapTrendRow(row);
      const current = deduped.get(trend.cluster_key);
      if (!current) {
        deduped.set(trend.cluster_key, trend);
        continue;
      }

      if (trend.score > current.score || (trend.score === current.score && trend.updated_at > current.updated_at)) {
        deduped.set(trend.cluster_key, trend);
      }
    }

    const trends = Array.from(deduped.values());

    if (trends.length === 0) {
      return trends;
    }

    const sourcePreviews = this.buildSourcePreviews(workspaceId, new Set(trends.map((trend) => trend.cluster_key)));
    return trends
      .map((trend) => {
        const preview = sourcePreviews.get(trend.cluster_key);
        const enrichedTrend = preview ? {
          ...trend,
          source_count: preview.source_count,
          account_count: preview.account_count,
          sources: preview.sources,
        } : trend;

        return {
          trend: enrichedTrend,
          freshest_document_at: preview?.freshest_document_at,
          rank_score: computeTrendRankScore(enrichedTrend, preview),
        };
      })
      .sort((left, right) => {
        if (right.rank_score !== left.rank_score) {
          return right.rank_score - left.rank_score;
        }

        const rightFreshness = right.freshest_document_at ?? right.trend.updated_at;
        const leftFreshness = left.freshest_document_at ?? left.trend.updated_at;
        if (rightFreshness !== leftFreshness) {
          return rightFreshness.localeCompare(leftFreshness);
        }

        if (right.trend.score !== left.trend.score) {
          return right.trend.score - left.trend.score;
        }

        return right.trend.updated_at.localeCompare(left.trend.updated_at);
      })
      .map((item) => item.trend);
  }

  async save(trend: Trend): Promise<void> {
    this.db.run(
      `INSERT INTO trends (
        id, workspace_id, cluster_key, topic, category, score, status, detected_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        cluster_key = excluded.cluster_key,
        topic = excluded.topic,
        category = excluded.category,
        score = excluded.score,
        status = excluded.status,
        updated_at = excluded.updated_at`,
      [
        trend.id,
        trend.workspace_id,
        trend.cluster_key,
        trend.topic,
        trend.category,
        trend.score,
        trend.status,
        trend.detected_at,
        trend.updated_at,
      ],
    );
  }

  private buildSourcePreviews(workspaceId: string, clusterKeys: Set<string>) {
    const rows = this.db.all<TrendDocumentRow>(
      `SELECT
        sd.title,
        s.id AS source_id,
        s.name AS source_name,
        s.type AS source_type,
        s.account_id AS account_id,
        a.handle AS account_handle,
        sd.published_at AS published_at,
        sd.created_at AS created_at
      FROM source_documents sd
      INNER JOIN sources s ON s.id = sd.source_id
      INNER JOIN accounts a ON a.id = s.account_id
      WHERE sd.workspace_id = ?
      ORDER BY COALESCE(sd.published_at, sd.created_at) DESC
      LIMIT 2000`,
      [workspaceId],
    );

    const aggregated = new Map<string, AggregatedTrendPreview>();

    for (const row of rows) {
      const clusterKey = normalizeTrendClusterKey(row.title);
      if (!clusterKey || !clusterKeys.has(clusterKey)) {
        continue;
      }

      const bucket: AggregatedTrendPreview = aggregated.get(clusterKey) ?? {
        sources: new Map(),
        account_ids: new Set<string>(),
        source_types: new Set<string>(),
      };
      bucket.account_ids.add(row.account_id);
      bucket.source_types.add(row.source_type);
      const freshness = row.published_at ?? row.created_at;
      if (!bucket.freshest_document_at || freshness > bucket.freshest_document_at) {
        bucket.freshest_document_at = freshness;
      }

      const existing = bucket.sources.get(row.source_id);
      if (existing) {
        existing.document_count += 1;
      } else {
        bucket.sources.set(row.source_id, {
          source_id: row.source_id,
          source_name: row.source_name,
          account_id: row.account_id,
          account_handle: row.account_handle,
          document_count: 1,
        });
      }

      aggregated.set(clusterKey, bucket);
    }

    return new Map(Array.from(aggregated.entries()).map(([clusterKey, bucket]) => [
      clusterKey,
      {
        source_count: bucket.sources.size,
        account_count: bucket.account_ids.size,
        source_type_count: bucket.source_types.size,
        freshest_document_at: bucket.freshest_document_at,
        sources: Array.from(bucket.sources.values())
          .sort((left, right) => {
            if (right.document_count !== left.document_count) {
              return right.document_count - left.document_count;
            }
            return left.source_name.localeCompare(right.source_name);
          })
          .slice(0, 3),
      },
    ]));
  }
}

function computeTrendRankScore(
  trend: Trend,
  preview?: {
    source_count: number;
    account_count: number;
    source_type_count: number;
    freshest_document_at?: string;
  },
) {
  const urgencyBoost = scoreRecency(preview?.freshest_document_at ?? trend.updated_at, [
    { hours: 6, score: 30 },
    { hours: 24, score: 18 },
    { hours: 72, score: 9 },
    { hours: 168, score: 3 },
  ]);
  const noveltyBoost = scoreRecency(trend.detected_at, [
    { hours: 24, score: 18 },
    { hours: 72, score: 10 },
    { hours: 168, score: 4 },
  ]);
  const diversityBoost = Math.min(
    30,
    Math.max(0, (preview?.source_count ?? trend.source_count ?? 1) - 1) * 4
      + Math.max(0, (preview?.account_count ?? trend.account_count ?? 1) - 1) * 3
      + Math.max(0, (preview?.source_type_count ?? 1) - 1) * 5,
  );

  return trend.score * 10 + urgencyBoost + noveltyBoost + diversityBoost;
}

function scoreRecency(
  iso: string | undefined,
  buckets: Array<{ hours: number; score: number }>,
) {
  if (!iso) {
    return 0;
  }

  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return 0;
  }

  const hoursAgo = (Date.now() - timestamp) / 3_600_000;
  for (const bucket of buckets) {
    if (hoursAgo <= bucket.hours) {
      return bucket.score;
    }
  }

  return 0;
}

function mapTrendRow(row: TrendRow): Trend {
  const clusterKey = row.cluster_key?.trim() || normalizeTrendClusterKey(row.topic);
  const topic = shouldRepairTrendTopic(row.topic, clusterKey)
    ? formatTrendDisplayTopic(clusterKey)
    : row.topic.replace(/\s+/g, " ").trim();

  return createTrend({
    id: row.id,
    workspace_id: row.workspace_id,
    cluster_key: clusterKey,
    topic,
    category: row.category,
    score: row.score,
    status: row.status,
    detected_at: row.detected_at,
    updated_at: row.updated_at,
  });
}
