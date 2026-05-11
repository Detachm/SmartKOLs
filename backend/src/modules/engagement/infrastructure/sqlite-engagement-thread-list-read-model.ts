import type { EngagementThreadListItem, EngagementThreadListResponse } from "../../../contracts/api/engagement";
import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { EngagementMessage } from "../domain/engagement-message";
import type {
  EngagementChannel,
  EngagementClassification,
  EngagementThread,
  EngagementThreadStatus,
} from "../domain/engagement-thread";
import type { ReplyProposal, ReplyProposalStatus } from "../domain/reply-proposal";
import type { EngagementThreadListReadModel } from "../application/queries/list-account-engagement-threads";

interface EngagementThreadListRow {
  thread_id: string;
  thread_workspace_id: string;
  thread_account_id: string;
  thread_channel: EngagementChannel;
  thread_external_thread_id: string;
  thread_counterpart_handle?: string | null;
  thread_classification: EngagementClassification;
  thread_status: EngagementThreadStatus;
  thread_last_message_at: string;
  thread_created_at: string;
  latest_message_id?: string | null;
  latest_message_external_message_id?: string | null;
  latest_message_direction?: "incoming" | "outgoing" | null;
  latest_message_sender_handle?: string | null;
  latest_message_content?: string | null;
  latest_message_raw_payload?: string | null;
  latest_message_created_at?: string | null;
  latest_proposal_id?: string | null;
  latest_proposal_workspace_id?: string | null;
  latest_proposal_account_id?: string | null;
  latest_proposal_thread_id?: string | null;
  latest_proposal_agent_task_id?: string | null;
  latest_proposal_agent_run_id?: string | null;
  latest_proposal_status?: ReplyProposalStatus | null;
  latest_proposal_content?: string | null;
  latest_proposal_rationale?: string | null;
  latest_proposal_connector_request_id?: string | null;
  latest_proposal_external_reply_id?: string | null;
  latest_proposal_created_at?: string | null;
  latest_proposal_reviewed_at?: string | null;
  latest_proposal_sent_at?: string | null;
  message_count: number;
}

export class SqliteEngagementThreadListReadModel implements EngagementThreadListReadModel {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async listAccountThreads(input: {
    account_id: string;
    channel?: EngagementChannel;
    classification?: EngagementClassification;
    status?: EngagementThreadStatus;
    limit: number;
  }): Promise<EngagementThreadListResponse> {
    const whereClauses = ["et.account_id = ?"];
    const params: Array<string | number> = [input.account_id];

    if (input.channel) {
      whereClauses.push("et.channel = ?");
      params.push(input.channel);
    }

    if (input.classification) {
      whereClauses.push("et.classification = ?");
      params.push(input.classification);
    }

    if (input.status) {
      whereClauses.push("et.status = ?");
      params.push(input.status);
    }

    const rows = this.db.all<EngagementThreadListRow>(
      `SELECT
        et.id AS thread_id,
        et.workspace_id AS thread_workspace_id,
        et.account_id AS thread_account_id,
        et.channel AS thread_channel,
        et.external_thread_id AS thread_external_thread_id,
        et.counterpart_handle AS thread_counterpart_handle,
        et.classification AS thread_classification,
        et.status AS thread_status,
        et.last_message_at AS thread_last_message_at,
        et.created_at AS thread_created_at,
        em.id AS latest_message_id,
        em.external_message_id AS latest_message_external_message_id,
        em.direction AS latest_message_direction,
        em.sender_handle AS latest_message_sender_handle,
        em.content AS latest_message_content,
        em.raw_payload AS latest_message_raw_payload,
        em.created_at AS latest_message_created_at,
        rp.id AS latest_proposal_id,
        rp.workspace_id AS latest_proposal_workspace_id,
        rp.account_id AS latest_proposal_account_id,
        rp.thread_id AS latest_proposal_thread_id,
        rp.agent_task_id AS latest_proposal_agent_task_id,
        rp.agent_run_id AS latest_proposal_agent_run_id,
        rp.status AS latest_proposal_status,
        rp.content AS latest_proposal_content,
        rp.rationale AS latest_proposal_rationale,
        rp.connector_request_id AS latest_proposal_connector_request_id,
        rp.external_reply_id AS latest_proposal_external_reply_id,
        rp.created_at AS latest_proposal_created_at,
        rp.reviewed_at AS latest_proposal_reviewed_at,
        rp.sent_at AS latest_proposal_sent_at,
        (
          SELECT COUNT(*)
          FROM engagement_messages message_count
          WHERE message_count.thread_id = et.id
        ) AS message_count
      FROM engagement_threads et
      LEFT JOIN engagement_messages em ON em.id = (
        SELECT inner_em.id
        FROM engagement_messages inner_em
        WHERE inner_em.thread_id = et.id
        ORDER BY inner_em.created_at DESC, inner_em.id DESC
        LIMIT 1
      )
      LEFT JOIN engagement_reply_proposals rp ON rp.id = (
        SELECT inner_rp.id
        FROM engagement_reply_proposals inner_rp
        WHERE inner_rp.thread_id = et.id
        ORDER BY inner_rp.created_at DESC, inner_rp.id DESC
        LIMIT 1
      )
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY et.last_message_at DESC, et.id DESC
      LIMIT ?`,
      [...params, input.limit],
    );

    return {
      threads: rows.map(mapThreadRow),
    };
  }
}

function mapThreadRow(row: EngagementThreadListRow): EngagementThreadListItem {
  return {
    thread: {
      id: row.thread_id,
      workspace_id: row.thread_workspace_id,
      account_id: row.thread_account_id,
      channel: row.thread_channel,
      external_thread_id: row.thread_external_thread_id,
      counterpart_handle: row.thread_counterpart_handle ?? undefined,
      classification: row.thread_classification,
      status: row.thread_status,
      last_message_at: row.thread_last_message_at,
      created_at: row.thread_created_at,
    },
    latest_message: mapLatestMessage(row),
    latest_proposal: mapLatestProposal(row),
    message_count: row.message_count,
  };
}

function mapLatestMessage(row: EngagementThreadListRow): EngagementMessage | undefined {
  if (
    !row.latest_message_id ||
    !row.latest_message_direction ||
    row.latest_message_content === null ||
    row.latest_message_content === undefined ||
    row.latest_message_raw_payload === null ||
    row.latest_message_raw_payload === undefined ||
    !row.latest_message_created_at
  ) {
    return undefined;
  }

  return {
    id: row.latest_message_id,
    thread_id: row.thread_id,
    external_message_id: row.latest_message_external_message_id ?? undefined,
    direction: row.latest_message_direction,
    sender_handle: row.latest_message_sender_handle ?? undefined,
    content: row.latest_message_content,
    raw_payload: row.latest_message_raw_payload,
    created_at: row.latest_message_created_at,
  };
}

function mapLatestProposal(row: EngagementThreadListRow): ReplyProposal | undefined {
  if (
    !row.latest_proposal_id ||
    !row.latest_proposal_workspace_id ||
    !row.latest_proposal_account_id ||
    !row.latest_proposal_thread_id ||
    !row.latest_proposal_agent_task_id ||
    !row.latest_proposal_agent_run_id ||
    !row.latest_proposal_status ||
    row.latest_proposal_content === null ||
    row.latest_proposal_content === undefined ||
    row.latest_proposal_rationale === null ||
    row.latest_proposal_rationale === undefined ||
    !row.latest_proposal_created_at
  ) {
    return undefined;
  }

  return {
    id: row.latest_proposal_id,
    workspace_id: row.latest_proposal_workspace_id,
    account_id: row.latest_proposal_account_id,
    thread_id: row.latest_proposal_thread_id,
    agent_task_id: row.latest_proposal_agent_task_id,
    agent_run_id: row.latest_proposal_agent_run_id,
    status: row.latest_proposal_status,
    content: row.latest_proposal_content,
    rationale: row.latest_proposal_rationale,
    connector_request_id: row.latest_proposal_connector_request_id ?? undefined,
    external_reply_id: row.latest_proposal_external_reply_id ?? undefined,
    created_at: row.latest_proposal_created_at,
    reviewed_at: row.latest_proposal_reviewed_at ?? undefined,
    sent_at: row.latest_proposal_sent_at ?? undefined,
  };
}
