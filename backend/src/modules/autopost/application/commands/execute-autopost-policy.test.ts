import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../../../../core/errors/app-error";
import { ExecuteAutopostPolicy } from "./execute-autopost-policy";

function buildPolicy(overrides: Partial<Parameters<ExecuteAutopostPolicy["execute"]>[0]> = {}) {
  void overrides;
  return {
    id: "policy_1",
    workspace_id: "ws_1",
    account_id: "acct_1",
    cadence_body: {
      timezone: "UTC",
      weekday_codes: ["mon"],
      slot_times: ["09:00"],
      min_spacing_minutes: 90,
    },
    content_strategy_body: {
      generation_mode: "from_source_scope" as const,
      source_types: ["rss"] as const,
      max_source_age_days: 7,
    },
    execution_body: {
      draft_review_mode: "auto_approve" as const,
      auto_queue_publish: true,
    },
    status: "active" as const,
    next_run_after: "2026-04-22T09:00:00.000Z",
    updated_at: "2026-04-21T09:00:00.000Z",
  };
}

function buildSource(id: string, lastFetchedAt?: string) {
  return {
    id,
    workspace_id: "ws_1",
    account_id: "acct_1",
    type: "rss" as const,
    name: id,
    url: `https://example.com/${id}`,
    status: "active" as const,
    last_fetched_at: lastFetchedAt,
    created_at: "2026-04-21T09:00:00.000Z",
  };
}

function buildDocument(sourceId: string) {
  return {
    id: `doc_${sourceId}`,
    workspace_id: "ws_1",
    source_id: sourceId,
    canonical_url: `https://example.com/${sourceId}/doc`,
    title: `Doc ${sourceId}`,
    summary: "summary",
    body_text: "body",
    language: "en",
    published_at: "2026-04-21T09:00:00.000Z",
    content_hash: `hash_${sourceId}`,
    created_at: "2026-04-21T09:00:00.000Z",
  };
}

test("ExecuteAutopostPolicy blocks when no configured source refreshes recently enough", async () => {
  const savedRuns: Array<{ status: string; error_message?: string }> = [];
  const alerts: string[] = [];
  const sources = [buildSource("source_1")];

  const command = new ExecuteAutopostPolicy({
    policies: {
      findById: async () => buildPolicy(),
      findByAccountId: async () => buildPolicy(),
      save: async () => undefined,
    } as never,
    runs: {
      findActiveByPolicyId: async () => null,
      save: async (run: { status: string; error_message?: string }) => {
        savedRuns.push(run);
      },
    } as never,
    workerJobs: {
      cancelQueuedByTypeAndTarget: async () => undefined,
      create: async () => undefined,
    } as never,
    sources: {
      listSourcesByAccountId: async () => sources,
    } as never,
    sourceDocuments: {
      listAccountSourceDocuments: async () => ({
        documents: [],
      }),
    } as never,
    fetchSource: {
      execute: async () => {
        throw new AppError("SOURCE_FETCH_NETWORK_ERROR", "rss fetch failed");
      },
    } as never,
    executeSourceFetchRun: {} as never,
    trends: {
      listByWorkspaceId: async () => [],
    } as never,
    refreshTrends: {
      execute: async () => undefined,
    } as never,
    generateContentBrief: {
      execute: async () => {
        throw new Error("should not generate content brief when freshness gate blocks");
      },
    } as never,
    auditLogs: {
      append: async () => undefined,
    } as never,
    alerts: {
      create: async (alert: { code: string }) => {
        alerts.push(alert.code);
      },
    } as never,
    clock: {
      now: () => new Date("2026-04-21T08:30:00.000Z"),
    },
  });

  await assert.rejects(async () => {
    await command.execute({ policy_id: "policy_1", trigger: "scheduled" });
  }, (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, "EXTERNAL_DEPENDENCY_ERROR");
    assert.match(error.message, /freshness gate blocked execution/);
    return true;
  });

  assert.equal(savedRuns.at(-1)?.status, "failed");
  assert.deepEqual(alerts, ["autopost.run.failed"]);
});

test("ExecuteAutopostPolicy warns but continues when some sources fail and at least one stays fresh", async () => {
  const savedRuns: Array<{ status: string; brief_task_id?: string }> = [];
  const auditActions: string[] = [];
  const alertCodes: string[] = [];
  const sources = [buildSource("source_1"), buildSource("source_2")];

  const command = new ExecuteAutopostPolicy({
    policies: {
      findById: async () => buildPolicy(),
      findByAccountId: async () => buildPolicy(),
      save: async () => undefined,
    } as never,
    runs: {
      findActiveByPolicyId: async () => null,
      save: async (run: { status: string; brief_task_id?: string }) => {
        savedRuns.push(run);
      },
    } as never,
    workerJobs: {
      cancelQueuedByTypeAndTarget: async () => undefined,
      create: async () => undefined,
    } as never,
    sources: {
      listSourcesByAccountId: async () => sources,
    } as never,
    sourceDocuments: {
      listAccountSourceDocuments: async () => ({
        documents: [
          {
            document: buildDocument("source_1"),
            source: sources[0]!,
          },
        ],
      }),
    } as never,
    fetchSource: {
      execute: async (sourceId: string) => {
        if (sourceId === "source_1") {
          sources[0] = buildSource("source_1", "2026-04-21T08:30:00.000Z");
          return {
            run_id: "fetch_1",
            status: "succeeded" as const,
            imported_count: 1,
          };
        }

        throw new AppError("SOURCE_FETCH_UPSTREAM_5XX", "rss fetch failed");
      },
    } as never,
    executeSourceFetchRun: {} as never,
    trends: {
      listByWorkspaceId: async () => [],
    } as never,
    refreshTrends: {
      execute: async () => undefined,
    } as never,
    generateContentBrief: {
      execute: async () => ({
        task_id: "task_1",
        status: "queued" as const,
        brief_id: "brief_1",
      }),
    } as never,
    auditLogs: {
      append: async (entry: { action: string }) => {
        auditActions.push(entry.action);
      },
    } as never,
    alerts: {
      create: async (alert: { code: string }) => {
        alertCodes.push(alert.code);
      },
    } as never,
    clock: {
      now: () => new Date("2026-04-21T08:30:00.000Z"),
    },
  });

  const result = await command.execute({ policy_id: "policy_1", trigger: "scheduled" });

  assert.equal(result.run.status, "brief_generating");
  assert.equal(savedRuns.at(-1)?.status, "brief_generating");
  assert.ok(auditActions.includes("autopost_run.source_refresh_degraded"));
  assert.ok(alertCodes.includes("autopost.source_refresh.partial_failure"));
  assert.ok(!alertCodes.includes("autopost.run.failed"));
});
