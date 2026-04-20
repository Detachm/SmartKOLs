import { newId } from "../../../core/ids/new-id";
import type { RequestContextStore } from "../../../core/request-context/request-context";
import type { Clock } from "../../../core/time/clock";
import type { RuntimeEventsRepository } from "../application/ports/runtime-events-repository";
import type { RuntimeEventSeverity } from "../domain/runtime-event";

export interface StructuredLogInput {
  workspace_id?: string;
  request_id?: string;
  process_id?: string;
  severity: RuntimeEventSeverity;
  event_type: string;
  source_type: string;
  source_id?: string;
  message: string;
  payload?: Record<string, unknown>;
}

export class StructuredLogger {
  constructor(
    private readonly deps: {
      events: RuntimeEventsRepository;
      requestContext: RequestContextStore;
      clock: Clock;
      default_process_id?: string;
    },
  ) {}

  async emit(input: StructuredLogInput): Promise<void> {
    const createdAt = this.deps.clock.now().toISOString();
    const requestId = input.request_id ?? this.deps.requestContext.getRequestId();
    const processId = input.process_id ?? this.deps.default_process_id;
    const payloadJson = input.payload ? JSON.stringify(input.payload) : undefined;
    const line = {
      ts: createdAt,
      severity: input.severity,
      event_type: input.event_type,
      source_type: input.source_type,
      source_id: input.source_id,
      process_id: processId,
      workspace_id: input.workspace_id,
      request_id: requestId,
      message: input.message,
      payload: input.payload,
    };

    writeConsoleLine(input.severity, line);

    try {
      await this.deps.events.save({
        id: newId(),
        workspace_id: input.workspace_id,
        request_id: requestId,
        process_id: processId,
        severity: input.severity,
        event_type: input.event_type,
        source_type: input.source_type,
        source_id: input.source_id,
        message: input.message,
        payload_json: payloadJson,
        created_at: createdAt,
      });
    } catch (error) {
      writeConsoleLine("critical", {
        ts: createdAt,
        severity: "critical",
        event_type: "runtime.logger.persist_failed",
        source_type: "system",
        source_id: processId,
        process_id: processId,
        request_id: requestId,
        message: error instanceof Error ? error.message : "failed to persist structured runtime event",
      });
    }
  }
}

function writeConsoleLine(severity: RuntimeEventSeverity, line: Record<string, unknown>): void {
  const serialized = JSON.stringify(line);
  if (severity === "critical") {
    console.error(serialized);
    return;
  }
  if (severity === "warning") {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
}
