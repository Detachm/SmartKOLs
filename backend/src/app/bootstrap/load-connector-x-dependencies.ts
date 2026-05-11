import type { BackendConfig } from "./load-backend-config";

export function loadConnectorXDependencies(config: BackendConfig["connector_x"]) {
  return {
    connectorXConfig: config,
  };
}
