import { createServer, type IncomingMessage } from "http";
import { newId } from "../../core/ids/new-id";
import { systemClock } from "../../core/time/clock";
import { buildAppContext, type BuildAppContextOptions } from "./build-app-context";
import { routeRequest } from "../http/router";
import { PROCESS_HEARTBEAT_INTERVAL_MS, PROCESS_STALE_AFTER_MS } from "../../modules/operations/domain/operations-policy";
import { SqliteRuntimeProcessesRepository } from "../../modules/operations/infrastructure/sqlite-runtime-processes-repository";
import { SqliteRuntimeEventsRepository } from "../../modules/operations/infrastructure/sqlite-runtime-events-repository";
import { StructuredLogger } from "../../modules/operations/infrastructure/structured-logger";
import { createRuntimeProcessSupervisor } from "../../modules/operations/infrastructure/runtime-process-supervisor";

export interface HttpServerConfig extends BuildAppContextOptions {
  port: number;
  host?: string;
  security?: {
    proxy_shared_secret?: string;
  };
}

export async function createHttpServer(config: HttpServerConfig) {
  const context = await buildAppContext(config);
  const runtimeProcesses = new SqliteRuntimeProcessesRepository(context.sqlite.db);
  const runtimeEvents = new SqliteRuntimeEventsRepository(context.sqlite.db);
  const logger = new StructuredLogger({
    events: runtimeEvents,
    requestContext: context.requestContext,
    clock: systemClock,
  });
  const supervisor = createRuntimeProcessSupervisor({
    process_type: "http_server",
    process_name: "backend-http",
    metadata: { port: config.port },
    heartbeat_interval_ms: PROCESS_HEARTBEAT_INTERVAL_MS,
    clock: systemClock,
    processes: runtimeProcesses,
    logger,
  });

  const server = createServer(async (incomingRequest, outgoingResponse) => {
    if (!isAuthorizedProxyRequest(incomingRequest, config.security?.proxy_shared_secret)) {
      outgoingResponse.statusCode = 401;
      outgoingResponse.setHeader("content-type", "application/json; charset=utf-8");
      outgoingResponse.end(JSON.stringify({
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "backend proxy authentication failed",
        },
      }));
      return;
    }

    const origin = `http://${incomingRequest.headers.host ?? `127.0.0.1:${config.port}`}`;
    const chunks: Buffer[] = [];
    const requestId = resolveRequestId(incomingRequest.headers["x-request-id"]);

    incomingRequest.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    incomingRequest.on("end", async () => {
      try {
        const headers = new Headers();
        for (const [key, value] of Object.entries(incomingRequest.headers)) {
          if (typeof value === "string") {
            headers.set(key, value);
            continue;
          }
          if (Array.isArray(value)) {
            for (const item of value) {
              headers.append(key, item);
            }
          }
        }
        headers.set("x-request-id", requestId);

        const request = new Request(new URL(incomingRequest.url ?? "/", origin), {
          method: incomingRequest.method,
          headers,
          body: ["GET", "HEAD"].includes(incomingRequest.method ?? "") ? undefined : Buffer.concat(chunks),
        });

        const response = await routeRequest(context, request);
        if (response.status >= 500) {
          await logger.emit({
            request_id: requestId,
            process_id: supervisor.process_id,
            severity: "critical",
            event_type: "http.response.5xx",
            source_type: "http_server",
            source_id: supervisor.process_id,
            message: "HTTP request returned a 5xx response",
            payload: {
              method: incomingRequest.method,
              path: incomingRequest.url,
              status: response.status,
            },
          });
        }

        outgoingResponse.statusCode = response.status;
        response.headers.forEach((value, key) => outgoingResponse.setHeader(key, value));
        const body = Buffer.from(await response.arrayBuffer());
        outgoingResponse.end(body);
      } catch (error) {
        await logger.emit({
          request_id: requestId,
          process_id: supervisor.process_id,
          severity: "critical",
          event_type: "http.request.failed",
          source_type: "http_server",
          source_id: supervisor.process_id,
          message: error instanceof Error ? error.message : "unknown internal error",
          payload: {
            method: incomingRequest.method,
            path: incomingRequest.url,
          },
        });

        outgoingResponse.statusCode = 500;
        outgoingResponse.setHeader("content-type", "application/json; charset=utf-8");
        outgoingResponse.setHeader("x-request-id", requestId);
        outgoingResponse.end(JSON.stringify({
          ok: false,
          error: {
            code: "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : "unknown internal error",
          },
        }));
      }
    });
  });

  return {
    async listen() {
      const cleanupCutoff = new Date(Date.now() - PROCESS_STALE_AFTER_MS).toISOString();
      await runtimeProcesses.cleanupStaleRunningProcesses({
        stale_before: cleanupCutoff,
        stopped_at: new Date().toISOString(),
        limit: 500,
      });
      server.listen(config.port, config.host);
      await supervisor.start();
      return server;
    },
    async close() {
      await supervisor.stop();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      context.sqlite.db.close();
    },
  };
}

function resolveRequestId(headerValue: string | string[] | undefined): string {
  if (typeof headerValue === "string" && headerValue.trim()) {
    return headerValue.trim();
  }
  if (Array.isArray(headerValue)) {
    const candidate = headerValue.find((value) => value.trim().length > 0);
    if (candidate) {
      return candidate.trim();
    }
  }

  return newId();
}

function isAuthorizedProxyRequest(
  request: IncomingMessage,
  configuredSecret: string | undefined,
): boolean {
  if (!configuredSecret) {
    return true;
  }

  const provided = request.headers["x-smartkols-proxy-secret"];
  if (typeof provided === "string") {
    return provided.trim() === configuredSecret;
  }
  if (Array.isArray(provided)) {
    return provided.some((value) => value.trim() === configuredSecret);
  }

  return false;
}
