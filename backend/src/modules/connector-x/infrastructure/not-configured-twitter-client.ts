import { AppError } from "../../../core/errors/app-error";
import type { TwitterClient } from "../application/ports/twitter-client";

export class NotConfiguredTwitterClient implements TwitterClient {
  async getAccountProfile(): Promise<never> {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "twitter client is not configured", {
      details: { dependency: "connector-x.twitter-client" },
    });
  }

  async createPost(): Promise<never> {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "twitter client is not configured", {
      details: { dependency: "connector-x.twitter-client" },
    });
  }

  async replyToPost(): Promise<never> {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "twitter client is not configured", {
      details: { dependency: "connector-x.twitter-client" },
    });
  }

  async sendDirectMessage(): Promise<never> {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "twitter client is not configured", {
      details: { dependency: "connector-x.twitter-client" },
    });
  }

  async listMentions(): Promise<never> {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "twitter client is not configured", {
      details: { dependency: "connector-x.twitter-client" },
    });
  }

  async listDirectMessages(): Promise<never> {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "twitter client is not configured", {
      details: { dependency: "connector-x.twitter-client" },
    });
  }

  async listUserPosts(): Promise<never> {
    throw new AppError("EXTERNAL_DEPENDENCY_ERROR", "twitter client is not configured", {
      details: { dependency: "connector-x.twitter-client" },
    });
  }
}
