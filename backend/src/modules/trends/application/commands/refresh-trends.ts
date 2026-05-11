import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { SourcesRepository } from "../../../sources/application/ports/sources-repository";
import type { TrendsRepository } from "../ports/trends-repository";
import { createTrend } from "../../domain/trend";
import { buildTrendTopicSnapshot } from "../../domain/trend-clustering";

function inferCategory(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("ai") || lower.includes("agent") || lower.includes("model")) return "ai";
  if (lower.includes("market") || lower.includes("fund") || lower.includes("price")) return "finance";
  if (lower.includes("launch") || lower.includes("product") || lower.includes("feature")) return "product";
  return "general";
}

export interface RefreshTrendsDependencies {
  sources: SourcesRepository;
  trends: TrendsRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class RefreshTrends {
  constructor(private readonly deps: RefreshTrendsDependencies) {}

  async execute(workspaceId: string) {
    const documents = await this.deps.sources.listRecentDocumentsByWorkspaceId(workspaceId, 200);
    const existingTrends = await this.deps.trends.listByWorkspaceId(workspaceId);
    const clusters = new Map<string, { cluster_key: string; topic: string; category: string; score: number; detected_at: string }>();

    for (const document of documents) {
      const snapshot = buildTrendTopicSnapshot(document.title);
      if (!snapshot.cluster_key) {
        continue;
      }

      const current = clusters.get(snapshot.cluster_key);
      const scoreIncrement = document.published_at ? 2 : 1;
      if (current) {
        current.score += scoreIncrement;
        if (document.published_at && document.published_at < current.detected_at) {
          current.detected_at = document.published_at;
        }
      } else {
        clusters.set(snapshot.cluster_key, {
          cluster_key: snapshot.cluster_key,
          topic: snapshot.topic,
          category: inferCategory(document.title),
          score: scoreIncrement,
          detected_at: document.published_at ?? document.created_at,
        });
      }
    }

    const now = this.deps.clock.now().toISOString();
    let refreshed = 0;
    let archived = 0;
    for (const cluster of Array.from(clusters.values())) {
      const existing = await this.deps.trends.findByWorkspaceAndClusterKey(workspaceId, cluster.cluster_key);
      const trend = createTrend({
        id: existing?.id ?? newId(),
        workspace_id: workspaceId,
        cluster_key: cluster.cluster_key,
        topic: cluster.topic,
        category: cluster.category,
        score: cluster.score,
        status: "active",
        detected_at: existing?.detected_at ?? cluster.detected_at,
        updated_at: now,
      });
      await this.deps.trends.save(trend);
      refreshed += 1;
    }

    for (const existing of existingTrends) {
      if (clusters.has(existing.cluster_key) || existing.status === "archived") {
        continue;
      }

      await this.deps.trends.save(createTrend({
        ...existing,
        status: "archived",
        updated_at: now,
      }));
      archived += 1;
    }

    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: workspaceId,
      actor_type: "system",
      entity_type: "trend",
      entity_id: workspaceId,
      action: "trends.refreshed",
      after_state: JSON.stringify({ refreshed_count: refreshed, archived_count: archived }),
      created_at: now,
    });

    return { refreshed_count: refreshed, archived_count: archived };
  }
}
