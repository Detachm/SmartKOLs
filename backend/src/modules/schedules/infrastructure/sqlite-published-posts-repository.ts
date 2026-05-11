import type { SqliteStatementExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { PublishedPostsRepository } from "../application/commands/complete-publish-job";

export class SqlitePublishedPostsRepository implements PublishedPostsRepository {
  constructor(private readonly db: SqliteStatementExecutor) {}

  async create(input: {
    id: string;
    workspace_id: string;
    account_id: string;
    draft_id?: string;
    connector_request_id: string;
    external_post_id: string;
    external_post_url?: string;
    content: string;
    published_at: string;
  }): Promise<void> {
    this.createSync(input);
  }

  createSync(input: {
    id: string;
    workspace_id: string;
    account_id: string;
    draft_id?: string;
    connector_request_id: string;
    external_post_id: string;
    external_post_url?: string;
    content: string;
    published_at: string;
  }): void {
    this.db.run(
      `INSERT INTO published_posts (
        id, workspace_id, account_id, draft_id, connector_request_id, external_post_id,
        external_post_url, content, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.workspace_id,
        input.account_id,
        input.draft_id ?? null,
        input.connector_request_id,
        input.external_post_id,
        input.external_post_url ?? null,
        input.content,
        input.published_at,
      ],
    );
  }
}
