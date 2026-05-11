import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { AgentRuntimeRepository } from "../../../agent-runtime/application/ports/agent-runtime-repository";
import { createAgentTask } from "../../../agent-runtime/domain/agent-task";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AccountCredentialsRepository } from "../../../connector-x/application/ports/account-credentials-repository";
import type { TwitterClient } from "../../../connector-x/application/ports/twitter-client";
import { assertCredentialUsable } from "../../../connector-x/domain/account-credential";
import type { SourcesRepository } from "../../../sources/application/ports/sources-repository";

export interface DistillPersonaDependencies {
  runtime: AgentRuntimeRepository;
  accounts: AccountsRepository;
  credentials: AccountCredentialsRepository;
  twitterClient: TwitterClient;
  sources: SourcesRepository;
  now: () => string;
}

interface DistillPersonaSampleInput {
  kind?: "post" | "reply";
  content: string;
  canonical_url?: string;
  created_at?: string;
}

interface DistillPersonaTaskSample {
  kind: "post" | "reply";
  content: string;
  canonical_url?: string;
  created_at?: string;
}

export class DistillPersona {
  constructor(private readonly deps: DistillPersonaDependencies) {}

  async execute(input: {
    account_id: string;
    samples?: DistillPersonaSampleInput[];
    twitter_handle?: string;
    source_ids?: string[];
    max_samples?: number;
  }) {
    const account = await this.deps.accounts.findById(input.account_id);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: input.account_id },
      });
    }

    const definition = await this.deps.runtime.findDefinitionByCode("persona-distiller");
    if (!definition) {
      throw new AppError("NOT_FOUND", "agent definition persona-distiller not found", {
        details: { code: "persona-distiller" },
      });
    }

    const maxSamples = clampMaxSamples(input.max_samples);
    const samples = await this.resolveSamples({
      account_id: account.id,
      twitter_handle: input.twitter_handle,
      source_ids: input.source_ids,
      samples: input.samples,
      max_samples: maxSamples,
    });
    if (samples.length === 0) {
      throw new AppError("VALIDATION_ERROR", "persona distillation requires tweets or replies", {
        details: {
          account_id: account.id,
          source_ids: input.source_ids,
        },
      });
    }

    const task = createAgentTask({
      id: newId(),
      workspace_id: account.workspace_id,
      agent_definition_id: definition.id,
      task_type: "persona.distill",
      target_type: "account",
      target_id: account.id,
      payload: JSON.stringify({
        account_id: account.id,
        samples,
        sample_count: samples.length,
        max_samples: maxSamples,
      }),
      created_at: this.deps.now(),
    });
    await this.deps.runtime.createTask(task);

    return {
      task_id: task.id,
      status: task.status,
    };
  }

  private async resolveSamples(input: {
    account_id: string;
    twitter_handle?: string;
    source_ids?: string[];
    samples?: DistillPersonaSampleInput[];
    max_samples: number;
  }): Promise<DistillPersonaTaskSample[]> {
    const manualSamples = normalizeManualSamples(input.samples);
    if (manualSamples.length > 0) {
      return capSamples(manualSamples, input.max_samples);
    }

    const requestedHandle = normalizeTwitterHandleInput(input.twitter_handle);
    if (requestedHandle) {
      return capSamples(await this.fetchTimelineSamples(input.account_id, requestedHandle), input.max_samples);
    }

    const requestedSourceIds = normalizeIds(input.source_ids);
    const sources = requestedSourceIds.length > 0
      ? await this.resolveRequestedSources(input.account_id, requestedSourceIds)
      : (await this.deps.sources.listSourcesByAccountId(input.account_id)).filter((source) => source.type === "twitter");

    const docs: DistillPersonaTaskSample[] = [];
    for (const source of sources) {
      const documents = await this.deps.sources.listDocumentsBySourceId(source.id);
      for (const document of documents) {
        docs.push({
          kind: inferDocumentKind(document.title),
          content: document.body_text,
          canonical_url: document.canonical_url,
          created_at: document.published_at ?? document.created_at,
        });
      }
    }

    return capSamples(docs, input.max_samples);
  }

  private async resolveRequestedSources(accountId: string, sourceIds: string[]) {
    const sources = [];
    for (const sourceId of sourceIds) {
      const source = await this.deps.sources.findSourceById(sourceId);
      if (!source || source.account_id !== accountId) {
        throw new AppError("NOT_FOUND", "source not found for account", {
          details: { account_id: accountId, source_id: sourceId },
        });
      }
      if (source.type !== "twitter") {
        throw new AppError("VALIDATION_ERROR", "persona distillation sources must be twitter profile timelines", {
          details: { account_id: accountId, source_id: sourceId, source_type: source.type },
        });
      }
      sources.push(source);
    }

    return sources;
  }

  private async fetchTimelineSamples(accountId: string, handle: string): Promise<DistillPersonaTaskSample[]> {
    const credential = await this.deps.credentials.findValidByAccountId(accountId);
    if (!credential) {
      throw new AppError("NOT_FOUND", "valid account credential not found for persona distillation", {
        details: { account_id: accountId, twitter_handle: handle },
      });
    }

    assertCredentialUsable(credential);
    const timeline = await this.deps.twitterClient.listUserPosts({
      account_id: accountId,
      provider: credential.provider,
      secret_ref: credential.secret_ref,
      handle,
    });

    return timeline.posts.map((post) => ({
      kind: post.kind,
      content: post.content,
      canonical_url: `https://x.com/${post.handle}/status/${post.external_post_id}`,
      created_at: post.occurred_at,
    }));
  }
}

function normalizeManualSamples(samples: DistillPersonaSampleInput[] | undefined): DistillPersonaTaskSample[] {
  if (!samples) {
    return [];
  }

  if (!Array.isArray(samples)) {
    throw new AppError("VALIDATION_ERROR", "samples must be an array", {
      details: { field: "samples" },
    });
  }

  return samples
    .map((sample) => {
      if (!sample || typeof sample !== "object" || Array.isArray(sample)) {
        throw new AppError("VALIDATION_ERROR", "samples entries must be objects", {
          details: { field: "samples" },
        });
      }

      const kind: "post" | "reply" = sample.kind === "reply" ? "reply" : "post";
      const content = requireTrimmedString(sample.content, "samples[].content");
      return {
        kind,
        content,
        canonical_url: optionalTrimmedString(sample.canonical_url),
        created_at: optionalTrimmedString(sample.created_at),
      };
    })
    .filter((sample, index, collection) => collection.findIndex((candidate) => candidate.content === sample.content) === index);
}

function capSamples(samples: DistillPersonaTaskSample[], maxSamples: number): DistillPersonaTaskSample[] {
  const capped: DistillPersonaTaskSample[] = [];
  let totalChars = 0;
  for (const sample of samples) {
    if (capped.length >= maxSamples) {
      break;
    }
    const nextChars = totalChars + sample.content.length;
    if (capped.length > 0 && nextChars > 60_000) {
      break;
    }
    capped.push(sample);
    totalChars = nextChars;
  }
  return capped;
}

function clampMaxSamples(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 120;
  }

  return Math.max(10, Math.min(200, Math.floor(value)));
}

function normalizeIds(values: string[] | undefined): string[] {
  if (!values) {
    return [];
  }

  if (!Array.isArray(values)) {
    throw new AppError("VALIDATION_ERROR", "source_ids must be an array", {
      details: { field: "source_ids" },
    });
  }

  return values
    .map((value) => requireTrimmedString(value, "source_ids[]"))
    .filter((value, index, collection) => collection.indexOf(value) === index);
}

function requireTrimmedString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError("VALIDATION_ERROR", `${field} is required`, {
      details: { field },
    });
  }

  return value.trim();
}

function optionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  return value.trim();
}

function normalizeTwitterHandleInput(value: string | undefined): string | undefined {
  const text = optionalTrimmedString(value);
  if (!text) {
    return undefined;
  }

  if (text.startsWith("http://") || text.startsWith("https://")) {
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      throw new AppError("VALIDATION_ERROR", "twitter_handle must be a valid username or x.com profile URL", {
        details: { field: "twitter_handle", value: text },
      });
    }

    if (!["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname.toLowerCase())) {
      throw new AppError("VALIDATION_ERROR", "twitter_handle must point to x.com or twitter.com", {
        details: { field: "twitter_handle", value: text },
      });
    }

    const firstSegment = url.pathname.split("/").filter(Boolean)[0];
    if (!firstSegment) {
      throw new AppError("VALIDATION_ERROR", "twitter_handle URL must point to a profile root", {
        details: { field: "twitter_handle", value: text },
      });
    }

    return firstSegment.startsWith("@") ? firstSegment.slice(1) : firstSegment;
  }

  const normalized = text.startsWith("@") ? text.slice(1) : text;
  if (!/^[A-Za-z0-9_]{1,15}$/.test(normalized)) {
    throw new AppError("VALIDATION_ERROR", "twitter_handle must be a valid X username", {
      details: { field: "twitter_handle", value: text },
    });
  }

  return normalized;
}

function inferDocumentKind(title: string): "post" | "reply" {
  return title.trim().toLowerCase().startsWith("[reply]") ? "reply" : "post";
}
