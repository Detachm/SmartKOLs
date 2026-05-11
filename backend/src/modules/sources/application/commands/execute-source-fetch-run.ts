import crypto from "crypto";
import type { ArtifactStore } from "../../../../core/artifacts/artifact-store";
import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { AlertsRepository } from "../../../monitoring/application/ports/alerts-repository";
import { createAlert } from "../../../monitoring/domain/alert";
import type { SourceFetcher } from "../ports/source-fetcher";
import type { SourcesRepository } from "../ports/sources-repository";
import { createSource } from "../../domain/source";
import { createSourceDocument } from "../../domain/source-document";
import {
  type SourceFetchRun,
  markSourceFetchRunFailed,
  markSourceFetchRunRunning,
  markSourceFetchRunSucceeded,
} from "../../domain/source-fetch-run";

export interface ExecuteSourceFetchRunDependencies {
  sources: SourcesRepository;
  fetcher: SourceFetcher;
  artifactStore: ArtifactStore;
  auditLogs: AuditLogRepository;
  alerts: AlertsRepository;
  clock: Clock;
}

export class ExecuteSourceFetchRun {
  constructor(private readonly deps: ExecuteSourceFetchRunDependencies) {}

  async execute(runId: string, options?: { claimed?: boolean }) {
    const run = await this.deps.sources.findFetchRunById(runId);
    if (!run) {
      throw new AppError("NOT_FOUND", "source fetch run not found", {
        details: { source_fetch_run_id: runId },
      });
    }

    const source = await this.deps.sources.findSourceById(run.source_id);
    if (!source) {
      throw new AppError("NOT_FOUND", "source not found", {
        details: { source_id: run.source_id, source_fetch_run_id: run.id },
      });
    }

    const runningRun = options?.claimed
      ? assertClaimedRunningRun(run)
      : markSourceFetchRunRunning(
        run,
        this.deps.clock.now().toISOString(),
        addMinutes(this.deps.clock.now().toISOString(), 15),
      );

    if (!options?.claimed) {
      await this.deps.sources.saveFetchRun(runningRun);
    }

    try {
      const fetched = await this.deps.fetcher.fetch(source);
      const rawArtifactRef = await persistRawSourceArtifactOrUndefined(
        this.deps.artifactStore,
        source.id,
        runningRun.id,
        fetched.raw_response,
        fetched.raw_response_extension,
      );
      let importedCount = 0;

      for (const item of fetched.documents) {
        const contentHash = crypto.createHash("sha256")
          .update([item.canonical_url, item.title, item.body_text].join("\n"))
          .digest("hex");

        const existing = await this.deps.sources.findDocumentByContentHash(source.id, contentHash);
        if (existing) {
          continue;
        }

        await this.deps.sources.createDocument(createSourceDocument({
          id: newId(),
          workspace_id: source.workspace_id,
          source_id: source.id,
          external_doc_id: item.external_doc_id,
          canonical_url: item.canonical_url,
          title: item.title,
          summary: item.summary ?? "",
          body_text: item.body_text,
          language: item.language,
          published_at: item.published_at,
          content_hash: contentHash,
          created_at: this.deps.clock.now().toISOString(),
        }));
        importedCount += 1;
      }

      const finishedAt = this.deps.clock.now().toISOString();
      const succeededRun = markSourceFetchRunSucceeded(runningRun, importedCount, finishedAt);
      await this.deps.sources.saveSource(createSource({
        ...source,
        last_fetched_at: finishedAt,
      }));
      await this.deps.sources.saveFetchRun(succeededRun);
      await this.deps.auditLogs.append({
        id: newId(),
        workspace_id: source.workspace_id,
        actor_type: "system",
        entity_type: "source_fetch_run",
        entity_id: succeededRun.id,
        action: "source.fetched",
        after_state: JSON.stringify({
          source_id: source.id,
          imported_count: importedCount,
          raw_artifact_ref: rawArtifactRef,
        }),
        created_at: finishedAt,
      });

      return {
        run_id: succeededRun.id,
        status: succeededRun.status,
        imported_count: importedCount,
      };
    } catch (error) {
      const appError = error instanceof AppError
        ? error
        : new AppError("EXTERNAL_DEPENDENCY_ERROR", "source fetch failed", { cause: error });
      const failedRun = markSourceFetchRunFailed(
        runningRun,
        this.deps.clock.now().toISOString(),
        appError.code,
        appError.message,
      );

      await this.deps.sources.saveFetchRun(failedRun);
      await this.deps.alerts.create(createAlert({
        id: newId(),
        workspace_id: source.workspace_id,
        severity: "warning",
        source_type: "connector",
        source_id: failedRun.id,
        code: "source.fetch.failed",
        message: appError.message,
        payload: JSON.stringify({ source_id: source.id, error_code: appError.code }),
        created_at: this.deps.clock.now().toISOString(),
      }));
      throw appError;
    }
  }
}

function assertClaimedRunningRun(run: SourceFetchRun): SourceFetchRun {
  if (run.status !== "running") {
    throw new AppError("INVALID_STATE", "claimed source fetch run must already be running", {
      details: { source_fetch_run_id: run.id, status: run.status },
    });
  }

  return run;
}

function addMinutes(isoTimestamp: string, minutes: number): string {
  return new Date(new Date(isoTimestamp).getTime() + minutes * 60_000).toISOString();
}

async function persistRawSourceArtifactOrUndefined(
  artifactStore: ArtifactStore,
  sourceId: string,
  runId: string,
  rawResponse: string | undefined,
  extension: "txt" | "json" | "xml" | undefined,
): Promise<string | undefined> {
  if (!rawResponse || rawResponse.trim() === "") {
    return undefined;
  }

  return artifactStore.writeText({
    category: "source-fetch-responses",
    key: `${sourceId}/${runId}`,
    content: rawResponse,
    extension: extension ?? "txt",
  });
}
