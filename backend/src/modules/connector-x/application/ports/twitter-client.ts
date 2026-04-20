export interface TwitterRateLimitSnapshot {
  window_key: string;
  limit_count: number;
  remaining_count: number;
  resets_at: string;
}

export interface TwitterCreatedPost {
  external_post_id: string;
  external_post_url?: string;
  raw_response: string;
  platform_status_code: string;
  rate_limit?: TwitterRateLimitSnapshot;
}

export interface TwitterAccountProfile {
  external_account_id?: string;
  handle: string;
  display_name: string;
  avatar_url?: string;
  follower_count: number;
  following_count: number;
  post_count: number;
  raw_response: string;
  platform_status_code: string;
  rate_limit?: TwitterRateLimitSnapshot;
}

export interface TwitterReplyResult {
  external_reply_id: string;
  external_reply_url?: string;
  raw_response: string;
  platform_status_code: string;
  rate_limit?: TwitterRateLimitSnapshot;
}

export interface TwitterDirectMessageResult {
  external_message_id: string;
  external_thread_id: string;
  raw_response: string;
  platform_status_code: string;
  rate_limit?: TwitterRateLimitSnapshot;
}

export interface TwitterInboxMessage {
  external_message_id: string;
  external_thread_id: string;
  sender_handle?: string;
  content: string;
  occurred_at: string;
  raw_payload: string;
}

export interface TwitterInboxPullResult {
  messages: TwitterInboxMessage[];
  raw_response: string;
  platform_status_code: string;
  rate_limit?: TwitterRateLimitSnapshot;
}

export interface TwitterTimelinePost {
  external_post_id: string;
  handle: string;
  kind: "post" | "reply";
  content: string;
  occurred_at: string;
  raw_payload: string;
}

export interface TwitterTimelinePullResult {
  posts: TwitterTimelinePost[];
  raw_response: string;
  platform_status_code: string;
  rate_limit?: TwitterRateLimitSnapshot;
}

export interface TwitterClient {
  createPost(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    text: string;
  }): Promise<TwitterCreatedPost>;

  replyToPost(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    reply_to_external_post_id: string;
    text: string;
  }): Promise<TwitterReplyResult>;

  sendDirectMessage(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    dm_conversation_id: string;
    text: string;
  }): Promise<TwitterDirectMessageResult>;

  getAccountProfile(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
  }): Promise<TwitterAccountProfile>;

  listMentions(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
  }): Promise<TwitterInboxPullResult>;

  listDirectMessages(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
  }): Promise<TwitterInboxPullResult>;

  listUserPosts(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    handle: string;
  }): Promise<TwitterTimelinePullResult>;
}
