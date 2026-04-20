import { createWorkerRunner } from "./worker-runner";
import { configureFetchProxyFromEnv } from "./configure-fetch-proxy";
import { loadArtifactStoreDependencies } from "./load-artifact-store-dependencies";
import { loadWorkerProcessConfigFromEnv } from "./load-backend-config";
import { loadConnectorXDependencies } from "./load-connector-x-dependencies";
import { loadModelGatewayDependencies } from "./load-model-gateway-dependencies";
import { loadSourceFetchDependencies } from "./load-source-fetch-dependencies";

async function main() {
  configureFetchProxyFromEnv();
  const config = loadWorkerProcessConfigFromEnv();
  const artifactStore = loadArtifactStoreDependencies(config.artifacts);
  const connectorX = loadConnectorXDependencies(config.connector_x);
  const modelGateway = loadModelGatewayDependencies(config.llm);
  const sourceFetch = loadSourceFetchDependencies(config.source_fetch);

  const runner = await createWorkerRunner({
    dbPath: config.db_path,
    worker_name: config.worker.name,
    poll_interval_ms: config.worker.poll_interval_ms,
    max_jobs_per_tick: config.worker.max_jobs_per_tick,
    ...artifactStore,
    ...connectorX,
    ...modelGateway,
    ...sourceFetch,
  });

  await runner.start();

  async function shutdown() {
    await runner.close();
    process.exit(0);
  }

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });

  console.log(`SmartKOLs worker running: ${config.worker.name}`);
}

void main();
