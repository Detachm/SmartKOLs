import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import { DEFAULT_MAX_PENDING_MANUAL_REVIEW_DRAFTS } from "../../autopost/domain/autopost-policy";
import { createEngagementPolicy, type EngagementPolicyRule } from "../../engagement/domain/engagement-policy";
import type {
  AccountAutomationOverview,
  AccountAutomationOverviewReadModel,
} from "../application/ports/account-automation-overview-read-model";

interface AccountRow {
  id: string;
  workspace_id: string;
  handle: string;
}

interface StateRow {
  account_id: string;
  workspace_id: string;
  status: "active" | "paused";
  next_tick_after?: string | null;
  last_tick_at?: string | null;
  active_run_id?: string | null;
  last_decision_type?: string | null;
  last_reason_code?: string | null;
  created_at: string;
  updated_at: string;
}

interface CountRow {
  count: number;
}

interface EngagementPolicyStatusRow {
  status: "active" | "paused";
  policy_body?: string | null;
}

interface TaskRow {
  id: string;
  task_type: "content_brief.generate" | "draft.generate";
  status: "queued" | "running";
  created_at: string;
}

interface BriefRow {
  id: string;
  generation_mode: "from_trend" | "from_documents" | "from_source_scope";
  topic?: string | null;
  updated_at: string;
  created_at: string;
}

interface RecurringPlanRow {
  id: string;
  name: string;
  generation_mode: "from_trend" | "from_source_scope";
  next_run_after: string;
  default_topic_hint?: string | null;
}

interface AutopostPolicyRow {
  id: string;
  generation_mode: "from_trend" | "from_source_scope";
  next_run_after: string;
  draft_review_mode: "manual" | "auto_approve";
  auto_queue_publish: 0 | 1;
  max_pending_manual_review_drafts?: number | null;
}

interface AutopostRunRow {
  id: string;
  policy_id: string;
  status: "queued" | "brief_generating" | "draft_generating";
  scheduled_for: string;
  brief_id?: string | null;
  brief_task_id?: string | null;
  draft_id?: string | null;
  draft_task_id?: string | null;
}

interface AgentTaskStatusRow {
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
}

interface GeneratedDraftRow {
  id: string;
}

interface EngagementThreadCandidateRow {
  id: string;
  channel: "mention" | "reply" | "dm" | "comment";
  classification: "collab" | "commerce" | "spam" | "normal" | "support";
  status: "open" | "pending_action" | "closed" | "ignored";
  last_message_at: string;
}

interface ReplyProposalBacklogRow {
  id: string;
  thread_id: string;
  created_at: string;
  reviewed_at?: string | null;
}

export class SqliteAccountAutomationOverviewReadModel implements AccountAutomationOverviewReadModel {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async getAccountAutomationOverview(accountId: string): Promise<AccountAutomationOverview | null> {
    const account = this.db.get<AccountRow>(
      `SELECT id, workspace_id, handle
      FROM accounts
      WHERE id = ?`,
      [accountId],
    );
    if (!account) {
      return null;
    }

    const state = this.db.get<StateRow>(
      `SELECT
        account_id, workspace_id, status, next_tick_after, last_tick_at, active_run_id,
        last_decision_type, last_reason_code, created_at, updated_at
      FROM account_orchestration_states
      WHERE account_id = ?`,
      [accountId],
    );
    const pendingDraftCount = this.db.get<CountRow>(
      `SELECT COUNT(*) AS count
      FROM drafts
      WHERE account_id = ? AND status = 'pending'`,
      [accountId],
    )?.count ?? 0;
    const pendingManualReviewDraftCount = this.db.get<CountRow>(
      `SELECT COUNT(*) AS count
      FROM drafts d
      WHERE d.account_id = ?
        AND d.status = 'pending'
        AND COALESCE((
          SELECT json_extract(ap.execution_body, '$.draft_review_mode')
          FROM autopost_runs apr
          INNER JOIN autopost_policies ap ON ap.id = apr.policy_id
          LEFT JOIN agent_runs ar ON ar.id = d.generated_by_run_id
          WHERE apr.draft_id = d.id
            OR (ar.task_id IS NOT NULL AND apr.draft_task_id = ar.task_id)
          ORDER BY apr.updated_at DESC, apr.id DESC
          LIMIT 1
        ), 'manual') != 'auto_approve'`,
      [accountId],
    )?.count ?? 0;
    const pendingAutoApproveDraftCount = this.db.get<CountRow>(
      `SELECT COUNT(*) AS count
      FROM drafts d
      WHERE d.account_id = ?
        AND d.status = 'pending'
        AND COALESCE((
          SELECT json_extract(ap.execution_body, '$.draft_review_mode')
          FROM autopost_runs apr
          INNER JOIN autopost_policies ap ON ap.id = apr.policy_id
          LEFT JOIN agent_runs ar ON ar.id = d.generated_by_run_id
          WHERE apr.draft_id = d.id
            OR (ar.task_id IS NOT NULL AND apr.draft_task_id = ar.task_id)
          ORDER BY apr.updated_at DESC, apr.id DESC
          LIMIT 1
        ), 'manual') = 'auto_approve'`,
      [accountId],
    )?.count ?? 0;
    const contentTasks = this.db.all<TaskRow>(
      `SELECT id, task_type, status, created_at
      FROM agent_tasks
      WHERE target_type = 'account' AND target_id = ?
        AND task_type IN ('content_brief.generate', 'draft.generate')
        AND status IN ('queued', 'running')
      ORDER BY created_at ASC, id ASC`,
      [accountId],
    );
    const latestReadyBrief = this.db.get<BriefRow>(
      `SELECT cb.id, cb.generation_mode, cb.topic, cb.updated_at, cb.created_at
      FROM content_briefs cb
      WHERE cb.account_id = ?
        AND cb.status = 'ready'
        AND cb.updated_at >= COALESCE(?, cb.updated_at)
        AND NOT EXISTS (
          SELECT 1
          FROM draft_versions dv
          JOIN drafts d ON d.id = dv.draft_id
          WHERE d.account_id = cb.account_id
            AND json_extract(dv.metadata, '$.content_brief_id') = cb.id
        )
      ORDER BY cb.updated_at DESC, cb.id DESC
      LIMIT 1`,
      [accountId, state?.created_at ?? null],
    );
    const nextDueAt = this.db.get<{ next_due_at?: string | null }>(
      `SELECT MIN(due_at) AS next_due_at
      FROM (
        SELECT next_run_after AS due_at
        FROM autopost_policies
        WHERE account_id = ? AND status = 'active' AND next_run_after IS NOT NULL
        UNION ALL
        SELECT next_run_after AS due_at
        FROM recurring_brief_plans
        WHERE account_id = ? AND status = 'active' AND next_run_after IS NOT NULL
      )`,
      [accountId, accountId],
    )?.next_due_at ?? undefined;
    const nextDueRecurringPlan = this.db.get<RecurringPlanRow>(
      `SELECT
        id,
        name,
        json_extract(strategy_body, '$.generation_mode') AS generation_mode,
        next_run_after,
        json_extract(strategy_body, '$.default_topic_hint') AS default_topic_hint
      FROM recurring_brief_plans
      WHERE account_id = ? AND status = 'active' AND next_run_after IS NOT NULL
      ORDER BY next_run_after ASC, id ASC
      LIMIT 1`,
      [accountId],
    );
    const nextDueAutopostPolicy = this.db.get<AutopostPolicyRow>(
      `SELECT
        id,
        json_extract(content_strategy_body, '$.generation_mode') AS generation_mode,
        next_run_after,
        json_extract(execution_body, '$.draft_review_mode') AS draft_review_mode,
        json_extract(execution_body, '$.auto_queue_publish') AS auto_queue_publish,
        json_extract(execution_body, '$.max_pending_manual_review_drafts') AS max_pending_manual_review_drafts
      FROM autopost_policies
      WHERE account_id = ? AND status = 'active' AND next_run_after IS NOT NULL
      ORDER BY next_run_after ASC, id ASC
      LIMIT 1`,
      [accountId],
    );
    const activeAutopostRun = this.db.get<AutopostRunRow>(
      `SELECT
        id,
        policy_id,
        status,
        scheduled_for,
        brief_id,
        brief_task_id,
        draft_id,
        draft_task_id
      FROM autopost_runs
      WHERE account_id = ? AND status IN ('queued', 'brief_generating', 'draft_generating')
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
      [accountId],
    );
    const briefTaskStatus = activeAutopostRun?.brief_task_id
      ? this.db.get<AgentTaskStatusRow>(
        `SELECT status FROM agent_tasks WHERE id = ?`,
        [activeAutopostRun.brief_task_id],
      )?.status
      : undefined;
    const draftTaskStatus = activeAutopostRun?.draft_task_id
      ? this.db.get<AgentTaskStatusRow>(
        `SELECT status FROM agent_tasks WHERE id = ?`,
        [activeAutopostRun.draft_task_id],
      )?.status
      : undefined;
    const resolvedDraftId = activeAutopostRun?.draft_id
      ?? (activeAutopostRun?.draft_task_id
        ? this.db.get<GeneratedDraftRow>(
          `SELECT d.id
          FROM drafts d
          JOIN agent_runs ar ON ar.id = d.generated_by_run_id
          WHERE ar.task_id = ?
          ORDER BY d.created_at DESC, d.id DESC
          LIMIT 1`,
          [activeAutopostRun.draft_task_id],
        )?.id
        : undefined);
    const maxPendingManualReviewDrafts = normalizeMaxPendingManualReviewDrafts(
      nextDueAutopostPolicy?.max_pending_manual_review_drafts,
    );
    const activeAutomationCount = this.db.get<CountRow>(
      `SELECT (
        SELECT COUNT(*) FROM autopost_policies WHERE account_id = ? AND status = 'active'
      ) + (
        SELECT COUNT(*) FROM recurring_brief_plans WHERE account_id = ? AND status = 'active'
      ) + (
        SELECT COUNT(*) FROM engagement_policies WHERE account_id = ? AND status = 'active'
      ) AS count`,
      [accountId, accountId, accountId],
    )?.count ?? 0;
    const engagementPolicy = this.db.get<EngagementPolicyStatusRow>(
      `SELECT status, policy_body
      FROM engagement_policies
      WHERE account_id = ?`,
      [accountId],
    );
    const engagementPolicyBody = engagementPolicy?.policy_body
      ? createEngagementPolicy({
        id: "read-model",
        workspace_id: account.workspace_id,
        account_id: account.id,
        policy_body: JSON.parse(engagementPolicy.policy_body) as EngagementPolicyRule,
        status: engagementPolicy.status,
        updated_at: "1970-01-01T00:00:00.000Z",
      }).policy_body
      : undefined;
    const openEngagementThreadCount = this.db.get<CountRow>(
      `SELECT COUNT(*) AS count
      FROM engagement_threads
      WHERE account_id = ? AND status = 'open'`,
      [accountId],
    )?.count ?? 0;
    const policyBlockedOpenThreadCount = !engagementPolicy
      ? openEngagementThreadCount
      : engagementPolicy.status !== "active"
        ? openEngagementThreadCount
        : this.db.get<CountRow>(
          `SELECT COUNT(*) AS count
          FROM engagement_threads et
          WHERE et.account_id = ?
            AND et.status = 'open'
            AND (
              NOT EXISTS (
                SELECT 1
                FROM engagement_policies ep
                WHERE ep.account_id = et.account_id
                  AND ep.status = 'active'
                  AND EXISTS (
                    SELECT 1
                    FROM json_each(json_extract(ep.policy_body, '$.allowed_channels')) allowed_channel
                    WHERE allowed_channel.value = et.channel
                  )
              )
              OR EXISTS (
                SELECT 1
                FROM engagement_policies ep
                WHERE ep.account_id = et.account_id
                  AND ep.status = 'active'
                  AND EXISTS (
                    SELECT 1
                    FROM json_each(json_extract(ep.policy_body, '$.blocked_classifications')) blocked_classification
                    WHERE blocked_classification.value = et.classification
                  )
              )
            )`,
          [accountId],
        )?.count ?? 0;
    const approvedReplyPendingSendCount = this.db.get<CountRow>(
      `SELECT COUNT(*) AS count
      FROM engagement_reply_proposals
      WHERE account_id = ? AND status = 'approved'`,
      [accountId],
    )?.count ?? 0;
    const pendingReviewReplyCount = this.db.get<CountRow>(
      `SELECT COUNT(*) AS count
      FROM engagement_reply_proposals
      WHERE account_id = ? AND status = 'pending_review'`,
      [accountId],
    )?.count ?? 0;
    const nextPendingReviewReply = this.db.get<ReplyProposalBacklogRow>(
      `SELECT id, thread_id, created_at, reviewed_at
      FROM engagement_reply_proposals
      WHERE account_id = ? AND status = 'pending_review'
      ORDER BY created_at ASC, id ASC
      LIMIT 1`,
      [accountId],
    );
    const nextApprovedReplyPendingSend = this.db.get<ReplyProposalBacklogRow>(
      `SELECT id, thread_id, created_at, reviewed_at
      FROM engagement_reply_proposals
      WHERE account_id = ? AND status = 'approved'
      ORDER BY COALESCE(reviewed_at, created_at) ASC, id ASC
      LIMIT 1`,
      [accountId],
    );
    const todayFollowCount = this.db.get<CountRow>(
      `SELECT COUNT(*) AS count
      FROM connector_requests
      WHERE account_id = ?
        AND endpoint_code = 'user.follow'
        AND status = 'succeeded'
        AND date(COALESCE(finished_at, started_at)) = date('now')`,
      [accountId],
    )?.count ?? 0;
    const todayRepostCount = this.db.get<CountRow>(
      `SELECT COUNT(*) AS count
      FROM connector_requests
      WHERE account_id = ?
        AND endpoint_code = 'post.repost'
        AND status = 'succeeded'
        AND date(COALESCE(finished_at, started_at)) = date('now')`,
      [accountId],
    )?.count ?? 0;
    const todayCommentCount = this.db.get<CountRow>(
      `SELECT COUNT(*) AS count
      FROM connector_requests
      WHERE account_id = ?
        AND endpoint_code = 'post.comment'
        AND status = 'succeeded'
        AND date(COALESCE(finished_at, started_at)) = date('now')`,
      [accountId],
    )?.count ?? 0;
    const todayReplyCount = this.db.get<CountRow>(
      `SELECT COUNT(*) AS count
      FROM connector_requests
      WHERE account_id = ?
        AND endpoint_code = 'post.reply'
        AND status = 'succeeded'
        AND date(COALESCE(finished_at, started_at)) = date('now')`,
      [accountId],
    )?.count ?? 0;
    const nextReplyCandidateThread = this.db.get<EngagementThreadCandidateRow>(
      `SELECT
        et.id,
        et.channel,
        et.classification,
        et.status,
        et.last_message_at
      FROM engagement_threads et
      WHERE et.account_id = ?
        AND et.status = 'open'
        AND EXISTS (
          SELECT 1
          FROM engagement_policies ep
          WHERE ep.account_id = et.account_id
            AND ep.status = 'active'
            AND EXISTS (
              SELECT 1
              FROM json_each(json_extract(ep.policy_body, '$.allowed_channels')) allowed_channel
              WHERE allowed_channel.value = et.channel
            )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM engagement_policies ep
          WHERE ep.account_id = et.account_id
            AND ep.status = 'active'
            AND EXISTS (
              SELECT 1
              FROM json_each(json_extract(ep.policy_body, '$.blocked_classifications')) blocked_classification
              WHERE blocked_classification.value = et.classification
            )
        )
        AND EXISTS (
          SELECT 1
          FROM agent_tasks at
          WHERE at.target_type = 'engagement_thread'
            AND at.target_id = et.id
            AND at.task_type = 'inbox.classify'
            AND at.status = 'succeeded'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM engagement_reply_proposals rp
          WHERE rp.thread_id = et.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM agent_tasks at
          WHERE at.target_type = 'engagement_thread'
            AND at.target_id = et.id
            AND at.task_type = 'engagement.reply_propose'
            AND at.status IN ('queued', 'running')
        )
      ORDER BY et.last_message_at DESC, et.id DESC
      LIMIT 1`,
      [accountId],
    );
    const nextClassificationCandidateThread = this.db.get<EngagementThreadCandidateRow>(
      `SELECT
        et.id,
        et.channel,
        et.classification,
        et.status,
        et.last_message_at
      FROM engagement_threads et
      WHERE et.account_id = ?
        AND et.status = 'open'
        AND EXISTS (
          SELECT 1
          FROM engagement_policies ep
          WHERE ep.account_id = et.account_id
            AND ep.status = 'active'
            AND EXISTS (
              SELECT 1
              FROM json_each(json_extract(ep.policy_body, '$.allowed_channels')) allowed_channel
              WHERE allowed_channel.value = et.channel
            )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM agent_tasks at
          WHERE at.target_type = 'engagement_thread'
            AND at.target_id = et.id
            AND at.task_type = 'inbox.classify'
            AND at.status IN ('queued', 'running', 'succeeded', 'failed')
        )
        AND NOT EXISTS (
          SELECT 1
          FROM engagement_reply_proposals rp
          WHERE rp.thread_id = et.id
        )
      ORDER BY et.last_message_at DESC, et.id DESC
      LIMIT 1`,
      [accountId],
    );

    return {
      account_id: account.id,
      workspace_id: account.workspace_id,
      account_handle: account.handle,
      state: state ? {
        account_id: state.account_id,
        workspace_id: state.workspace_id,
        status: state.status,
        next_tick_after: state.next_tick_after ?? undefined,
        last_tick_at: state.last_tick_at ?? undefined,
        active_run_id: state.active_run_id ?? undefined,
        last_decision_type: state.last_decision_type ?? undefined,
        last_reason_code: state.last_reason_code ?? undefined,
        created_at: state.created_at,
        updated_at: state.updated_at,
      } : undefined,
      has_active_automation: activeAutomationCount > 0,
      next_due_at: nextDueAt ?? undefined,
      pending_draft_count: pendingDraftCount,
      pending_manual_review_draft_count: pendingManualReviewDraftCount,
      pending_auto_approve_draft_count: pendingAutoApproveDraftCount,
      max_pending_manual_review_drafts: maxPendingManualReviewDrafts,
      queued_or_running_content_tasks: contentTasks.map((task) => ({
        task_id: task.id,
        task_type: task.task_type,
        status: task.status,
        created_at: task.created_at,
      })),
      latest_ready_brief_without_draft: latestReadyBrief ? {
        brief_id: latestReadyBrief.id,
        generation_mode: latestReadyBrief.generation_mode,
        topic: latestReadyBrief.topic ?? undefined,
        updated_at: latestReadyBrief.updated_at,
        created_at: latestReadyBrief.created_at,
      } : undefined,
      next_due_recurring_plan: nextDueRecurringPlan ? {
        plan_id: nextDueRecurringPlan.id,
        name: nextDueRecurringPlan.name,
        generation_mode: nextDueRecurringPlan.generation_mode,
        next_run_after: nextDueRecurringPlan.next_run_after,
        default_topic_hint: nextDueRecurringPlan.default_topic_hint ?? undefined,
      } : undefined,
      next_due_autopost_policy: nextDueAutopostPolicy ? {
        policy_id: nextDueAutopostPolicy.id,
        generation_mode: nextDueAutopostPolicy.generation_mode,
        next_run_after: nextDueAutopostPolicy.next_run_after,
        draft_review_mode: nextDueAutopostPolicy.draft_review_mode,
        auto_queue_publish: Boolean(nextDueAutopostPolicy.auto_queue_publish),
        max_pending_manual_review_drafts: maxPendingManualReviewDrafts,
      } : undefined,
      active_autopost_run: activeAutopostRun ? {
        run_id: activeAutopostRun.id,
        policy_id: activeAutopostRun.policy_id,
        status: activeAutopostRun.status,
        scheduled_for: activeAutopostRun.scheduled_for,
        brief_id: activeAutopostRun.brief_id ?? undefined,
        brief_task_id: activeAutopostRun.brief_task_id ?? undefined,
        brief_task_status: briefTaskStatus,
        draft_id: resolvedDraftId ?? undefined,
        draft_task_id: activeAutopostRun.draft_task_id ?? undefined,
        draft_task_status: draftTaskStatus,
      } : undefined,
      next_classification_candidate_thread: nextClassificationCandidateThread ? {
        thread_id: nextClassificationCandidateThread.id,
        channel: nextClassificationCandidateThread.channel,
        classification: nextClassificationCandidateThread.classification,
        status: nextClassificationCandidateThread.status,
        last_message_at: nextClassificationCandidateThread.last_message_at,
      } : undefined,
      next_reply_candidate_thread: nextReplyCandidateThread ? {
        thread_id: nextReplyCandidateThread.id,
        channel: nextReplyCandidateThread.channel,
        classification: nextReplyCandidateThread.classification,
        status: nextReplyCandidateThread.status,
        last_message_at: nextReplyCandidateThread.last_message_at,
      } : undefined,
      engagement_automation: {
        policy_body: engagementPolicyBody,
        policy_status: engagementPolicy?.status ?? "not_configured",
        open_thread_count: openEngagementThreadCount,
        policy_blocked_open_thread_count: policyBlockedOpenThreadCount,
        pending_review_reply_count: pendingReviewReplyCount,
        approved_reply_pending_send_count: approvedReplyPendingSendCount,
        today_follow_count: todayFollowCount,
        today_repost_count: todayRepostCount,
        today_comment_count: todayCommentCount,
        today_reply_count: todayReplyCount,
        next_pending_review_reply: nextPendingReviewReply ? {
          proposal_id: nextPendingReviewReply.id,
          thread_id: nextPendingReviewReply.thread_id,
          created_at: nextPendingReviewReply.created_at,
        } : undefined,
        next_approved_reply_pending_send: nextApprovedReplyPendingSend ? {
          proposal_id: nextApprovedReplyPendingSend.id,
          thread_id: nextApprovedReplyPendingSend.thread_id,
          reviewed_at: nextApprovedReplyPendingSend.reviewed_at ?? undefined,
          created_at: nextApprovedReplyPendingSend.created_at,
        } : undefined,
      },
    };
  }
}

function normalizeMaxPendingManualReviewDrafts(value: unknown) {
  return Number.isInteger(value) && (value as number) >= 1
    ? value as number
    : DEFAULT_MAX_PENDING_MANUAL_REVIEW_DRAFTS;
}
