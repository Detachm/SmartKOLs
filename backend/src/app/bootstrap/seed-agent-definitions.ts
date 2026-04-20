import type { AgentRuntimeRepository } from "../../modules/agent-runtime/application/ports/agent-runtime-repository";
import { createAgentDefinition } from "../../modules/agent-runtime/domain/agent-definition";
import { listAgentArtifactBundles } from "../../modules/agent-runtime/infrastructure/static-agent-artifacts";

export async function seedAgentDefinitions(runtime: AgentRuntimeRepository): Promise<void> {
  for (const artifact of listAgentArtifactBundles()) {
    const definition = createAgentDefinition({
      id: artifact.definition.id,
      code: artifact.definition.code,
      name: artifact.definition.name,
      version: artifact.definition.version,
      input_schema: JSON.stringify(artifact.definition.input_schema),
      output_schema: JSON.stringify(artifact.definition.output_schema),
      tool_policy: JSON.stringify({
        ref: artifact.tool_policy.ref,
        tools: artifact.tool_policy.allowed_tools,
      }),
      is_active: true,
    });

    const existing = await runtime.findDefinitionByCode(definition.code);
    if (!existing) {
      await runtime.createDefinition(definition);
    }
  }
}
