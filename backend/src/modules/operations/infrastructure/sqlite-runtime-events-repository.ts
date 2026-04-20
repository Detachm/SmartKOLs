import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { RuntimeEventsRepository } from "../application/ports/runtime-events-repository";
import type { RuntimeEvent } from "../domain/runtime-event";

export class SqliteRuntimeEventsRepository implements RuntimeEventsRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async save(event: RuntimeEvent): Promise<void> {
    this.db.run(
      `INSERT INTO runtime_events (
        id, workspace_id, request_id, process_id, severity, event_type, source_type, source_id, message, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.workspace_id ?? null,
        event.request_id ?? null,
        event.process_id ?? null,
        event.severity,
        event.event_type,
        event.source_type,
        event.source_id ?? null,
        event.message,
        event.payload_json ?? null,
        event.created_at,
      ],
    );
  }
}
