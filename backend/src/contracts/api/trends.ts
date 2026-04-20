import type { Trend } from "../../modules/trends/domain/trend";

export interface TrendListResponse {
  trends: Trend[];
}

export interface RefreshTrendsResponse {
  refreshed_count: number;
}
