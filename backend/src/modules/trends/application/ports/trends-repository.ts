import type { Trend } from "../../domain/trend";

export interface TrendsRepository {
  findById(trendId: string): Promise<Trend | null>;
  findByWorkspaceAndClusterKey(workspaceId: string, clusterKey: string): Promise<Trend | null>;
  listByWorkspaceId(workspaceId: string): Promise<Trend[]>;
  save(trend: Trend): Promise<void>;
}
