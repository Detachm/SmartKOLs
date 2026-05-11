import { createHttpServer } from "./http-server";
import { configureFetchProxyFromEnv } from "./configure-fetch-proxy";
import { loadArtifactStoreDependencies } from "./load-artifact-store-dependencies";
import { loadBackendConfigFromEnv } from "./load-backend-config";
import { loadConnectorXDependencies } from "./load-connector-x-dependencies";
import { loadModelGatewayDependencies } from "./load-model-gateway-dependencies";
import { loadSourceFetchDependencies } from "./load-source-fetch-dependencies";

async function main() {
  configureFetchProxyFromEnv();
  const config = loadBackendConfigFromEnv();
  const artifactStore = loadArtifactStoreDependencies(config.artifacts);
  const connectorX = loadConnectorXDependencies(config.connector_x);
  const modelGateway = loadModelGatewayDependencies(config.llm);
  const sourceFetch = loadSourceFetchDependencies(config.source_fetch);
  const server = await createHttpServer({
    port: config.port,
    host: config.host,
    security: config.security,
    dbPath: config.db_path,
    ...artifactStore,
    ...connectorX,
    ...modelGateway,
    ...sourceFetch,
  });
  await server.listen();

  async function shutdown() {
    await server.close();
    process.exit(0);
  }

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });

  console.log(`SmartKOLs backend listening on http://${config.host ?? "127.0.0.1"}:${config.port}`);
}

void main();
