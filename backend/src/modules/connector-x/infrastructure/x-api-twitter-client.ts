import type {
  TwitterAccountProfile,
  TwitterCommentResult,
  TwitterClient,
  TwitterCreatedPost,
  TwitterDirectMessageResult,
  TwitterFollowResult,
  TwitterInboxPullResult,
  TwitterRepostResult,
  TwitterReplyResult,
  TwitterTimelinePullResult,
} from "../application/ports/twitter-client";
import { XApiClient } from "./x-api-client";

export class XApiTwitterClient implements TwitterClient {
  constructor(private readonly xApi: XApiClient) {}

  async createPost(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    text: string;
  }): Promise<TwitterCreatedPost> {
    return this.xApi.createPost({
      provider: input.provider,
      secret_ref: input.secret_ref,
      text: input.text,
    });
  }

  async replyToPost(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    reply_to_external_post_id: string;
    text: string;
  }): Promise<TwitterReplyResult> {
    return this.xApi.replyToPost({
      provider: input.provider,
      secret_ref: input.secret_ref,
      reply_to_external_post_id: input.reply_to_external_post_id,
      text: input.text,
    });
  }

  async commentOnPost(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    comment_on_external_post_id: string;
    text: string;
  }): Promise<TwitterCommentResult> {
    return this.xApi.commentOnPost({
      provider: input.provider,
      secret_ref: input.secret_ref,
      comment_on_external_post_id: input.comment_on_external_post_id,
      text: input.text,
    });
  }

  async followUser(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    target_handle: string;
  }): Promise<TwitterFollowResult> {
    return this.xApi.followUser({
      provider: input.provider,
      secret_ref: input.secret_ref,
      target_handle: input.target_handle,
    });
  }

  async repostPost(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    target_post_id: string;
  }): Promise<TwitterRepostResult> {
    return this.xApi.repostPost({
      provider: input.provider,
      secret_ref: input.secret_ref,
      target_post_id: input.target_post_id,
    });
  }

  async sendDirectMessage(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    dm_conversation_id: string;
    text: string;
  }): Promise<TwitterDirectMessageResult> {
    return this.xApi.sendDirectMessage({
      provider: input.provider,
      secret_ref: input.secret_ref,
      dm_conversation_id: input.dm_conversation_id,
      text: input.text,
    });
  }

  async getAccountProfile(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
  }): Promise<TwitterAccountProfile> {
    return this.xApi.getAccountProfile({
      provider: input.provider,
      secret_ref: input.secret_ref,
    });
  }

  async listMentions(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
  }): Promise<TwitterInboxPullResult> {
    return this.xApi.listMentions({
      provider: input.provider,
      secret_ref: input.secret_ref,
    });
  }

  async listDirectMessages(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
  }): Promise<TwitterInboxPullResult> {
    return this.xApi.listDirectMessages({
      provider: input.provider,
      secret_ref: input.secret_ref,
    });
  }

  async listUserPosts(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    handle: string;
  }): Promise<TwitterTimelinePullResult> {
    return this.xApi.listUserPosts({
      provider: input.provider,
      secret_ref: input.secret_ref,
      handle: input.handle,
    });
  }

  async lookupPosts(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    post_ids: string[];
  }): Promise<TwitterTimelinePullResult> {
    return this.xApi.lookupPosts({
      provider: input.provider,
      secret_ref: input.secret_ref,
      post_ids: input.post_ids,
    });
  }

  async searchRecentPosts(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    query: string;
    max_results?: number;
  }): Promise<TwitterTimelinePullResult> {
    return this.xApi.searchRecentPosts({
      provider: input.provider,
      secret_ref: input.secret_ref,
      query: input.query,
      max_results: input.max_results,
    });
  }
}
