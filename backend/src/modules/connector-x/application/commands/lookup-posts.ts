import { AppError } from "../../../../core/errors/app-error";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AccountCredentialsRepository } from "../ports/account-credentials-repository";
import type { TwitterClient } from "../ports/twitter-client";
import { assertCredentialUsable } from "../../domain/account-credential";

export interface LookupPostsDependencies {
  accounts: AccountsRepository;
  credentials: AccountCredentialsRepository;
  twitterClient: TwitterClient;
}

export class LookupPosts {
  constructor(private readonly deps: LookupPostsDependencies) {}

  async execute(input: {
    account_id: string;
    post_ids: string[];
  }) {
    const account = await this.deps.accounts.findById(input.account_id);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: input.account_id },
      });
    }

    const credential = await this.deps.credentials.findValidByAccountId(input.account_id);
    if (!credential) {
      throw new AppError("NOT_FOUND", "valid account credential not found", {
        details: { account_id: input.account_id },
      });
    }

    assertCredentialUsable(credential);
    const result = await this.deps.twitterClient.lookupPosts({
      account_id: account.id,
      provider: credential.provider,
      secret_ref: credential.secret_ref,
      post_ids: input.post_ids,
    });

    return {
      posts: result.posts.map((post) => ({
        external_post_id: post.external_post_id,
        handle: post.handle,
        conversation_id: post.conversation_id,
        content: post.content,
        occurred_at: post.occurred_at,
      })),
    };
  }
}
