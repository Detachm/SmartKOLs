import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { GenerateDraft } from "../../../drafts/application/commands/generate-draft";
import { createAutopostAutomationContext } from "../../domain/autopost-automation-context";
import { markAutopostRunDraftGenerating } from "../../domain/autopost-run";
import type { AutopostRunsRepository } from "../ports/autopost-runs-repository";
import type { FailAutopostRun } from "./fail-autopost-run";

export interface ContinueAutopostRunFromBriefDependencies {
  runs: AutopostRunsRepository;
  generateDraft: GenerateDraft;
  failAutopostRun: FailAutopostRun;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class ContinueAutopostRunFromBrief {
  constructor(private readonly deps: ContinueAutopostRunFromBriefDependencies) {}

  async execute(runId: string) {
    const run = await this.deps.runs.findById(runId);
    if (!run) {
      throw new AppError("NOT_FOUND", "autopost run not found", {
        details: { autopost_run_id: runId },
      });
    }
    if (run.status !== "brief_generating" || !run.brief_id) {
      throw new AppError("INVALID_STATE", "autopost run is not ready to continue from brief", {
        details: { autopost_run_id: run.id, status: run.status, brief_id: run.brief_id },
      });
    }

    try {
      const draft = await this.deps.generateDraft.execute({
        account_id: run.account_id,
        content_brief_id: run.brief_id,
        automation: createAutopostAutomationContext({
          kind: "autopost",
          policy_id: run.policy_id,
          run_id: run.id,
        }),
      });
      const now = this.deps.clock.now().toISOString();
      const nextRun = markAutopostRunDraftGenerating(run, {
        draft_task_id: draft.task_id,
        updated_at: now,
      });

      await this.deps.runs.save(nextRun);
      await this.deps.auditLogs.append({
        id: newId(),
        workspace_id: run.workspace_id,
        actor_type: "system",
        entity_type: "autopost_run",
        entity_id: run.id,
        action: "autopost_run.draft_generation_queued",
        before_state: JSON.stringify(run),
        after_state: JSON.stringify(nextRun),
        created_at: now,
      });

      return {
        run: nextRun,
        task_id: draft.task_id,
        status: draft.status,
      };
    } catch (error) {
      const appError = error instanceof AppError
        ? error
        : new AppError("EXTERNAL_DEPENDENCY_ERROR", "autopost draft generation enqueue failed", { cause: error });
      await this.deps.failAutopostRun.execute(run.id, appError.code, appError.message);
      throw appError;
    }
  }
}
