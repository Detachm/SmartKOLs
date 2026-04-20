import os from "node:os";
import { newId } from "../../../core/ids/new-id";
import type { Clock } from "../../../core/time/clock";
import type { RuntimeProcessesRepository } from "../application/ports/runtime-processes-repository";
import type { RuntimeProcessType } from "../domain/runtime-process";
import type { StructuredLogger } from "./structured-logger";

export interface RuntimeProcessSupervisorConfig {
  process_type: RuntimeProcessType;
  process_name: string;
  metadata: Record<string, unknown>;
  heartbeat_interval_ms: number;
  clock: Clock;
  processes: RuntimeProcessesRepository;
  logger: StructuredLogger;
}

export function createRuntimeProcessSupervisor(config: RuntimeProcessSupervisorConfig) {
  const processId = newId();
  const hostname = os.hostname();
  const pid = process.pid;
  const metadataJson = JSON.stringify(config.metadata);
  let startedAt: string | null = null;
  let timer: NodeJS.Timeout | null = null;

  return {
    process_id: processId,
    async start(): Promise<void> {
      if (startedAt) {
        return;
      }

      startedAt = config.clock.now().toISOString();
      await config.processes.upsertHeartbeat({
        id: processId,
        process_type: config.process_type,
        process_name: config.process_name,
        pid,
        hostname,
        status: "running",
        metadata_json: metadataJson,
        started_at: startedAt,
        last_heartbeat_at: startedAt,
      });
      await config.logger.emit({
        process_id: processId,
        severity: "info",
        event_type: "runtime.process.started",
        source_type: config.process_type,
        source_id: processId,
        message: `${config.process_name} started`,
        payload: {
          pid,
          hostname,
          metadata: config.metadata,
        },
      });

      timer = setInterval(() => {
        void heartbeat();
      }, config.heartbeat_interval_ms);
    },
    async stop(): Promise<void> {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (!startedAt) {
        return;
      }

      const stoppedAt = config.clock.now().toISOString();
      await config.processes.markStopped({
        process_id: processId,
        stopped_at: stoppedAt,
      });
      await config.logger.emit({
        process_id: processId,
        severity: "info",
        event_type: "runtime.process.stopped",
        source_type: config.process_type,
        source_id: processId,
        message: `${config.process_name} stopped`,
        payload: {
          pid,
          hostname,
        },
      });
      startedAt = null;
    },
  };

  async function heartbeat(): Promise<void> {
    if (!startedAt) {
      return;
    }

    try {
      await config.processes.upsertHeartbeat({
        id: processId,
        process_type: config.process_type,
        process_name: config.process_name,
        pid,
        hostname,
        status: "running",
        metadata_json: metadataJson,
        started_at: startedAt,
        last_heartbeat_at: config.clock.now().toISOString(),
      });
    } catch (error) {
      console.error(JSON.stringify({
        ts: config.clock.now().toISOString(),
        severity: "critical",
        event_type: "runtime.process.heartbeat_failed",
        source_type: config.process_type,
        source_id: processId,
        process_id: processId,
        message: error instanceof Error ? error.message : "failed to persist runtime heartbeat",
      }));
    }
  }
}
