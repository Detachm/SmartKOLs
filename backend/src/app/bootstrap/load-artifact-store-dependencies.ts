import type { BackendConfig } from "./load-backend-config";
import { FileArtifactStore } from "../../infrastructure/artifacts/file-artifact-store";

export function loadArtifactStoreDependencies(config: BackendConfig["artifacts"]) {
  return {
    artifactStore: new FileArtifactStore(config.root_dir),
  };
}
