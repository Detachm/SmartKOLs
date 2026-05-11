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

export interface TwitterCommentResult {
  external_comment_id: string;
  external_comment_url?: string;
  raw_response: string;
  platform_status_code: string;
  rate_limit?: TwitterRateLimitSnapshot;
}

export interface TwitterFollowResult {
  target_user_id: string;
  target_handle?: string;
  following: boolean;
  pending_follow?: boolean;
  raw_response: string;
  platform_status_code: string;
  rate_limit?: TwitterRateLimitSnapshot;
}

export interface TwitterRepostResult {
  reposted: boolean;
  target_post_id: string;
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
  conversation_id?: string;
  content: string;
  occurred_at: string;
  like_count?: number;
  raw_payload: string;
}

export interface TwitterTimelinePullResult {
  posts: TwitterTimelinePost[];
  raw_response: string;
  platform_status_code: string;
  rate_limit?: TwitterRateLimitSnapshot;
}

export interface TwitterPostLookupResult {
  posts: TwitterTimelinePost[];
  raw_response: string;
  platform_status_code: string;
  rate_limit?: TwitterRateLimitSnapshot;
}

export interface TwitterSearchPostsResult {
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

  commentOnPost(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    comment_on_external_post_id: string;
    text: string;
  }): Promise<TwitterCommentResult>;

  followUser(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    target_handle: string;
  }): Promise<TwitterFollowResult>;

  repostPost(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    target_post_id: string;
  }): Promise<TwitterRepostResult>;

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

  lookupPosts(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    post_ids: string[];
  }): Promise<TwitterPostLookupResult>;

  searchRecentPosts(input: {
    account_id: string;
    provider: "x_oauth1" | "x_oauth2" | "api_key";
    secret_ref: string;
    query: string;
    max_results?: number;
  }): Promise<TwitterSearchPostsResult>;
}
