import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { EngagementRepository } from "../application/ports/engagement-repository";
import type { EngagementThread } from "../domain/engagement-thread";
import type { EngagementMessage } from "../domain/engagement-message";
import type { ReplyProposal } from "../domain/reply-proposal";

export class SqliteEngagementRepository implements EngagementRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async findThreadById(threadId: string): Promise<EngagementThread | null> {
    return this.db.get<EngagementThread>(
      `SELECT
        id, workspace_id, account_id, channel, external_thread_id, counterpart_handle,
        classification, status, last_message_at, created_at
      FROM engagement_threads
      WHERE id = ?`,
      [threadId],
    );
  }

  async findThreadByExternalId(accountId: string, externalThreadId: string): Promise<EngagementThread | null> {
    return this.db.get<EngagementThread>(
      `SELECT
        id, workspace_id, account_id, channel, external_thread_id, counterpart_handle,
        classification, status, last_message_at, created_at
      FROM engagement_threads
      WHERE account_id = ? AND external_thread_id = ?`,
      [accountId, externalThreadId],
    );
  }

  async saveThread(thread: EngagementThread): Promise<void> {
    this.db.run(
      `INSERT INTO engagement_threads (
        id, workspace_id, account_id, channel, external_thread_id, counterpart_handle,
        classification, status, last_message_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        counterpart_handle = excluded.counterpart_handle,
        classification = excluded.classification,
        status = excluded.status,
        last_message_at = excluded.last_message_at`,
      [
        thread.id,
        thread.workspace_id,
        thread.account_id,
        thread.channel,
        thread.external_thread_id,
        thread.counterpart_handle ?? null,
        thread.classification,
        thread.status,
        thread.last_message_at,
        thread.created_at,
      ],
    );
  }

  async listMessagesByThreadId(threadId: string): Promise<EngagementMessage[]> {
    return this.db.all<EngagementMessage>(
      `SELECT
        id, thread_id, external_message_id, direction, sender_handle, content, raw_payload, created_at
      FROM engagement_messages
      WHERE thread_id = ?
      ORDER BY created_at ASC`,
      [threadId],
    );
  }

  async findReplyProposalById(proposalId: string): Promise<ReplyProposal | null> {
    return this.db.get<ReplyProposal>(
      `SELECT
        id, workspace_id, account_id, thread_id, agent_task_id, agent_run_id, status,
        content, rationale, connector_request_id, external_reply_id, created_at, reviewed_at, sent_at
      FROM engagement_reply_proposals
      WHERE id = ?`,
      [proposalId],
    );
  }

  async listReplyProposalsByThreadId(threadId: string): Promise<ReplyProposal[]> {
    return this.db.all<ReplyProposal>(
      `SELECT
        id, workspace_id, account_id, thread_id, agent_task_id, agent_run_id, status,
        content, rationale, connector_request_id, external_reply_id, created_at, reviewed_at, sent_at
      FROM engagement_reply_proposals
      WHERE thread_id = ?
      ORDER BY created_at DESC`,
      [threadId],
    );
  }

  async createMessage(message: EngagementMessage): Promise<boolean> {
    const result = this.db.run(
      `INSERT OR IGNORE INTO engagement_messages (
        id, thread_id, external_message_id, direction, sender_handle, content, raw_payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        message.id,
        message.thread_id,
        message.external_message_id ?? null,
        message.direction,
        message.sender_handle ?? null,
        message.content,
        message.raw_payload,
        message.created_at,
      ],
    );
    return result.changes > 0;
  }

  async saveReplyProposal(proposal: ReplyProposal): Promise<void> {
    this.db.run(
      `INSERT INTO engagement_reply_proposals (
        id, workspace_id, account_id, thread_id, agent_task_id, agent_run_id, status,
        content, rationale, connector_request_id, external_reply_id, created_at, reviewed_at, sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        content = excluded.content,
        rationale = excluded.rationale,
        connector_request_id = excluded.connector_request_id,
        external_reply_id = excluded.external_reply_id,
        reviewed_at = excluded.reviewed_at,
        sent_at = excluded.sent_at`,
      [
        proposal.id,
        proposal.workspace_id,
        proposal.account_id,
        proposal.thread_id,
        proposal.agent_task_id,
        proposal.agent_run_id,
        proposal.status,
        proposal.content,
        proposal.rationale,
        proposal.connector_request_id ?? null,
        proposal.external_reply_id ?? null,
        proposal.created_at,
        proposal.reviewed_at ?? null,
        proposal.sent_at ?? null,
      ],
    );
  }
}
