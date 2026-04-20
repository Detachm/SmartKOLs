import { AppError } from "../../../core/errors/app-error";
import type { ModelGateway } from "../application/ports/model-gateway";

export class NotConfiguredModelGateway implements ModelGateway {
  describe(): never {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "model gateway is not configured", {
      details: { dependency: "agent-runtime.model-gateway" },
    });
  }

  async classifyInboxThread(): Promise<never> {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "model gateway is not configured", {
      details: { dependency: "agent-runtime.model-gateway" },
    });
  }

  async proposeReply(): Promise<never> {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "model gateway is not configured", {
      details: { dependency: "agent-runtime.model-gateway" },
    });
  }

  async generateDraft(): Promise<never> {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "model gateway is not configured", {
      details: { dependency: "agent-runtime.model-gateway" },
    });
  }

  async generateContentBrief(): Promise<never> {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "model gateway is not configured", {
      details: { dependency: "agent-runtime.model-gateway" },
    });
  }

  async reviewDraft(): Promise<never> {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "model gateway is not configured", {
      details: { dependency: "agent-runtime.model-gateway" },
    });
  }

  async distillPersona(): Promise<never> {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "model gateway is not configured", {
      details: { dependency: "agent-runtime.model-gateway" },
    });
  }
}
