import type { Source } from "../../domain/source";
import type { SourceDocument } from "../../domain/source-document";
import type { SourceFetchRun, SourceFetchRunStatus } from "../../domain/source-fetch-run";

export interface SourceFetchCandidate {
  source_id: string;
  workspace_id: string;
  account_id: string;
  last_fetched_at?: string;
}

export interface SourcesRepository {
  findSourceById(sourceId: string): Promise<Source | null>;
  findSourceByAccountAndUrl(accountId: string, url: string): Promise<Source | null>;
  listSourcesByAccountId(accountId: string): Promise<Source[]>;
  listDueFetchCandidates(input: {
    stale_before: string;
    limit: number;
  }): Promise<SourceFetchCandidate[]>;
  saveSource(source: Source): Promise<void>;
  deleteSource(sourceId: string): Promise<void>;
  createFetchRun(run: SourceFetchRun): Promise<void>;
  findFetchRunById(runId: string): Promise<SourceFetchRun | null>;
  listFetchRunsByWorkspaceAndStatus(workspaceId: string, status: SourceFetchRunStatus, limit: number): Promise<SourceFetchRun[]>;
  claimNextQueuedFetchRun(startedAt: string, leaseExpiresAt: string): Promise<SourceFetchRun | null>;
  listExpiredRunningFetchRuns(now: string, limit: number): Promise<SourceFetchRun[]>;
  saveFetchRun(run: SourceFetchRun): Promise<void>;
  listFetchRunsBySourceId(sourceId: string): Promise<SourceFetchRun[]>;
  findDocumentByContentHash(sourceId: string, contentHash: string): Promise<SourceDocument | null>;
  findDocumentById(documentId: string): Promise<SourceDocument | null>;
  listDocumentsByIds(documentIds: string[]): Promise<SourceDocument[]>;
  listDocumentsBySourceId(sourceId: string): Promise<SourceDocument[]>;
  listRecentDocumentsByWorkspaceId(workspaceId: string, limit: number): Promise<SourceDocument[]>;
  listRecentDocumentsByAccountId(accountId: string, limit: number): Promise<SourceDocument[]>;
  createDocument(document: SourceDocument): Promise<void>;
}
