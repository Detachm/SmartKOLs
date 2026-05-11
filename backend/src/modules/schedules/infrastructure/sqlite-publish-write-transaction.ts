import type { RequestContextStore } from "../../../core/request-context/request-context";
import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import { SqliteAuditLogRepository } from "../../audit/infrastructure/sqlite-audit-log-repository";
import { SqliteDraftsRepository } from "../../drafts/infrastructure/sqlite-drafts-repository";
import { SqliteAlertsRepository } from "../../monitoring/infrastructure/sqlite-alerts-repository";
import type { PublishWriteTransaction } from "../application/ports/publish-write-transaction";
import { SqlitePublishedPostsRepository } from "./sqlite-published-posts-repository";
import { SqliteSchedulesRepository } from "./sqlite-schedules-repository";

export class SqlitePublishWriteTransaction implements PublishWriteTransaction {
  constructor(
    private readonly db: SqliteExecutor,
    private readonly requestContext: RequestContextStore,
  ) {}

  async commitPublishCompletion(input: Parameters<PublishWriteTransaction["commitPublishCompletion"]>[0]): Promise<void> {
    this.db.transaction((tx) => {
      const schedules = new SqliteSchedulesRepository(tx);
      const drafts = new SqliteDraftsRepository(tx);
      const publishedPosts = new SqlitePublishedPostsRepository(tx);
      const auditLogs = new SqliteAuditLogRepository(tx, this.requestContext);

      schedules.savePublishJobSync(input.next_job);
      schedules.saveScheduleSync(input.next_schedule);
      drafts.saveSync(input.next_draft);
      publishedPosts.createSync(input.published_post);
      auditLogs.appendSync(input.audit_log);
    });
  }

  async commitPublishFailure(input: Parameters<PublishWriteTransaction["commitPublishFailure"]>[0]): Promise<void> {
    this.db.transaction((tx) => {
      const schedules = new SqliteSchedulesRepository(tx);
      const drafts = new SqliteDraftsRepository(tx);
      const auditLogs = new SqliteAuditLogRepository(tx, this.requestContext);
      const alerts = new SqliteAlertsRepository(tx, this.requestContext);

      schedules.savePublishJobSync(input.next_job);
      schedules.saveScheduleSync(input.next_schedule);
      drafts.saveSync(input.next_draft);
      auditLogs.appendSync(input.audit_log);
      alerts.createSync(input.alert);
    });
  }
}
