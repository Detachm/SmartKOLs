import test from "node:test";
import assert from "node:assert/strict";
import { GetAccountReadiness } from "./get-account-readiness";

test("GetAccountReadiness reports blocked readiness when active sources have no documents", async () => {
  const query = new GetAccountReadiness({
    credentials: {
      findByAccountId: async () => ({
        id: "cred_1",
        account_id: "acct_1",
        provider: "x_oauth1",
        secret_ref: "managed:cred_1",
        status: "valid",
        last_validated_at: "2026-04-21T15:00:00.000Z",
        created_at: "2026-04-21T14:00:00.000Z",
      }),
    } as never,
    personas: {
      findByAccountId: async () => ({
        id: "persona_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        version: 1,
        gender: "unknown",
        nationality: "unknown",
        age: 30,
        interests: ["crypto"],
        personality_traits: ["direct"],
        writing_style: "concise",
        bio: "bio",
        distillation_sample_tweets: "sample",
        source: "manual",
        created_by_type: "user",
        created_at: "2026-04-21T14:00:00.000Z",
        updated_at: "2026-04-21T14:00:00.000Z",
      }),
    } as never,
    sources: {
      listSourcesByAccountId: async () => [{
        id: "source_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        type: "rss",
        name: "RSS",
        url: "https://example.com/feed",
        status: "active",
        last_fetched_at: "2026-04-21T14:30:00.000Z",
        created_at: "2026-04-21T14:00:00.000Z",
      }],
      listRecentDocumentsByAccountId: async () => [],
    } as never,
    autopostPolicies: {
      findByAccountId: async () => ({
        id: "policy_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        cadence_body: {
          timezone: "UTC",
          weekday_codes: ["mon"],
          slot_times: ["09:00"],
          min_spacing_minutes: 60,
        },
        content_strategy_body: {
          generation_mode: "from_trend",
          source_types: ["rss"],
          max_source_age_days: 7,
        },
        execution_body: {
          draft_review_mode: "auto_approve",
          auto_queue_publish: true,
        },
        status: "active",
        updated_at: "2026-04-21T14:00:00.000Z",
      }),
    } as never,
    engagementPolicies: {
      findByAccountId: async () => null,
    } as never,
    getAccountSurface: {
      execute: async () => ({
        account: {
          id: "acct_1",
          workspace_id: "ws_1",
          platform: "x",
          handle: "@acct",
          display_name: "Acct",
          status: "active",
          follower_count: 0,
          following_count: 0,
          post_count: 0,
          external_account_id: "123",
          created_at: "2026-04-21T14:00:00.000Z",
          updated_at: "2026-04-21T14:00:00.000Z",
        },
        workspace: {
          id: "ws_1",
          name: "WS",
          slug: "ws",
          status: "active",
          created_at: "2026-04-21T14:00:00.000Z",
          updated_at: "2026-04-21T14:00:00.000Z",
        },
        summary: {
          source_count: 1,
          active_source_count: 1,
          ready_briefs: 0,
          pending_briefs: 0,
          pending_drafts: 0,
          scheduled_posts: 0,
          open_threads: 0,
        },
      }),
    } as never,
    getAccountAutomationOverview: {
      execute: async () => ({
        account_id: "acct_1",
        workspace_id: "ws_1",
        orchestration_status: "active",
        has_active_automation: true,
        pending_draft_count: 0,
        queued_or_running_content_tasks: [],
        engagement_automation: {
          policy_status: "not_configured",
          open_thread_count: 0,
          policy_blocked_open_thread_count: 0,
          pending_review_reply_count: 0,
          approved_reply_pending_send_count: 0,
        },
        recent_runs: [],
        evaluation: {
          rationale: "blocked on sources",
          eligible_actions: [],
          chosen_action: {
            type: "no_action",
            reason_code: "no_eligible_actions",
            rationale: "blocked on sources",
          },
        },
      }),
    } as never,
  });

  const result = await query.execute("acct_1");

  assert.equal(result.overall_status, "blocked");
  assert.equal(result.checks.sources.status, "blocked");
  assert.match(result.checks.sources.detail, /还没有抓到任何文档/);
  assert.equal(result.checks.autopost.status, "blocked");
});

test("GetAccountReadiness reports legacy invalid engagement targets as blocked", async () => {
  const query = new GetAccountReadiness({
    credentials: {
      findByAccountId: async () => ({
        id: "cred_1",
        account_id: "acct_1",
        provider: "x_oauth1",
        secret_ref: "managed:cred_1",
        status: "valid",
        created_at: "2026-04-21T14:00:00.000Z",
      }),
    } as never,
    personas: {
      findByAccountId: async () => null,
    } as never,
    sources: {
      listSourcesByAccountId: async () => [],
      listRecentDocumentsByAccountId: async () => [],
    } as never,
    autopostPolicies: {
      findByAccountId: async () => null,
    } as never,
    engagementPolicies: {
      findByAccountId: async () => ({
        id: "policy_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        status: "active",
        updated_at: "2026-04-21T14:00:00.000Z",
        policy_body: {
          allowed_channels: ["mention"],
          blocked_classifications: ["spam"],
          require_manual_approval: true,
          auto_follow: {
            enabled: false,
            max_per_day: 10,
            rules: [],
          },
          auto_retweet: {
            enabled: false,
            max_per_day: 3,
            min_likes: 0,
            whitelist: [],
            keywords: [],
            delay_min_minutes: 30,
            delay_max_minutes: 60,
            quote_tweet_enabled: false,
          },
          auto_comment: {
            enabled: true,
            max_per_day: 5,
            target_handles: ["@acct"],
            style: "supportive",
            mode: "latest",
          },
          auto_reply: {
            enabled: false,
            max_per_day: 0,
            trigger_types: ["mention"],
            only_followers: false,
            style: "grateful",
          },
        },
      }),
    } as never,
    getAccountSurface: {
      execute: async () => ({
        account: {
          id: "acct_1",
          workspace_id: "ws_1",
          platform: "x",
          handle: "@acct",
          display_name: "Acct",
          status: "active",
          follower_count: 0,
          following_count: 0,
          post_count: 0,
          created_at: "2026-04-21T14:00:00.000Z",
          updated_at: "2026-04-21T14:00:00.000Z",
        },
        workspace: {
          id: "ws_1",
          name: "WS",
          slug: "ws",
          status: "active",
          created_at: "2026-04-21T14:00:00.000Z",
          updated_at: "2026-04-21T14:00:00.000Z",
        },
        summary: {
          source_count: 0,
          active_source_count: 0,
          ready_briefs: 0,
          pending_briefs: 0,
          pending_drafts: 0,
          scheduled_posts: 0,
          open_threads: 0,
        },
      }),
    } as never,
    getAccountAutomationOverview: {
      execute: async () => ({
        account_id: "acct_1",
        workspace_id: "ws_1",
        orchestration_status: "active",
        has_active_automation: true,
        pending_draft_count: 0,
        queued_or_running_content_tasks: [],
        engagement_automation: {
          policy_status: "active",
          open_thread_count: 0,
          policy_blocked_open_thread_count: 0,
          pending_review_reply_count: 0,
          approved_reply_pending_send_count: 0,
        },
        recent_runs: [],
        evaluation: {
          rationale: "legacy invalid config",
          eligible_actions: [],
          chosen_action: {
            type: "no_action",
            reason_code: "no_eligible_actions",
            rationale: "legacy invalid config",
          },
        },
      }),
    } as never,
  });

  const result = await query.execute("acct_1");

  assert.equal(result.checks.engagement.status, "blocked");
  assert.match(result.checks.engagement.detail, /auto comment targets/);
});

test("GetAccountReadiness downgrades partially invalid engagement configs to warning", async () => {
  const query = new GetAccountReadiness({
    credentials: {
      findByAccountId: async () => ({
        id: "cred_1",
        account_id: "acct_1",
        provider: "x_oauth1",
        secret_ref: "managed:cred_1",
        status: "valid",
        created_at: "2026-04-21T14:00:00.000Z",
      }),
    } as never,
    personas: {
      findByAccountId: async () => null,
    } as never,
    sources: {
      listSourcesByAccountId: async () => [],
      listRecentDocumentsByAccountId: async () => [],
    } as never,
    autopostPolicies: {
      findByAccountId: async () => null,
    } as never,
    engagementPolicies: {
      findByAccountId: async () => ({
        id: "policy_1",
        workspace_id: "ws_1",
        account_id: "acct_1",
        status: "active",
        updated_at: "2026-04-21T14:00:00.000Z",
        policy_body: {
          allowed_channels: ["mention"],
          blocked_classifications: ["spam"],
          require_manual_approval: true,
          auto_follow: {
            enabled: true,
            max_per_day: 10,
            rules: [{ type: "keyword", value: "@WuBlockchain" }],
          },
          auto_retweet: {
            enabled: false,
            max_per_day: 3,
            min_likes: 0,
            whitelist: [],
            keywords: [],
            delay_min_minutes: 30,
            delay_max_minutes: 60,
            quote_tweet_enabled: false,
          },
          auto_comment: {
            enabled: true,
            max_per_day: 5,
            target_handles: ["@acct"],
            style: "supportive",
            mode: "latest",
          },
          auto_reply: {
            enabled: false,
            max_per_day: 0,
            trigger_types: ["mention"],
            only_followers: false,
            style: "grateful",
          },
        },
      }),
    } as never,
    getAccountSurface: {
      execute: async () => ({
        account: {
          id: "acct_1",
          workspace_id: "ws_1",
          platform: "x",
          handle: "@acct",
          display_name: "Acct",
          status: "active",
          follower_count: 0,
          following_count: 0,
          post_count: 0,
          created_at: "2026-04-21T14:00:00.000Z",
          updated_at: "2026-04-21T14:00:00.000Z",
        },
        workspace: {
          id: "ws_1",
          name: "WS",
          slug: "ws",
          status: "active",
          created_at: "2026-04-21T14:00:00.000Z",
          updated_at: "2026-04-21T14:00:00.000Z",
        },
        summary: {
          source_count: 0,
          active_source_count: 0,
          ready_briefs: 0,
          pending_briefs: 0,
          pending_drafts: 0,
          scheduled_posts: 0,
          open_threads: 0,
        },
      }),
    } as never,
    getAccountAutomationOverview: {
      execute: async () => ({
        account_id: "acct_1",
        workspace_id: "ws_1",
        account_handle: "@acct",
        orchestration_status: "active",
        has_active_automation: true,
        pending_draft_count: 0,
        queued_or_running_content_tasks: [],
        engagement_automation: {
          policy_status: "active",
          open_thread_count: 0,
          policy_blocked_open_thread_count: 0,
          pending_review_reply_count: 0,
          approved_reply_pending_send_count: 0,
          today_follow_count: 0,
          today_repost_count: 0,
          today_comment_count: 0,
          today_reply_count: 0,
        },
        recent_runs: [],
        evaluation: {
          rationale: "follow still valid",
          eligible_actions: [],
          chosen_action: {
            type: "no_action",
            reason_code: "no_eligible_actions",
            rationale: "follow still valid",
          },
        },
      }),
    } as never,
  });

  const result = await query.execute("acct_1");

  assert.equal(result.checks.engagement.status, "warning");
  assert.match(result.checks.engagement.detail, /部分互动动作配置无效/);
});
