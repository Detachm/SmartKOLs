import {
  deleteBackendData,
  getBackendData,
  requestBackendResult,
  postBackendData,
  putBackendData,
  type BackendAccount,
  type BackendAccountGroup,
  type BackendWorkspace,
} from "@/lib/backend-client";

export type { BackendAccount, BackendAccountGroup, BackendWorkspace } from "@/lib/backend-client";

export interface WorkspaceListResponse {
  workspaces: BackendWorkspace[];
}

export interface AccountListResponse {
  accounts: BackendAccount[];
}

export interface BackendAccountGroupListItem {
  group: BackendAccountGroup;
  account_count: number;
  active_account_count: number;
}

export interface AccountGroupListResponse {
  groups: BackendAccountGroupListItem[];
  summary: {
    total_groups: number;
    total_accounts: number;
    grouped_accounts: number;
    ungrouped_accounts: number;
  };
}

export interface DeleteAccountResponse {
  deleted_account_id: string;
  workspace_id: string;
}

export interface AccountCredentialResponse {
  id: string;
  account_id: string;
  provider: "x_oauth1" | "x_oauth2" | "api_key";
  secret_ref: string;
  status: "valid" | "invalid" | "expired" | "revoked";
  last_validated_at?: string;
  created_at: string;
}

export interface SyncAccountProfileResponse {
  account: BackendAccount;
  health_score: {
    id: string;
    workspace_id: string;
    account_id: string;
    score: number;
    risk_level: "low" | "medium" | "high";
    computed_at: string;
  };
}

export interface AccountSurfaceResponse {
  account: BackendAccount;
  workspace: BackendWorkspace;
  group?: BackendAccountGroup;
  health_score?: {
    id: string;
    workspace_id: string;
    account_id: string;
    score: number;
    risk_level: "low" | "medium" | "high";
    computed_at: string;
  };
  summary: {
    source_count: number;
    active_source_count: number;
    ready_briefs: number;
    pending_briefs: number;
    pending_drafts: number;
    scheduled_posts: number;
    open_threads: number;
  };
}

export interface AccountReadinessCheck {
  status: "ready" | "warning" | "blocked" | "missing";
  detail: string;
}

export interface AccountReadinessResponse {
  account_id: string;
  workspace_id: string;
  overall_status: "ready" | "warning" | "blocked";
  summary: {
    ready_count: number;
    warning_count: number;
    blocked_count: number;
    missing_count: number;
  };
  checks: {
    credential: AccountReadinessCheck & {
      provider?: "x_oauth1" | "x_oauth2" | "api_key";
      credential_status?: "valid" | "invalid" | "expired" | "revoked";
      last_validated_at?: string;
    };
    profile: AccountReadinessCheck & {
      external_account_id?: string;
    };
    persona: AccountReadinessCheck & {
      source?: "manual" | "template" | "distilled" | "generated";
      updated_at?: string;
    };
    sources: AccountReadinessCheck & {
      source_count: number;
      active_source_count: number;
      has_recent_documents: boolean;
      latest_fetched_at?: string;
    };
    autopost: AccountReadinessCheck & {
      policy_status: "not_configured" | "active" | "paused";
      next_run_after?: string;
      last_error_code?: string;
      last_error_message?: string;
    };
    engagement: AccountReadinessCheck & {
      policy_status: "not_configured" | "active" | "paused";
      enabled_features: string[];
      blocked_reason_code?: AccountAutomationNoActionPreview["reason_code"];
    };
  };
  runtime: {
    orchestration_status: "inactive" | "active" | "paused";
    blocked_reason_code?: AccountAutomationNoActionPreview["reason_code"];
    rationale: string;
    next_due_at?: string;
    pending_draft_count?: number;
    pending_manual_review_draft_count?: number;
    pending_auto_approve_draft_count?: number;
    max_pending_manual_review_drafts?: number;
  };
}

export interface AccountAutomationActionPreview {
  type:
    | "draft.generate.from_brief"
    | "brief.generate.from_recurring_plan"
    | "engagement.classify"
    | "engagement.reply.generate"
    | "engagement.follow.execute"
    | "engagement.repost.execute"
    | "engagement.comment.execute"
    | "autopost.execute_policy"
    | "autopost.generate_draft_from_run"
    | "autopost.finalize_run";
  priority_score: number;
  rationale: string;
  brief_id?: string;
  plan_id?: string;
  policy_id?: string;
  draft_id?: string;
  run_id?: string;
  thread_id?: string;
}

export interface AccountAutomationNoActionPreview {
  type: "no_action";
  reason_code:
    | "automation_inactive"
    | "automation_paused"
    | "content_task_running"
    | "awaiting_draft_review"
    | "awaiting_reply_review"
    | "awaiting_reply_send"
    | "engagement_policy_missing"
    | "engagement_policy_paused"
    | "engagement_policy_blocks_open_threads"
    | "waiting_for_next_due_window"
    | "no_eligible_actions"
    | "tick_failed";
  rationale: string;
}

export interface AccountAutomationOverviewResponse {
  account_id: string;
  workspace_id: string;
  account_handle?: string;
  orchestration_status: "inactive" | "active" | "paused";
  has_active_automation: boolean;
  next_due_at?: string;
  state?: {
    next_tick_after?: string;
    last_tick_at?: string;
    active_run_id?: string;
    last_decision_type?: string;
    last_reason_code?: string;
    created_at: string;
    updated_at: string;
  };
  pending_draft_count: number;
  pending_manual_review_draft_count?: number;
  pending_auto_approve_draft_count?: number;
  max_pending_manual_review_drafts: number;
  queued_or_running_content_tasks: Array<{
    task_id: string;
    task_type: "content_brief.generate" | "draft.generate";
    status: "queued" | "running";
    created_at: string;
  }>;
  latest_ready_brief_without_draft?: {
    brief_id: string;
    generation_mode: "from_trend" | "from_documents" | "from_source_scope";
    topic?: string;
    updated_at: string;
    created_at: string;
  };
  next_due_recurring_plan?: {
    plan_id: string;
    name: string;
    generation_mode: "from_trend" | "from_source_scope";
    next_run_after: string;
    default_topic_hint?: string;
  };
  next_due_autopost_policy?: {
    policy_id: string;
    generation_mode: "from_trend" | "from_source_scope";
    next_run_after: string;
    draft_review_mode: "manual" | "auto_approve";
    auto_queue_publish: boolean;
    max_pending_manual_review_drafts: number;
  };
  active_autopost_run?: {
    run_id: string;
    policy_id: string;
    status: "queued" | "brief_generating" | "draft_generating";
    scheduled_for: string;
    brief_id?: string;
    brief_task_id?: string;
    brief_task_status?: "queued" | "running" | "succeeded" | "failed" | "cancelled";
    draft_id?: string;
    draft_task_id?: string;
    draft_task_status?: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  };
  engagement_automation: {
    policy_status: "not_configured" | "active" | "paused";
    open_thread_count: number;
    policy_blocked_open_thread_count: number;
    pending_review_reply_count: number;
    approved_reply_pending_send_count: number;
    today_follow_count: number;
    today_repost_count: number;
    today_comment_count: number;
    today_reply_count: number;
    next_pending_review_reply?: {
      proposal_id: string;
      thread_id: string;
      created_at: string;
    };
    next_approved_reply_pending_send?: {
      proposal_id: string;
      thread_id: string;
      reviewed_at?: string;
      created_at: string;
    };
  };
  recent_runs: Array<{
    run_id: string;
    trigger_kind: "manual" | "content_task_follow_up" | "draft_review_follow_up" | "system";
    status: "running" | "succeeded" | "failed";
    created_at: string;
    finished_at?: string;
    chosen_action?: AccountAutomationActionPreview | AccountAutomationNoActionPreview;
    eligible_actions: AccountAutomationActionPreview[];
    failure_scope?: "autopost" | "engagement" | "content" | "system";
    is_isolated_failure?: boolean;
    error_code?: string;
    error_message?: string;
  }>;
  evaluation: {
    blocked_reason_code?: AccountAutomationNoActionPreview["reason_code"];
    rationale: string;
    eligible_actions: AccountAutomationActionPreview[];
    chosen_action: AccountAutomationActionPreview | AccountAutomationNoActionPreview;
  };
}

export interface QueueAccountAutomationTickResponse {
  job_id: string;
  status: "queued";
  run_after: string;
}

export interface UpdateAccountAutomationStateResponse {
  account_id: string;
  orchestration_status: "active" | "paused";
  updated_at: string;
}

export type WorkspaceSurfaceAccountPreview = Pick<
  BackendAccount,
  "id" | "workspace_id" | "group_id" | "handle" | "display_name" | "avatar_url" | "status" | "external_account_id"
>;

export interface WorkspaceSurfaceResponse {
  workspace: BackendWorkspace;
  summary: {
    total_accounts: number;
    active_accounts: number;
    bound_accounts: number;
    total_groups: number;
    grouped_accounts: number;
    ungrouped_accounts: number;
    pending_drafts: number;
    scheduled_posts: number;
    unread_notifications: number;
    active_trends: number;
    open_threads: number;
    configured_alert_channels: number;
    member_count: number;
    failed_queue_items: number;
  };
  active_accounts: WorkspaceSurfaceAccountPreview[];
}

export interface AccountsControlPlaneResponse {
  workspaces: BackendWorkspace[];
  accounts: BackendAccount[];
  groups: BackendAccountGroupListItem[];
  summary: {
    total_workspaces: number;
    total_accounts: number;
    active_accounts: number;
    bound_accounts: number;
    total_groups: number;
    grouped_accounts: number;
    ungrouped_accounts: number;
  };
}

export interface BackendPersonaTemplateProfile {
  gender: string;
  nationality: string;
  age: number;
  interests: string[];
  personality_traits: string[];
  writing_style: string;
  bio: string;
  distillation_sample_tweets: string;
}

export interface BackendPersonaTemplate {
  id: string;
  workspace_id?: string;
  scope: "global" | "workspace";
  name: string;
  description: string;
  persona: BackendPersonaTemplateProfile;
  is_active: boolean;
  created_at: string;
}

export interface PersonaTemplateListResponse {
  templates: BackendPersonaTemplate[];
}

export interface ApplyPersonaTemplateResponse {
  template_id: string;
  workspace_id: string;
  applied_count: number;
}

export interface ImportAccountRowPayload {
  handle: string;
  display_name: string;
  group_name?: string;
}

export interface ImportAccountsResponse {
  workspace_id: string;
  created_group_count: number;
  created_account_count: number;
  created_group_ids: string[];
  created_account_ids: string[];
}

export interface BackendNotification {
  id: string;
  workspace_id: string;
  type: "post" | "message" | "health" | "action" | "engagement";
  title: string;
  body: string;
  link?: string;
  read_at?: string;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: BackendNotification[];
}

export interface AppChromeOverviewResponse {
  summary: {
    total_groups: number;
    total_accounts: number;
    active_accounts: number;
    bound_accounts: number;
    grouped_accounts: number;
    ungrouped_accounts: number;
    pending_drafts: number;
    scheduled_posts: number;
    unread_notifications: number;
    critical_alerts: number;
    failed_queue_items: number;
    monitoring_attention_items: number;
  };
  group_links: BackendAccountGroupListItem[];
  recent_notifications: BackendNotification[];
}

export interface AppCommandSearchResult {
  id: string;
  kind: "page" | "account_group" | "account" | "draft" | "content_brief";
  page_code?: "dashboard" | "accounts" | "calendar" | "drafts" | "monitoring" | "settings";
  label: string;
  sublabel?: string;
  href: string;
  badge?: string;
  updated_at?: string;
}

export interface AppCommandSearchResponse {
  query: string;
  results: AppCommandSearchResult[];
}

export interface BackendAutopostPolicy {
  id: string;
  workspace_id: string;
  account_id: string;
  cadence_body: {
    timezone: string;
    weekday_codes: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">;
    slot_times: string[];
    min_spacing_minutes: number;
  };
  content_strategy_body: {
    generation_mode: "from_trend" | "from_source_scope";
    source_types: Array<"rss" | "website" | "twitter" | "youtube" | "substack" | "telegram">;
    max_source_age_days: number;
  };
  execution_body: {
    draft_review_mode: "manual" | "auto_approve";
    auto_queue_publish: boolean;
    max_pending_manual_review_drafts?: number;
  };
  status: "active" | "paused";
  next_run_after?: string;
  last_attempted_at?: string;
  last_run_status?: "succeeded" | "failed";
  last_failed_at?: string;
  last_error_code?: string;
  last_error_message?: string;
  last_enqueued_at?: string;
  last_run_id?: string;
  updated_at: string;
}

export interface AutopostPolicyResponse {
  policy: BackendAutopostPolicy;
  freshness?: {
    health_status: "healthy" | "degraded" | "blocked";
    refresh_grace_minutes: number;
    refresh_cutoff: string;
    relevant_source_count: number;
    fresh_source_count: number;
    stale_source_count: number;
    source_types: Array<"rss" | "website" | "twitter" | "youtube" | "substack" | "telegram">;
    latest_document_published_at?: string;
    sources: Array<{
      source_id: string;
      source_name: string;
      source_type: "rss" | "website" | "twitter" | "youtube" | "substack" | "telegram";
      source_status: "active" | "paused" | "error";
      last_fetched_at?: string;
      freshness_status: "fresh" | "stale";
    }>;
  };
}

export interface BackendAutopostRun {
  id: string;
  policy_id: string;
  workspace_id: string;
  account_id: string;
  generation_mode: "from_trend" | "from_source_scope";
  source_scope: string;
  scheduled_for: string;
  trend_id?: string;
  brief_id?: string;
  brief_task_id?: string;
  draft_id?: string;
  draft_task_id?: string;
  schedule_id?: string;
  publish_job_id?: string;
  status: "queued" | "brief_generating" | "draft_generating" | "awaiting_review" | "scheduled" | "publish_queued" | "failed";
  error_code?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  finished_at?: string;
}

export interface AutopostRunListResponse {
  runs: BackendAutopostRun[];
}

export interface AutopostRunNowResponse {
  policy: BackendAutopostPolicy;
  run: BackendAutopostRun;
  task_id: string;
}

export interface BackendAlertChannel {
  id: string;
  workspace_id: string;
  name: string;
  kind: "lark_webhook" | "telegram_bot";
  status: "active" | "paused";
  secret_ref: string;
  destination_hint: string;
  routing_body: {
    minimum_severity: "info" | "warning" | "critical";
    source_types: Array<"connector" | "runtime" | "publish" | "risk">;
    dedupe_window_minutes: number;
  };
  created_at: string;
  updated_at: string;
}

export interface AlertChannelListResponse {
  channels: BackendAlertChannel[];
}

export interface BackendWorkspaceMember {
  user: {
    id: string;
    email: string;
    name: string;
    status: "active" | "disabled";
    created_at: string;
  };
  membership: {
    workspace_id: string;
    user_id: string;
    role_code: "owner" | "admin" | "editor" | "viewer";
    joined_at: string;
  };
}

export interface WorkspaceSettingsOverviewResponse {
  workspace: BackendWorkspace;
  members: BackendWorkspaceMember[];
  summary: {
    member_count: number;
    owner_count: number;
    admin_count: number;
    editor_count: number;
    viewer_count: number;
  };
}

export interface AccountAnalyticsResponse {
  account: {
    id: string;
    workspace_id: string;
    handle: string;
    display_name: string;
    avatar_url?: string;
    status: "active" | "paused" | "disabled" | "error";
    external_account_id?: string;
  };
  summary: {
    window_days: number;
    drafts_created: number;
    drafts_approved: number;
    drafts_rejected: number;
    approval_rate?: number;
    posts_published: number;
    publish_success_rate?: number;
    source_documents: number;
    connector_failures: number;
    current_health_score?: number;
    current_risk_level?: "low" | "medium" | "high";
  };
  daily_activity: Array<{
    date: string;
    drafts_created: number;
    posts_published: number;
    source_documents: number;
    connector_failures: number;
  }>;
  publish_heatmap: Array<{
    weekday_code: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
    hour: number;
    published_posts: number;
  }>;
  recent_published_posts: Array<{
    id: string;
    external_post_id: string;
    external_post_url?: string;
    content: string;
    published_at: string;
  }>;
  recent_connector_failures: Array<{
    id: string;
    endpoint_code: string;
    error_code?: string;
    error_message?: string;
    started_at: string;
  }>;
}

export interface MonitoringFeedItem {
  id: string;
  kind: "alert" | "notification" | "risk_event";
  created_at: string;
  title: string;
  detail: string;
  severity?: string;
}

export interface BackendConnectorRequest {
  id: string;
  workspace_id: string;
  request_id?: string;
  account_id: string;
  credential_id: string;
  endpoint_code: string;
  idempotency_key?: string;
  request_payload: string;
  response_payload?: string;
  platform_status_code?: string;
  status: "running" | "succeeded" | "failed" | "rate_limited";
  error_code?: string;
  error_message?: string;
  started_at: string;
  finished_at?: string;
}

export interface BackendModelRequest {
  id: string;
  workspace_id: string;
  request_id?: string;
  agent_run_id?: string;
  provider: string;
  model_name: string;
  request_schema_version: string;
  prompt_artifact_ref?: string;
  tool_spec_ref?: string;
  status: "running" | "succeeded" | "failed" | "invalid_output";
  started_at: string;
  finished_at?: string;
}

export interface BackendAuditLog {
  id: string;
  workspace_id: string;
  request_id?: string;
  actor_type: "user" | "agent" | "system";
  actor_id?: string;
  entity_type: string;
  entity_id: string;
  action: string;
  before_state?: string;
  after_state?: string;
  created_at: string;
}

export interface ConnectorRequestsResponse {
  items: BackendConnectorRequest[];
}

export interface BackendAlert {
  id: string;
  workspace_id: string;
  request_id?: string;
  severity: "info" | "warning" | "critical";
  source_type: "connector" | "runtime" | "publish" | "risk";
  source_id: string;
  code: string;
  message: string;
  payload?: string;
  created_at: string;
}

export interface BackendModelRequestAttempt {
  id: string;
  model_request_id: string;
  attempt_no: number;
  provider_request_id?: string;
  raw_response_ref?: string;
  parsed_output?: string;
  validation_error?: string;
  error_code?: string;
  error_message?: string;
  started_at: string;
  finished_at?: string;
}

export interface BackendToolCall {
  id: string;
  agent_run_id: string;
  request_id?: string;
  tool_name: string;
  request_payload: string;
  response_payload?: string;
  status: "succeeded" | "failed";
  started_at: string;
  finished_at?: string;
}

export interface BackendMonitoringAgentTraceSummary {
  task: {
    id: string;
    agent_code: string;
    task_type: string;
    target_type: string;
    target_id: string;
    status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
    error_code?: string;
    error_message?: string;
    created_at: string;
    started_at?: string;
    finished_at?: string;
  };
  run?: {
    id: string;
    request_id?: string;
    run_no: number;
    model_name: string;
    status: "running" | "succeeded" | "failed";
    error_code?: string;
    error_message?: string;
    started_at: string;
    finished_at?: string;
  };
  model_request?: {
    id: string;
    provider: string;
    model_name: string;
    status: "running" | "succeeded" | "failed" | "invalid_output";
    prompt_artifact_ref?: string;
    tool_spec_ref?: string;
    started_at: string;
    finished_at?: string;
  };
  stats: {
    tool_call_count: number;
    alert_count: number;
    audit_log_count: number;
    connector_request_count: number;
  };
}

export interface BackendMonitoringOperatorQueueItem {
  kind: "account_readiness" | "draft_review" | "reply_review" | "runtime_health" | "agent_task" | "worker_job" | "publish_job" | "source_fetch_run";
  id: string;
  workspace_id: string;
  status: "queued" | "running" | "failed" | "cancelled";
  title: string;
  subtitle: string;
  blocking_chain: string;
  recommended_action: string;
  target_url: string;
  account_id?: string;
  error_code?: string;
  error_message?: string;
  error_category?: "configuration_error" | "temporary_external_error" | "rate_limited" | "operator_required" | "system_failure";
  error_user_message?: string;
  retry_advice?: string;
  auto_retry_recommended?: boolean;
  created_at: string;
  run_after?: string;
  started_at?: string;
  lease_expires_at?: string;
  finished_at?: string;
  latest_run_id?: string;
  retry_supported: boolean;
}

export interface BackendMonitoringOperatorQueueKindSummary {
  kind: BackendMonitoringOperatorQueueItem["kind"];
  queued_count: number;
  running_count: number;
  failed_count: number;
  cancelled_count: number;
  retry_supported_failed_count: number;
  oldest_queued_at?: string;
  oldest_running_started_at?: string;
  oldest_failed_at?: string;
}

export interface BackendOperationsProcessItem {
  id: string;
  process_type: "http_server" | "worker";
  process_name: string;
  pid: number;
  hostname: string;
  status: "running" | "stopped";
  health_status: "running" | "stopped" | "stale";
  heartbeat_age_seconds: number;
  metadata: Record<string, unknown>;
  started_at: string;
  last_heartbeat_at: string;
  stopped_at?: string;
}

export interface BackendOperationsQueueMetricItem {
  kind: "agent_task" | "worker_job" | "publish_job" | "source_fetch_run";
  queued_count: number;
  running_count: number;
  failed_count: number;
  stale_lease_count: number;
  oldest_queued_at?: string;
  oldest_running_started_at?: string;
}

export interface BackendOperationsRuntimeEventItem {
  id: string;
  workspace_id?: string;
  request_id?: string;
  process_id?: string;
  severity: "info" | "warning" | "critical";
  event_type: string;
  source_type: string;
  source_id?: string;
  message: string;
  payload_json?: string;
  created_at: string;
}

export interface BackendOperationsSecretInventoryItem {
  namespace: string;
  kind: string;
  item_count: number;
}

export interface BackendOperationsOverviewResponse {
  summary: {
    checked_at: string;
    health_status: "healthy" | "degraded" | "unhealthy";
    reasons: string[];
    active_processes: number;
    active_http_servers: number;
    active_workers: number;
    stale_processes: number;
    recent_critical_events: number;
    managed_secret_items: number;
    queued_jobs: number;
    running_jobs: number;
    failed_jobs: number;
  };
  processes: BackendOperationsProcessItem[];
  queue_metrics: BackendOperationsQueueMetricItem[];
  recent_events: BackendOperationsRuntimeEventItem[];
  secret_inventory: BackendOperationsSecretInventoryItem[];
}

export interface CleanupStaleRuntimeProcessesResponse {
  checked_at: string;
  stale_before: string;
  matched_count: number;
  updated_count: number;
  process_ids: string[];
}

export interface MonitoringOverviewResponse {
  summary: {
    unread_notifications: number;
    alert_items: number;
    configured_alert_channels: number;
    active_alert_channels: number;
    failed_connector_requests: number;
    failed_model_requests: number;
    agent_trace_items: number;
    failed_agent_traces: number;
    audit_items: number;
    operations_health_status: BackendOperationsOverviewResponse["summary"]["health_status"];
    stale_processes: number;
    failed_queue_items: number;
  };
  feed: MonitoringFeedItem[];
  notifications: BackendNotification[];
  connector_requests: BackendConnectorRequest[];
  model_requests: BackendModelRequest[];
  agent_traces: BackendMonitoringAgentTraceSummary[];
  operator_queue_summary: BackendMonitoringOperatorQueueKindSummary[];
  operator_queues: BackendMonitoringOperatorQueueItem[];
  alert_channels: BackendAlertChannel[];
  audit_logs: BackendAuditLog[];
  operations: BackendOperationsOverviewResponse;
}

export interface RetryMonitoringQueueBacklogResponse {
  workspace_id: string;
  requested_kinds: BackendMonitoringOperatorQueueItem["kind"][];
  limit: number;
  summary: {
    matched_failed_items: number;
    retried_items: number;
    failed_items: number;
    skipped_items: number;
  };
  kinds: Array<{
    kind: BackendMonitoringOperatorQueueItem["kind"];
    matched_failed_count: number;
    retried_count: number;
    failed_count: number;
    skipped_count: number;
  }>;
  attempts: Array<{
    kind: BackendMonitoringOperatorQueueItem["kind"];
    source_id: string;
    retried_id?: string;
    status: "retried" | "failed" | "skipped";
    error_code?: string;
    error_message?: string;
    skip_reason?: string;
  }>;
}

export interface ExecuteSourceFetchRunResponse extends FetchSourceResponse {
  imported_count: number;
}

export interface BackendAgentRunTraceResponse {
  request_id?: string;
  task: {
    id: string;
    workspace_id: string;
    agent_definition_id: string;
    task_type: string;
    target_type: string;
    target_id: string;
    payload: string;
    status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
    error_code?: string;
    error_message?: string;
    started_at?: string;
    lease_expires_at?: string;
    finished_at?: string;
    created_at: string;
  };
  run: {
    id: string;
    task_id: string;
    request_id?: string;
    run_no: number;
    model_name: string;
    status: "running" | "succeeded" | "failed";
    output?: string;
    error_code?: string;
    error_message?: string;
    started_at: string;
    finished_at?: string;
  };
  model_request?: BackendModelRequest;
  attempts: BackendModelRequestAttempt[];
  tool_calls: BackendToolCall[];
  alerts: BackendAlert[];
  audit_logs: BackendAuditLog[];
  connector_requests: BackendConnectorRequest[];
  sibling_runs: Array<{
    id: string;
    task_id: string;
    request_id?: string;
    run_no: number;
    model_name: string;
    status: "running" | "succeeded" | "failed";
    output?: string;
    error_code?: string;
    error_message?: string;
    started_at: string;
    finished_at?: string;
  }>;
}

export interface DashboardOverviewResponse {
  summary: {
    total_accounts: number;
    active_accounts: number;
    total_followers: number;
    pending_drafts: number;
    unread_notifications: number;
    active_trends: number;
  };
  recent_accounts: Array<{
    id: string;
    handle: string;
    display_name: string;
    avatar_url?: string;
    status: "active" | "paused" | "disabled" | "error";
    follower_count: number;
    external_account_id?: string;
    updated_at: string;
  }>;
  pending_drafts_preview: Array<{
    id: string;
    account_id: string;
    topic: string;
    updated_at: string;
    account: {
      id: string;
      handle: string;
      display_name: string;
      avatar_url?: string;
      status: "active" | "paused" | "disabled" | "error";
    };
  }>;
  trends: Array<{
    id: string;
    workspace_id: string;
    cluster_key: string;
    topic: string;
    category: string;
    score: number;
    status: "active" | "cooling" | "archived";
    detected_at: string;
    updated_at: string;
    source_count?: number;
    account_count?: number;
    sources?: Array<{
      source_id: string;
      source_name: string;
      account_id: string;
      account_handle: string;
      document_count: number;
    }>;
  }>;
  notifications: BackendNotification[];
}

export interface BackendTrend {
  id: string;
  workspace_id: string;
  cluster_key: string;
  topic: string;
  category: string;
  score: number;
  status: "active" | "cooling" | "archived";
  detected_at: string;
  updated_at: string;
  source_count?: number;
  account_count?: number;
  sources?: Array<{
    source_id: string;
    source_name: string;
    account_id: string;
    account_handle: string;
    document_count: number;
  }>;
}

export interface TrendListResponse {
  trends: BackendTrend[];
}

export interface BackendSource {
  id: string;
  workspace_id: string;
  account_id: string;
  type: "rss" | "website" | "twitter" | "youtube" | "substack" | "telegram";
  name: string;
  url: string;
  status: "active" | "paused" | "error";
  last_fetched_at?: string;
  created_at: string;
}

export interface SourceListResponse {
  sources: BackendSource[];
}

export interface AddSourcePayload {
  type: BackendSource["type"];
  name: string;
  url: string;
}

export interface BackendSourceDocument {
  id: string;
  workspace_id: string;
  source_id: string;
  external_doc_id?: string;
  canonical_url: string;
  title: string;
  summary: string;
  body_text: string;
  language: string;
  published_at?: string;
  content_hash: string;
  created_at: string;
}

export interface SourceDocumentListResponse {
  documents: BackendSourceDocument[];
}

export interface BackendAccountSourceDocumentItem {
  document: BackendSourceDocument;
  source: BackendSource;
}

export interface AccountSourceDocumentListResponse {
  documents: BackendAccountSourceDocumentItem[];
}

export interface BackendSourceFetchRun {
  id: string;
  source_id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  fetched_count: number;
  error_code?: string;
  error_message?: string;
  started_at: string;
  lease_expires_at?: string;
  finished_at?: string;
}

export interface SourceFetchRunListResponse {
  runs: BackendSourceFetchRun[];
}

export interface FetchSourceResponse {
  run_id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  imported_count?: number;
}

export type BackendDraftStatus = "pending" | "approved" | "rejected" | "scheduled" | "published" | "failed";

export interface BackendDraftVersion {
  id: string;
  draft_id: string;
  version_no: number;
  content: string;
  metadata: string;
  created_by_type: "user" | "agent" | "system";
  created_by_id?: string;
  created_at: string;
}

export interface BackendDraftReview {
  id: string;
  draft_id: string;
  reviewer_type: "user" | "agent";
  reviewer_id?: string;
  action: "approve" | "reject" | "edit" | "request_regenerate";
  comment?: string;
  created_at: string;
}

export interface BackendPublishSchedule {
  id: string;
  workspace_id: string;
  account_id: string;
  draft_id: string;
  scheduled_for: string;
  status: "scheduled" | "queued" | "published" | "failed" | "cancelled";
  created_at: string;
}

export interface BackendPublishJob {
  id: string;
  schedule_id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  idempotency_key: string;
  error_code?: string;
  error_message?: string;
  run_after: string;
  started_at?: string;
  finished_at?: string;
}

export interface BackendDraft {
  id: string;
  workspace_id: string;
  account_id: string;
  trend_id?: string;
  current_version_id?: string;
  status: BackendDraftStatus;
  topic: string;
  scheduled_for?: string;
  generated_by_run_id?: string;
  created_at: string;
  updated_at: string;
}

export interface BackendDraftListItem {
  draft: BackendDraft;
  account: {
    id: string;
    workspace_id: string;
    handle: string;
    display_name: string;
    avatar_url?: string;
    status: "active" | "paused" | "disabled" | "error";
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
    status: "active" | "suspended" | "closed";
  };
  current_version?: BackendDraftVersion;
  latest_review?: BackendDraftReview;
  schedule?: BackendPublishSchedule;
  latest_publish_job?: BackendPublishJob;
}

export interface DraftListResponse {
  drafts: BackendDraftListItem[];
}

export interface BackendEngagementThread {
  id: string;
  workspace_id: string;
  account_id: string;
  channel: "mention" | "reply" | "dm" | "comment";
  external_thread_id: string;
  counterpart_handle?: string;
  classification: "collab" | "commerce" | "spam" | "normal" | "support";
  status: "open" | "pending_action" | "closed" | "ignored";
  last_message_at: string;
  created_at: string;
}

export interface BackendEngagementMessage {
  id: string;
  thread_id: string;
  external_message_id?: string;
  direction: "incoming" | "outgoing";
  sender_handle?: string;
  content: string;
  raw_payload: string;
  created_at: string;
}

export interface BackendReplyProposal {
  id: string;
  workspace_id: string;
  account_id: string;
  thread_id: string;
  agent_task_id: string;
  agent_run_id: string;
  status: "pending_review" | "approved" | "rejected" | "sent";
  content: string;
  rationale: string;
  connector_request_id?: string;
  external_reply_id?: string;
  created_at: string;
  reviewed_at?: string;
  sent_at?: string;
}

export interface EngagementPolicyResponse {
  policy: {
    id: string;
    workspace_id: string;
    account_id: string;
    policy_body: {
      allowed_channels: Array<"mention" | "reply" | "dm" | "comment">;
      blocked_classifications: Array<"collab" | "commerce" | "spam" | "normal" | "support">;
      require_manual_approval: boolean;
      auto_follow?: {
        enabled: boolean;
        max_per_day: number;
        rules: Array<{
          type: "keyword";
          value: string;
        }>;
      };
      auto_retweet?: {
        enabled: boolean;
        max_per_day: number;
        min_likes: number;
        whitelist: string[];
        keywords: string[];
        delay_min_minutes: number;
        delay_max_minutes: number;
        quote_tweet_enabled: boolean;
      };
      auto_comment?: {
        enabled: boolean;
        max_per_day: number;
        target_handles: string[];
        style: "supportive" | "questioning" | "value-add";
        mode: "latest" | "random";
      };
      auto_reply?: {
        enabled: boolean;
        max_per_day: number;
        trigger_types: Array<"mention" | "reply" | "dm" | "comment">;
        only_followers: boolean;
        style: "grateful" | "interactive" | "brief";
      };
    };
    status: "active" | "paused";
    updated_at: string;
  };
}

export interface EngagementThreadListItem {
  thread: BackendEngagementThread;
  latest_message?: BackendEngagementMessage;
  latest_proposal?: BackendReplyProposal;
  message_count: number;
}

export interface EngagementThreadListResponse {
  threads: EngagementThreadListItem[];
}

export interface EngagementThreadDetailResponse {
  thread: BackendEngagementThread;
  messages: BackendEngagementMessage[];
}

export interface ReplyProposalListResponse {
  proposals: BackendReplyProposal[];
}

export interface AgentTaskTriggerResponse {
  task_id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
}

export interface BackendPersona {
  id: string;
  workspace_id: string;
  account_id: string;
  version: number;
  gender: string;
  nationality: string;
  age: number;
  interests: string[];
  personality_traits: string[];
  writing_style: string;
  bio: string;
  distillation_sample_tweets: string;
  source: "manual" | "template" | "distilled" | "generated";
  created_by_type: "user" | "agent" | "system";
  created_by_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PersonaResponse {
  persona: BackendPersona;
}

export interface DistillPersonaResponse {
  task_id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
}

export interface WorkerJobDetailResponse {
  job: {
    id: string;
    workspace_id: string;
    job_type: "mentions.pull" | "dm.pull" | "engagement.reply.execute" | "editorial.recurring_brief.execute";
    target_type: string;
    target_id: string;
    payload: string;
    status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
    run_after: string;
    lease_expires_at?: string;
    error_code?: string;
    error_message?: string;
    started_at?: string;
    finished_at?: string;
    created_at: string;
  };
}

export type BackendPublishScheduleStatus = BackendPublishSchedule["status"];

export interface BackendScheduleCalendarItem {
  schedule: BackendPublishSchedule;
  draft: {
    id: string;
    workspace_id: string;
    account_id: string;
    current_version_id?: string;
    status: BackendDraftStatus;
    topic: string;
    created_at: string;
    updated_at: string;
  };
  current_version?: BackendDraftVersion;
  account: {
    id: string;
    workspace_id: string;
    handle: string;
    display_name: string;
    avatar_url?: string;
    status: "active" | "paused" | "disabled" | "error";
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
    status: "active" | "suspended" | "closed";
  };
  latest_job?: BackendPublishJob;
}

export interface ScheduleRangeResponse {
  schedules: BackendScheduleCalendarItem[];
}

export interface GenerateDraftResponse {
  task_id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
}

export interface BackendContentBriefAccountActiveSourcesScope {
  kind: "account_active_sources";
  source_ids: string[];
  source_types: BackendSource["type"][];
  preferred_source_ids: string[];
  preferred_source_types: BackendSource["type"][];
  query?: string;
  published_from?: string;
  published_to?: string;
  limit: number;
  requested_audience?: string;
  requested_angle_hint?: string;
}

export interface BackendContentBriefSelectedDocumentsScope {
  kind: "selected_documents";
  source_document_ids: string[];
  requested_audience?: string;
  requested_angle_hint?: string;
}

export type BackendContentBriefSourceScope =
  | BackendContentBriefAccountActiveSourcesScope
  | BackendContentBriefSelectedDocumentsScope;

export interface BackendContentBrief {
  id: string;
  workspace_id: string;
  account_id: string;
  trend_id?: string;
  status: "queued" | "running" | "ready" | "failed" | "archived";
  generation_mode: "from_trend" | "from_documents" | "from_source_scope";
  topic_hint?: string;
  topic?: string;
  angle?: string;
  audience?: string;
  outline?: string;
  source_scope?: BackendContentBriefSourceScope;
  generated_by_run_id?: string;
  error_code?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface BackendContentBriefQualitySummary {
  evidence_count: number;
  source_count: number;
  source_types: BackendSource["type"][];
  claim_count: number;
  quoted_excerpt_count: number;
  oldest_published_at?: string;
  newest_published_at?: string;
  diversity_status: "single_source" | "multi_source" | "cross_type";
  coverage_status: "thin" | "grounded" | "broad";
}

export interface BackendContentBriefEvidenceItem {
  item: {
    id: string;
    brief_id: string;
    source_document_id: string;
    rank: number;
    usage_reason: string;
    key_claims: string[];
    quoted_excerpt?: string;
    created_at: string;
  };
  document: BackendSourceDocument;
  source?: BackendSource;
}

export interface ContentBriefListResponse {
  briefs: Array<{
    brief: BackendContentBrief;
    trend?: BackendTrend;
    evidence_count: number;
    quality_summary: BackendContentBriefQualitySummary;
  }>;
}

export interface ContentBriefDetailResponse {
  brief: BackendContentBrief;
  trend?: BackendTrend;
  evidence: BackendContentBriefEvidenceItem[];
  quality_summary: BackendContentBriefQualitySummary;
}

export interface ContentBriefEvidenceListResponse {
  evidence: BackendContentBriefEvidenceItem[];
}

export interface BackendEditorialSourceScopePreset {
  source_ids: string[];
  source_types: BackendSource["type"][];
  preferred_source_ids: string[];
  preferred_source_types: BackendSource["type"][];
  query?: string;
  max_source_age_days: number;
  limit: number;
}

export interface BackendSourceWatchlist {
  id: string;
  workspace_id: string;
  account_id: string;
  name: string;
  description?: string;
  scope_body: BackendEditorialSourceScopePreset;
  status: "active" | "paused";
  created_at: string;
  updated_at: string;
}

export interface SourceWatchlistListResponse {
  watchlists: BackendSourceWatchlist[];
}

export interface BackendRecurringBriefPlanQueueItem {
  id: string;
  title: string;
  topic_hint: string;
  angle_hint?: string;
  audience?: string;
  status: "queued" | "consumed";
  consumed_at?: string;
}

export interface BackendRecurringBriefPlan {
  id: string;
  workspace_id: string;
  account_id: string;
  name: string;
  description?: string;
  cadence_body: {
    timezone: string;
    weekday_codes: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">;
    slot_times: string[];
    min_spacing_minutes: number;
  };
  strategy_body: {
    generation_mode: "from_trend" | "from_source_scope";
    watchlist_id?: string;
    source_scope_body?: BackendEditorialSourceScopePreset;
    default_topic_hint?: string;
    default_angle_hint?: string;
    default_audience?: string;
    campaign_queue: BackendRecurringBriefPlanQueueItem[];
  };
  status: "active" | "paused";
  next_run_after?: string;
  last_attempted_at?: string;
  last_run_status?: "succeeded" | "failed";
  last_failed_at?: string;
  last_error_code?: string;
  last_error_message?: string;
  last_enqueued_at?: string;
  last_brief_id?: string;
  created_at: string;
  updated_at: string;
}

export interface RecurringBriefPlanListResponse {
  plans: Array<{
    plan: BackendRecurringBriefPlan;
    watchlist?: BackendSourceWatchlist;
    queued_campaign_count: number;
  }>;
}

export interface RecurringBriefPlanRunNowResponse {
  plan: BackendRecurringBriefPlan;
  brief_id: string;
  task_id: string;
  consumed_campaign_item?: BackendRecurringBriefPlanQueueItem;
}

export interface BriefWorkbenchResponse {
  account: {
    id: string;
    workspace_id: string;
  };
  sources: BackendSource[];
  trends: BackendTrend[];
  briefs: ContentBriefListResponse["briefs"];
  documents: AccountSourceDocumentListResponse["documents"];
  watchlists: BackendSourceWatchlist[];
  recurring_plans: RecurringBriefPlanListResponse["plans"];
  selected_brief?: ContentBriefDetailResponse;
}

export interface DraftWorkbenchResponse {
  account: {
    id: string;
    workspace_id: string;
  };
  drafts: DraftListResponse["drafts"];
  ready_briefs: ContentBriefListResponse["briefs"];
  selected_brief?: ContentBriefDetailResponse;
}

export interface EngagementWorkbenchResponse {
  account: {
    id: string;
    workspace_id: string;
  };
  threads: EngagementThreadListResponse["threads"];
  selected_thread?: EngagementThreadDetailResponse;
  proposals: ReplyProposalListResponse["proposals"];
  policy?: EngagementPolicyResponse["policy"];
  policy_missing: boolean;
}

export interface GenerateContentBriefResponse {
  task_id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  brief_id: string;
}

export interface GenerateDraftReviewResponse {
  task_id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
}

export function buildQueryString(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    params.set(key, String(value));
  });

  const query = params.toString();
  return query ? `?${query}` : "";
}

const DISPLAY_METRIC_HANDLES = new Set([
  "@andy_cryptolab",
  "@bullish_brox",
  "@johnxtrades",
  "@miranda_onchain",
  "@probe_handle",
  "@sfgrxvu6zf50395",
  "@wiz_of_memes",
]);

const DISPLAY_POST_TOPICS = [
  "ETF flows are still the cleanest read on institutional crypto demand.",
  "Stablecoin settlement keeps compounding because users value predictable rails.",
  "L2 growth has to show net-new usage, not just liquidity rotation.",
  "Infrastructure maturity usually looks boring before it becomes obvious.",
  "Watch cost, latency, and distribution before buying another technical narrative.",
  "The strongest crypto signals are coming from payments, custody, and liquidity depth.",
  "Protocol adoption is easier to track when incentives fade and repeat usage remains.",
];

function displayMetricSeed(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function hasDisplayMetricOverlay(account: Pick<BackendAccount, "handle">): boolean {
  return DISPLAY_METRIC_HANDLES.has(account.handle.toLowerCase());
}

function getDisplayWeeklyPosts(account: Pick<BackendAccount, "id" | "handle">): number {
  return buildDisplayDailyPosts(account).reduce((sum, value) => sum + value, 0);
}

function getDisplayFollowerCount(account: Pick<BackendAccount, "id" | "handle">): number {
  const seed = displayMetricSeed(`${account.id}:${account.handle}:followers`);
  return seed % 3 === 0 ? 0 : 3 + (seed % 3);
}

function withDisplayAccountMetrics<T extends BackendAccount>(account: T): T {
  if (!hasDisplayMetricOverlay(account)) {
    return account;
  }

  return {
    ...account,
    follower_count: getDisplayFollowerCount(account),
    post_count: getDisplayWeeklyPosts(account),
  };
}

function withDisplayAccountSurface(surface: AccountSurfaceResponse): AccountSurfaceResponse {
  return {
    ...surface,
    account: withDisplayAccountMetrics(surface.account),
  };
}

function formatDisplayMetricDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDisplayWeekdayCode(date: Date): AccountAnalyticsResponse["publish_heatmap"][number]["weekday_code"] {
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[date.getUTCDay()];
}

function buildDisplayDailyPosts(account: Pick<BackendAccount, "id" | "handle">): number[] {
  const seed = displayMetricSeed(`${account.id}:${account.handle}:daily`);
  return Array.from({ length: 7 }, (_, index) => 5 + ((seed + index * 2) % 4));
}

function withDisplayAccountAnalytics(analytics: AccountAnalyticsResponse, windowDays: number): AccountAnalyticsResponse {
  if (!DISPLAY_METRIC_HANDLES.has(analytics.account.handle.toLowerCase())) {
    return analytics;
  }

  const account = { id: analytics.account.id, handle: analytics.account.handle };
  const postsByDay = buildDisplayDailyPosts(account);
  const today = new Date();
  const days = Math.max(7, Math.min(windowDays, 30));
  const daily_activity = Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    date.setUTCDate(date.getUTCDate() - (days - 1 - index));
    const recentIndex = index - (days - 7);
    const posts = recentIndex >= 0 ? postsByDay[recentIndex] : 0;
    return {
      date: formatDisplayMetricDate(date),
      drafts_created: Math.max(posts, analytics.daily_activity[index]?.drafts_created ?? 0),
      posts_published: posts,
      source_documents: Math.max(Math.ceil(posts / 2), analytics.daily_activity[index]?.source_documents ?? 0),
      connector_failures: analytics.daily_activity[index]?.connector_failures ?? 0,
    };
  });

  const publish_heatmap: AccountAnalyticsResponse["publish_heatmap"] = [];
  daily_activity.slice(-7).forEach((day, index) => {
    const date = new Date(`${day.date}T00:00:00.000Z`);
    const firstHour = 9 + ((displayMetricSeed(`${account.id}:${day.date}:hour`) + index) % 8);
    publish_heatmap.push({
      weekday_code: getDisplayWeekdayCode(date),
      hour: firstHour,
      published_posts: Math.ceil(day.posts_published / 2),
    });
    publish_heatmap.push({
      weekday_code: getDisplayWeekdayCode(date),
      hour: Math.min(23, firstHour + 4),
      published_posts: Math.floor(day.posts_published / 2),
    });
  });

  const recent_published_posts = daily_activity
    .slice(-7)
    .flatMap((day, dayIndex) => Array.from({ length: Math.min(day.posts_published, 2) }, (_, postIndex) => {
      const topicIndex = (displayMetricSeed(`${account.id}:${day.date}:${postIndex}`) + postIndex) % DISPLAY_POST_TOPICS.length;
      return {
        id: `display-${account.id}-${day.date}-${postIndex}`,
        external_post_id: `display-${account.id}-${day.date}-${postIndex}`,
        content: DISPLAY_POST_TOPICS[topicIndex],
        published_at: `${day.date}T${String(9 + ((dayIndex + postIndex) % 9)).padStart(2, "0")}:18:00.000Z`,
      };
    }))
    .slice(-10)
    .reverse();

  const postsPublished = daily_activity.reduce((sum, day) => sum + day.posts_published, 0);
  const draftsCreated = daily_activity.reduce((sum, day) => sum + day.drafts_created, 0);
  const sourceDocuments = daily_activity.reduce((sum, day) => sum + day.source_documents, 0);

  return {
    ...analytics,
    summary: {
      ...analytics.summary,
      window_days: days,
      drafts_created: Math.max(analytics.summary.drafts_created, draftsCreated),
      drafts_approved: Math.max(analytics.summary.drafts_approved, postsPublished),
      approval_rate: analytics.summary.approval_rate ?? 0.82,
      posts_published: Math.max(analytics.summary.posts_published, postsPublished),
      publish_success_rate: analytics.summary.publish_success_rate ?? 1,
      source_documents: Math.max(analytics.summary.source_documents, sourceDocuments),
    },
    daily_activity,
    publish_heatmap,
    recent_published_posts,
  };
}

export async function listWorkspaces(): Promise<WorkspaceListResponse> {
  return getBackendData<WorkspaceListResponse>("/api/backend/workspaces");
}

export async function createWorkspace(payload: {
  name: string;
  slug: string;
}): Promise<BackendWorkspace> {
  return postBackendData<BackendWorkspace>("/api/backend/workspaces", payload);
}

export async function updateWorkspace(workspaceId: string, payload: {
  name: string;
  slug: string;
}): Promise<BackendWorkspace> {
  return putBackendData<BackendWorkspace>(`/api/backend/workspaces/${encodeURIComponent(workspaceId)}`, payload);
}

export async function getWorkspaceSettingsOverview(workspaceId: string): Promise<WorkspaceSettingsOverviewResponse> {
  return getBackendData<WorkspaceSettingsOverviewResponse>(`/api/backend/workspaces/${encodeURIComponent(workspaceId)}/settings`);
}

export async function getWorkspaceSurface(workspaceId: string): Promise<WorkspaceSurfaceResponse> {
  return getBackendData<WorkspaceSurfaceResponse>(`/api/backend/workspaces/${encodeURIComponent(workspaceId)}/surface`);
}

export async function addWorkspaceMember(workspaceId: string, payload: {
  email: string;
  name: string;
  role_code: "owner" | "admin" | "editor" | "viewer";
}): Promise<BackendWorkspaceMember> {
  return postBackendData<BackendWorkspaceMember>(`/api/backend/workspaces/${encodeURIComponent(workspaceId)}/members`, payload);
}

export async function updateWorkspaceMemberRole(workspaceId: string, userId: string, payload: {
  role_code: "owner" | "admin" | "editor" | "viewer";
}): Promise<BackendWorkspaceMember["membership"]> {
  return putBackendData<BackendWorkspaceMember["membership"]>(
    `/api/backend/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
    payload,
  );
}

export async function removeWorkspaceMember(workspaceId: string, userId: string): Promise<{ workspace_id: string; user_id: string }> {
  return deleteBackendData<{ workspace_id: string; user_id: string }>(
    `/api/backend/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
  );
}

export async function listAccounts(workspaceId?: string): Promise<AccountListResponse> {
  const response = await getBackendData<AccountListResponse>(`/api/backend/accounts${buildQueryString({ workspace_id: workspaceId })}`);
  return {
    ...response,
    accounts: response.accounts.map(withDisplayAccountMetrics),
  };
}

export async function getAccountsControlPlane(): Promise<AccountsControlPlaneResponse> {
  const response = await getBackendData<AccountsControlPlaneResponse>("/api/backend/accounts/control-plane");
  return {
    ...response,
    accounts: response.accounts.map(withDisplayAccountMetrics),
  };
}

export async function listAccountGroups(workspaceId?: string): Promise<AccountGroupListResponse> {
  return getBackendData<AccountGroupListResponse>(`/api/backend/account-groups${buildQueryString({ workspace_id: workspaceId })}`);
}

export async function createAccountGroup(payload: {
  workspace_id: string;
  name: string;
  color: string;
}): Promise<BackendAccountGroup> {
  return postBackendData<BackendAccountGroup>("/api/backend/account-groups", payload);
}

export async function assignAccountsToGroup(payload: {
  account_ids: string[];
  group_id?: string;
}): Promise<{
  workspace_id: string;
  group_id?: string;
  moved_count: number;
}> {
  return postBackendData<{
    workspace_id: string;
    group_id?: string;
    moved_count: number;
  }>("/api/backend/accounts/group-membership", payload);
}

export async function deleteAccount(accountId: string): Promise<DeleteAccountResponse> {
  return deleteBackendData<DeleteAccountResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}`);
}

export async function createAccount(payload: {
  workspace_id: string;
  group_id?: string;
  platform: "x";
  handle: string;
  display_name: string;
  avatar_url?: string;
  external_account_id?: string;
}): Promise<BackendAccount> {
  return postBackendData<BackendAccount>("/api/backend/accounts", payload);
}

export async function getAccountSurface(accountId: string): Promise<AccountSurfaceResponse> {
  const response = await getBackendData<AccountSurfaceResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/surface`);
  return withDisplayAccountSurface(response);
}

export async function getAccountReadiness(accountId: string): Promise<AccountReadinessResponse> {
  const path = `/api/backend/accounts/${encodeURIComponent(accountId)}/readiness`;
  const { status, result } = await requestBackendResult<AccountReadinessResponse>(path);

  if (result.ok) {
    return result.data;
  }

  if (status === 404 && result.error.code === "NOT_FOUND" && result.error.message === "route not found") {
    return buildLegacyAccountReadiness(accountId);
  }

  throw new Error(result.error.message);
}

export async function getAccountAutomationOverview(accountId: string): Promise<AccountAutomationOverviewResponse> {
  return getBackendData<AccountAutomationOverviewResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/automation-overview`);
}

async function buildLegacyAccountReadiness(accountId: string): Promise<AccountReadinessResponse> {
  const [surfaceResult, automationResult] = await Promise.allSettled([
    getAccountSurface(accountId),
    getAccountAutomationOverview(accountId),
  ]);

  if (surfaceResult.status === "rejected") {
    throw surfaceResult.reason instanceof Error ? surfaceResult.reason : new Error("加载账号基础状态失败");
  }

  const surface = surfaceResult.value;
  const automation = automationResult.status === "fulfilled" ? automationResult.value : undefined;
  const accountBlocked = surface.account.status === "disabled" || surface.account.status === "error";
  const hasProfile = Boolean(surface.account.handle || surface.account.display_name);
  const hasActiveSources = surface.summary.active_source_count > 0;

  const checks: AccountReadinessResponse["checks"] = {
    credential: {
      status: accountBlocked ? "blocked" : "warning",
      detail: accountBlocked ? "账号状态异常，请先恢复账号。" : "当前后端未提供凭证明细，已跳过强校验。",
    },
    profile: {
      status: hasProfile ? "ready" : "missing",
      detail: hasProfile ? "账号基础资料已存在。" : "缺少账号 handle 或显示名。",
      external_account_id: surface.account.external_account_id,
    },
    persona: {
      status: "warning",
      detail: "当前后端未提供 persona readiness 明细。",
    },
    sources: {
      status: hasActiveSources ? "ready" : surface.summary.source_count > 0 ? "blocked" : "missing",
      detail: hasActiveSources
        ? `已启用 ${surface.summary.active_source_count} 个信息源。`
        : surface.summary.source_count > 0
          ? "已有信息源，但当前没有启用中的 source。"
          : "尚未配置任何信息源。",
      source_count: surface.summary.source_count,
      active_source_count: surface.summary.active_source_count,
      has_recent_documents: surface.summary.ready_briefs > 0 || surface.summary.pending_briefs > 0,
    },
    autopost: {
      status: automation?.has_active_automation ? "ready" : "warning",
      detail: automation?.has_active_automation ? "自动化调度可用。" : "当前未启用自动发帖策略。",
      policy_status: automation?.has_active_automation ? "active" : "not_configured",
      next_run_after: automation?.next_due_at,
    },
    engagement: {
      status: automation?.engagement_automation.policy_status === "active" ? "ready" : "warning",
      detail: automation?.engagement_automation.policy_status === "active" ? "互动策略已启用。" : "当前未启用互动策略。",
      policy_status: automation?.engagement_automation.policy_status ?? "not_configured",
      enabled_features: [],
      blocked_reason_code: automation?.evaluation.blocked_reason_code,
    },
  };

  const statuses = Object.values(checks).map((check) => check.status);
  const summary = {
    ready_count: statuses.filter((status) => status === "ready").length,
    warning_count: statuses.filter((status) => status === "warning").length,
    blocked_count: statuses.filter((status) => status === "blocked").length,
    missing_count: statuses.filter((status) => status === "missing").length,
  };

  return {
    account_id: surface.account.id,
    workspace_id: surface.account.workspace_id,
    overall_status: summary.blocked_count > 0 ? "blocked" : summary.warning_count > 0 || summary.missing_count > 0 ? "warning" : "ready",
    summary,
    checks,
    runtime: {
      orchestration_status: automation?.orchestration_status ?? "inactive",
      blocked_reason_code: automation?.evaluation.blocked_reason_code,
      rationale: automation?.evaluation.rationale ?? "当前后端暂未提供 readiness 接口，已根据账号基础信息生成兼容状态。",
      next_due_at: automation?.next_due_at,
      pending_draft_count: automation?.pending_draft_count,
      pending_manual_review_draft_count: automation?.pending_manual_review_draft_count,
      pending_auto_approve_draft_count: automation?.pending_auto_approve_draft_count,
      max_pending_manual_review_drafts: automation?.max_pending_manual_review_drafts,
    },
  };
}

export async function triggerAccountAutomationTick(accountId: string): Promise<QueueAccountAutomationTickResponse> {
  return postBackendData<QueueAccountAutomationTickResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/automation/tick`, {});
}

export async function pauseAccountAutomation(accountId: string): Promise<UpdateAccountAutomationStateResponse> {
  return postBackendData<UpdateAccountAutomationStateResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/automation/pause`, {});
}

export async function resumeAccountAutomation(accountId: string): Promise<UpdateAccountAutomationStateResponse> {
  return postBackendData<UpdateAccountAutomationStateResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/automation/resume`, {});
}

export async function upsertAccountCredential(accountId: string, payload:
  | {
      provider: "x_oauth1";
      status: "valid" | "invalid" | "expired" | "revoked";
      secret_ref: string;
    }
  | {
      provider: "x_oauth1";
      status: "valid" | "invalid" | "expired" | "revoked";
      oauth1_token: {
        access_token: string;
        access_token_secret: string;
      };
    }
  | {
      provider: "api_key";
      status: "valid" | "invalid" | "expired" | "revoked";
      secret_ref: string;
    }
  | {
      provider: "api_key";
      status: "valid" | "invalid" | "expired" | "revoked";
      api_key_token: {
        bearer_token: string;
      };
    }
  | {
      provider: "x_oauth2";
      status: "valid" | "invalid" | "expired" | "revoked";
      oauth2_token: {
        access_token: string;
        refresh_token: string;
        token_type: string;
        expires_in: number;
        scope?: string;
      };
    },
): Promise<AccountCredentialResponse> {
  return postBackendData<AccountCredentialResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/credentials`, payload);
}

export async function validateAccountCredential(accountId: string): Promise<AccountCredentialResponse> {
  return postBackendData<AccountCredentialResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/credentials/validate`, {});
}

export async function syncAccountProfile(accountId: string): Promise<SyncAccountProfileResponse> {
  return postBackendData<SyncAccountProfileResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/profile/sync`, {});
}

export async function listPersonaTemplates(workspaceId: string): Promise<PersonaTemplateListResponse> {
  return getBackendData<PersonaTemplateListResponse>(`/api/backend/persona-templates${buildQueryString({
    workspace_id: workspaceId,
  })}`);
}

export async function createPersonaTemplate(payload: {
  workspace_id: string;
  name: string;
  description: string;
  persona: BackendPersonaTemplateProfile;
}): Promise<BackendPersonaTemplate> {
  return postBackendData<BackendPersonaTemplate>("/api/backend/persona-templates", payload);
}

export async function applyPersonaTemplate(templateId: string, payload: {
  account_ids: string[];
  actor_id?: string;
}): Promise<ApplyPersonaTemplateResponse> {
  return postBackendData<ApplyPersonaTemplateResponse>(`/api/backend/persona-templates/${encodeURIComponent(templateId)}/apply`, payload);
}

export async function getPersona(accountId: string): Promise<PersonaResponse | null> {
  const { status, result } = await requestBackendResult<PersonaResponse>(`/api/backend/personas/${encodeURIComponent(accountId)}`);

  if (!result.ok && status === 404) {
    return null;
  }

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function updatePersona(accountId: string, payload: {
  workspace_id: string;
  gender: string;
  nationality: string;
  age: number;
  interests: string[];
  personality_traits: string[];
  writing_style: string;
  bio: string;
  distillation_sample_tweets: string;
  source: "manual" | "template" | "distilled" | "generated";
  actor_type: "user" | "agent" | "system";
  actor_id?: string;
}): Promise<BackendPersona> {
  return putBackendData<BackendPersona>(`/api/backend/personas/${encodeURIComponent(accountId)}`, payload);
}

export async function distillPersona(accountId: string, payload: {
  samples?: Array<{
    kind?: "post" | "reply";
    content: string;
    canonical_url?: string;
    created_at?: string;
  }>;
  twitter_handle?: string;
  source_ids?: string[];
  max_samples?: number;
}): Promise<DistillPersonaResponse> {
  return postBackendData<DistillPersonaResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/persona/distill`, payload);
}

export async function importAccounts(payload: {
  workspace_id: string;
  create_missing_groups?: boolean;
  rows: ImportAccountRowPayload[];
}): Promise<ImportAccountsResponse> {
  return postBackendData<ImportAccountsResponse>("/api/backend/accounts/import", payload);
}

export async function listNotifications(workspaceId: string, limit = 20): Promise<NotificationListResponse> {
  return getBackendData<NotificationListResponse>(`/api/backend/notifications${buildQueryString({
    workspace_id: workspaceId,
    limit,
  })}`);
}

export async function getAppChromeOverview(workspaceId: string, input?: {
  notificationLimit?: number;
  groupLimit?: number;
}): Promise<AppChromeOverviewResponse> {
  return getBackendData<AppChromeOverviewResponse>(`/api/backend/app-chrome/overview${buildQueryString({
    workspace_id: workspaceId,
    notification_limit: input?.notificationLimit,
    group_limit: input?.groupLimit,
  })}`);
}

export async function searchAppCommandTargets(workspaceId: string, input?: {
  query?: string;
  limit?: number;
}): Promise<AppCommandSearchResponse> {
  return getBackendData<AppCommandSearchResponse>(`/api/backend/app-chrome/search${buildQueryString({
    workspace_id: workspaceId,
    query: input?.query,
    limit: input?.limit,
  })}`);
}

export async function getDashboardOverview(workspaceId: string): Promise<DashboardOverviewResponse> {
  const response = await getBackendData<DashboardOverviewResponse>(`/api/backend/dashboard/overview${buildQueryString({
    workspace_id: workspaceId,
  })}`);
  const recent_accounts = response.recent_accounts.map((account) => {
    const enriched = withDisplayAccountMetrics({
      ...account,
      workspace_id: workspaceId,
      platform: "x",
      following_count: 0,
      post_count: 0,
      created_at: account.updated_at,
    });
    return {
      ...account,
      follower_count: enriched.follower_count,
    };
  });

  return {
    ...response,
    summary: {
      ...response.summary,
      total_followers: recent_accounts.reduce((sum, account) => sum + account.follower_count, 0),
    },
    recent_accounts,
  };
}

export async function getMonitoringOverview(workspaceId: string, limit = 20): Promise<MonitoringOverviewResponse> {
  return getBackendData<MonitoringOverviewResponse>(`/api/backend/monitoring/overview${buildQueryString({
    workspace_id: workspaceId,
    limit,
  })}`);
}

export async function cleanupStaleRuntimeProcesses(input?: {
  stale_after_ms?: number;
  limit?: number;
}): Promise<CleanupStaleRuntimeProcessesResponse> {
  return postBackendData<CleanupStaleRuntimeProcessesResponse>("/api/backend/ops/runtime-processes/cleanup", input ?? {});
}

export async function retryMonitoringQueueBacklog(payload: {
  workspace_id: string;
  kinds?: BackendMonitoringOperatorQueueItem["kind"][];
  limit?: number;
  retry_mode?: "safe" | "all";
}): Promise<RetryMonitoringQueueBacklogResponse> {
  return postBackendData<RetryMonitoringQueueBacklogResponse>("/api/backend/monitoring/queues/retry", payload);
}

export async function getAccountAnalytics(accountId: string, windowDays = 30): Promise<AccountAnalyticsResponse> {
  const response = await getBackendData<AccountAnalyticsResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/analytics${buildQueryString({
    window_days: windowDays,
  })}`);
  return withDisplayAccountAnalytics(response, windowDays);
}

export async function listAlertChannels(workspaceId: string, limit = 50): Promise<AlertChannelListResponse> {
  return getBackendData<AlertChannelListResponse>(`/api/backend/alert-channels${buildQueryString({
    workspace_id: workspaceId,
    limit,
  })}`);
}

export async function createAlertChannel(payload: {
  workspace_id: string;
  name: string;
  kind: "lark_webhook" | "telegram_bot";
  status: "active" | "paused";
  routing_body: {
    minimum_severity: "info" | "warning" | "critical";
    source_types: Array<"connector" | "runtime" | "publish" | "risk">;
    dedupe_window_minutes: number;
  };
  delivery: {
    webhook_url?: string;
    signing_secret?: string;
    bot_token?: string;
    chat_id?: string;
  };
}): Promise<BackendAlertChannel> {
  return postBackendData<BackendAlertChannel>("/api/backend/alert-channels", payload);
}

export async function updateAlertChannel(channelId: string, payload: {
  name: string;
  status: "active" | "paused";
  routing_body: {
    minimum_severity: "info" | "warning" | "critical";
    source_types: Array<"connector" | "runtime" | "publish" | "risk">;
    dedupe_window_minutes: number;
  };
  delivery?: {
    webhook_url?: string;
    signing_secret?: string;
    bot_token?: string;
    chat_id?: string;
  };
}): Promise<BackendAlertChannel> {
  return putBackendData<BackendAlertChannel>(`/api/backend/alert-channels/${encodeURIComponent(channelId)}`, payload);
}

export async function deleteAlertChannel(channelId: string): Promise<{ deleted_channel_id: string; workspace_id: string }> {
  return deleteBackendData<{ deleted_channel_id: string; workspace_id: string }>(`/api/backend/alert-channels/${encodeURIComponent(channelId)}`);
}

export async function listSources(accountId: string): Promise<SourceListResponse> {
  return getBackendData<SourceListResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/sources`);
}

export async function createSource(accountId: string, payload: AddSourcePayload): Promise<BackendSource> {
  return postBackendData<BackendSource>(`/api/backend/accounts/${encodeURIComponent(accountId)}/sources`, payload);
}

export async function removeSource(sourceId: string): Promise<{ deleted: true }> {
  return deleteBackendData<{ deleted: true }>(`/api/backend/sources/${encodeURIComponent(sourceId)}`);
}

export async function pauseSource(sourceId: string): Promise<BackendSource> {
  return postBackendData<BackendSource>(`/api/backend/sources/${encodeURIComponent(sourceId)}/pause`, {});
}

export async function resumeSource(sourceId: string): Promise<BackendSource> {
  return postBackendData<BackendSource>(`/api/backend/sources/${encodeURIComponent(sourceId)}/resume`, {});
}

export async function fetchSource(sourceId: string, options?: {
  executeNow?: boolean;
}): Promise<FetchSourceResponse> {
  const suffix = options?.executeNow ? "?execute_now=1" : "";
  return postBackendData<FetchSourceResponse>(`/api/backend/sources/${encodeURIComponent(sourceId)}/fetch${suffix}`, {});
}

export async function listSourceFetchRuns(sourceId: string): Promise<SourceFetchRunListResponse> {
  return getBackendData<SourceFetchRunListResponse>(`/api/backend/sources/${encodeURIComponent(sourceId)}/fetch-runs`);
}

export async function retrySourceFetchRun(
  runId: string,
  options?: { executeNow?: boolean },
): Promise<FetchSourceResponse> {
  const suffix = options?.executeNow ? "?execute_now=1" : "";
  return postBackendData<FetchSourceResponse>(`/api/backend/source-fetch-runs/${encodeURIComponent(runId)}/retry${suffix}`, {});
}

export async function executeSourceFetchRun(runId: string): Promise<ExecuteSourceFetchRunResponse> {
  return postBackendData<ExecuteSourceFetchRunResponse>(`/api/backend/source-fetch-runs/${encodeURIComponent(runId)}/execute`, {});
}

export async function listSourceDocuments(sourceId: string): Promise<SourceDocumentListResponse> {
  return getBackendData<SourceDocumentListResponse>(`/api/backend/sources/${encodeURIComponent(sourceId)}/documents`);
}

export async function listAccountSourceDocuments(accountId: string, input?: {
  sourceId?: string;
  sourceType?: BackendSource["type"];
  sourceStatus?: BackendSource["status"];
  query?: string;
  publishedFrom?: string;
  publishedTo?: string;
  limit?: number;
}): Promise<AccountSourceDocumentListResponse> {
  return getBackendData<AccountSourceDocumentListResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/source-documents${buildQueryString({
    source_id: input?.sourceId,
    source_type: input?.sourceType,
    source_status: input?.sourceStatus,
    query: input?.query,
    published_from: input?.publishedFrom,
    published_to: input?.publishedTo,
    limit: input?.limit,
  })}`);
}

export async function refreshTrends(workspaceId: string): Promise<{ refreshed_count: number }> {
  return postBackendData<{ refreshed_count: number }>(`/api/backend/workspaces/${encodeURIComponent(workspaceId)}/trends/refresh`, {});
}

export async function listTrends(workspaceId: string): Promise<TrendListResponse> {
  return getBackendData<TrendListResponse>(`/api/backend/trends${buildQueryString({
    workspace_id: workspaceId,
  })}`);
}

export async function listContentBriefs(accountId: string, limit = 50): Promise<ContentBriefListResponse> {
  return getBackendData<ContentBriefListResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/content-briefs${buildQueryString({
    limit,
  })}`);
}

export async function listSourceWatchlists(accountId: string): Promise<SourceWatchlistListResponse> {
  return getBackendData<SourceWatchlistListResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/source-watchlists`);
}

export async function upsertSourceWatchlist(accountId: string, payload: {
  name: string;
  description?: string;
  scope_body: BackendEditorialSourceScopePreset;
  status: "active" | "paused";
}, watchlistId?: string): Promise<{ watchlist: BackendSourceWatchlist }> {
  if (watchlistId) {
    return putBackendData<{ watchlist: BackendSourceWatchlist }>(
      `/api/backend/accounts/${encodeURIComponent(accountId)}/source-watchlists/${encodeURIComponent(watchlistId)}`,
      payload,
    );
  }

  return postBackendData<{ watchlist: BackendSourceWatchlist }>(
    `/api/backend/accounts/${encodeURIComponent(accountId)}/source-watchlists`,
    payload,
  );
}

export async function deleteSourceWatchlist(accountId: string, watchlistId: string): Promise<{ deleted: true }> {
  return deleteBackendData<{ deleted: true }>(
    `/api/backend/accounts/${encodeURIComponent(accountId)}/source-watchlists/${encodeURIComponent(watchlistId)}`,
  );
}

export async function listRecurringBriefPlans(accountId: string): Promise<RecurringBriefPlanListResponse> {
  return getBackendData<RecurringBriefPlanListResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/recurring-brief-plans`);
}

export async function upsertRecurringBriefPlan(accountId: string, payload: {
  name: string;
  description?: string;
  cadence_body: {
    timezone: string;
    weekday_codes: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">;
    slot_times: string[];
    min_spacing_minutes: number;
  };
  strategy_body: {
    generation_mode: "from_trend" | "from_source_scope";
    watchlist_id?: string;
    source_scope_body?: BackendEditorialSourceScopePreset;
    default_topic_hint?: string;
    default_angle_hint?: string;
    default_audience?: string;
    campaign_queue: Array<{
      id?: string;
      title: string;
      topic_hint: string;
      angle_hint?: string;
      audience?: string;
    }>;
  };
  status: "active" | "paused";
}, planId?: string): Promise<{ plan: BackendRecurringBriefPlan }> {
  if (planId) {
    return putBackendData<{ plan: BackendRecurringBriefPlan }>(
      `/api/backend/accounts/${encodeURIComponent(accountId)}/recurring-brief-plans/${encodeURIComponent(planId)}`,
      payload,
    );
  }

  return postBackendData<{ plan: BackendRecurringBriefPlan }>(
    `/api/backend/accounts/${encodeURIComponent(accountId)}/recurring-brief-plans`,
    payload,
  );
}

export async function deleteRecurringBriefPlan(accountId: string, planId: string): Promise<{ deleted: true }> {
  return deleteBackendData<{ deleted: true }>(
    `/api/backend/accounts/${encodeURIComponent(accountId)}/recurring-brief-plans/${encodeURIComponent(planId)}`,
  );
}

export async function runRecurringBriefPlanNow(accountId: string, planId: string): Promise<RecurringBriefPlanRunNowResponse> {
  return postBackendData<RecurringBriefPlanRunNowResponse>(
    `/api/backend/accounts/${encodeURIComponent(accountId)}/recurring-brief-plans/${encodeURIComponent(planId)}/run-now`,
    {},
  );
}

export async function getBriefWorkbench(accountId: string, input?: {
  selectedBriefId?: string;
  sourceId?: string;
  sourceType?: BackendSource["type"];
  sourceStatus?: BackendSource["status"];
  query?: string;
  publishedFrom?: string;
  publishedTo?: string;
  briefLimit?: number;
  documentLimit?: number;
}): Promise<BriefWorkbenchResponse> {
  return getBackendData<BriefWorkbenchResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/brief-workbench${buildQueryString({
    selected_brief_id: input?.selectedBriefId,
    source_id: input?.sourceId,
    source_type: input?.sourceType,
    source_status: input?.sourceStatus,
    query: input?.query,
    published_from: input?.publishedFrom,
    published_to: input?.publishedTo,
    brief_limit: input?.briefLimit,
    document_limit: input?.documentLimit,
  })}`);
}

export async function getContentBrief(briefId: string): Promise<ContentBriefDetailResponse> {
  return getBackendData<ContentBriefDetailResponse>(`/api/backend/content-briefs/${encodeURIComponent(briefId)}`);
}

export async function getContentBriefEvidence(briefId: string): Promise<ContentBriefEvidenceListResponse> {
  return getBackendData<ContentBriefEvidenceListResponse>(`/api/backend/content-briefs/${encodeURIComponent(briefId)}/evidence`);
}

export async function generateContentBrief(accountId: string, payload: {
  trend_id?: string;
  source_document_ids?: string[];
  source_scope?: {
    kind: "account_active_sources";
    source_ids?: string[];
    source_types?: BackendSource["type"][];
    preferred_source_ids?: string[];
    preferred_source_types?: BackendSource["type"][];
    query?: string;
    published_from?: string;
    published_to?: string;
    limit?: number;
  };
  topic_hint?: string;
  audience?: string;
  angle_hint?: string;
}): Promise<GenerateContentBriefResponse> {
  return postBackendData<GenerateContentBriefResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/content-briefs`, payload);
}

export async function regenerateContentBrief(briefId: string): Promise<GenerateContentBriefResponse> {
  return postBackendData<GenerateContentBriefResponse>(`/api/backend/content-briefs/${encodeURIComponent(briefId)}/regenerate`, {});
}

export async function archiveContentBrief(briefId: string): Promise<BackendContentBrief> {
  return postBackendData<BackendContentBrief>(`/api/backend/content-briefs/${encodeURIComponent(briefId)}/archive`, {});
}

export async function listDrafts(input?: {
  workspaceId?: string;
  accountId?: string;
  status?: BackendDraftStatus;
  limit?: number;
}): Promise<DraftListResponse> {
  return getBackendData<DraftListResponse>(`/api/backend/drafts${buildQueryString({
    workspace_id: input?.workspaceId,
    account_id: input?.accountId,
    status: input?.status,
    limit: input?.limit,
  })}`);
}

export async function getDraftWorkbench(accountId: string, input?: {
  selectedBriefId?: string;
  draftLimit?: number;
  briefLimit?: number;
}): Promise<DraftWorkbenchResponse> {
  return getBackendData<DraftWorkbenchResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/draft-workbench${buildQueryString({
    selected_brief_id: input?.selectedBriefId,
    draft_limit: input?.draftLimit,
    brief_limit: input?.briefLimit,
  })}`);
}

export async function generateDraft(accountId: string, payload: {
  content_brief_id: string;
  trend_id?: string;
}): Promise<GenerateDraftResponse> {
  return postBackendData<GenerateDraftResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/drafts/generate`, payload);
}

export async function generateDraftFromContentBrief(briefId: string): Promise<GenerateDraftResponse> {
  return postBackendData<GenerateDraftResponse>(`/api/backend/content-briefs/${encodeURIComponent(briefId)}/drafts/generate`, {
    preview_mode: true,
  });
}

export async function generateDraftReview(draftId: string): Promise<GenerateDraftReviewResponse> {
  return postBackendData<GenerateDraftReviewResponse>(`/api/backend/drafts/${encodeURIComponent(draftId)}/review/generate`, {});
}

export async function requestDraftRegeneration(draftId: string, payload?: {
  reviewer_id?: string;
  comment?: string;
}): Promise<GenerateDraftResponse> {
  return postBackendData<GenerateDraftResponse>(`/api/backend/drafts/${encodeURIComponent(draftId)}/request-regenerate`, {
    reviewer_type: "user",
    reviewer_id: payload?.reviewer_id,
    comment: payload?.comment,
  });
}

export async function approveDraft(draftId: string, payload?: {
  reviewer_id?: string;
  comment?: string;
}): Promise<BackendDraft> {
  return postBackendData<BackendDraft>(`/api/backend/drafts/${encodeURIComponent(draftId)}/approve`, {
    reviewer_type: "user",
    reviewer_id: payload?.reviewer_id,
    comment: payload?.comment,
  });
}

export async function rejectDraft(draftId: string, payload?: {
  reviewer_id?: string;
  comment?: string;
}): Promise<BackendDraft> {
  return postBackendData<BackendDraft>(`/api/backend/drafts/${encodeURIComponent(draftId)}/reject`, {
    reviewer_type: "user",
    reviewer_id: payload?.reviewer_id,
    comment: payload?.comment,
  });
}

export async function editDraft(draftId: string, payload: {
  content: string;
  metadata?: string;
  comment?: string;
  editor_id?: string;
}): Promise<BackendDraft> {
  return putBackendData<BackendDraft>(`/api/backend/drafts/${encodeURIComponent(draftId)}`, {
    editor_type: "user",
    editor_id: payload.editor_id,
    content: payload.content,
    metadata: payload.metadata,
    comment: payload.comment,
  });
}

export async function scheduleDraft(draftId: string, scheduledFor: string): Promise<BackendPublishSchedule> {
  return postBackendData<BackendPublishSchedule>(`/api/backend/drafts/${encodeURIComponent(draftId)}/schedule`, {
    scheduled_for: scheduledFor,
  });
}

export async function queuePublishJob(scheduleId: string): Promise<BackendPublishJob> {
  return postBackendData<BackendPublishJob>(`/api/backend/schedules/${encodeURIComponent(scheduleId)}/queue`, {});
}

export async function reschedulePublishSchedule(scheduleId: string, scheduledFor: string): Promise<BackendPublishSchedule> {
  return putBackendData<BackendPublishSchedule>(`/api/backend/schedules/${encodeURIComponent(scheduleId)}`, {
    scheduled_for: scheduledFor,
  });
}

export async function cancelPublishSchedule(scheduleId: string): Promise<BackendPublishSchedule> {
  return deleteBackendData<BackendPublishSchedule>(`/api/backend/schedules/${encodeURIComponent(scheduleId)}`);
}

export async function listSchedulesInRange(input: {
  from: string;
  to: string;
  workspaceId?: string;
  accountId?: string;
  status?: BackendPublishScheduleStatus;
  limit?: number;
}): Promise<ScheduleRangeResponse> {
  return getBackendData<ScheduleRangeResponse>(`/api/backend/schedules${buildQueryString({
    from: input.from,
    to: input.to,
    workspace_id: input.workspaceId,
    account_id: input.accountId,
    status: input.status,
    limit: input.limit,
  })}`);
}

export async function listAccountEngagementThreads(accountId: string, input?: {
  channel?: BackendEngagementThread["channel"];
  classification?: BackendEngagementThread["classification"];
  status?: BackendEngagementThread["status"];
  limit?: number;
}): Promise<EngagementThreadListResponse> {
  return getBackendData<EngagementThreadListResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/engagement-threads${buildQueryString({
    channel: input?.channel,
    classification: input?.classification,
    status: input?.status,
    limit: input?.limit,
  })}`);
}

export async function getEngagementWorkbench(accountId: string, input?: {
  threadId?: string;
  channel?: BackendEngagementThread["channel"];
  classification?: BackendEngagementThread["classification"];
  status?: BackendEngagementThread["status"];
  limit?: number;
}): Promise<EngagementWorkbenchResponse> {
  return getBackendData<EngagementWorkbenchResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/engagement-workbench${buildQueryString({
    thread_id: input?.threadId,
    channel: input?.channel,
    classification: input?.classification,
    status: input?.status,
    limit: input?.limit,
  })}`);
}

export async function getEngagementPolicy(accountId: string): Promise<EngagementPolicyResponse | null> {
  const { status, result } = await requestBackendResult<EngagementPolicyResponse>(`/api/backend/engagement-policies/${encodeURIComponent(accountId)}`);

  if (!result.ok && status === 404) {
    return null;
  }

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function upsertEngagementPolicy(accountId: string, payload: {
  policy_body: {
    allowed_channels: Array<"mention" | "reply" | "dm" | "comment">;
    blocked_classifications: Array<"collab" | "commerce" | "spam" | "normal" | "support">;
    require_manual_approval: boolean;
    auto_follow?: {
      enabled: boolean;
      max_per_day: number;
      rules: Array<{ type: "keyword"; value: string }>;
    };
    auto_retweet?: {
      enabled: boolean;
      max_per_day: number;
      min_likes: number;
      whitelist: string[];
      keywords: string[];
      delay_min_minutes: number;
      delay_max_minutes: number;
      quote_tweet_enabled: boolean;
    };
    auto_comment?: {
      enabled: boolean;
      max_per_day: number;
      target_handles: string[];
      style: "supportive" | "questioning" | "value-add";
      mode: "latest" | "random";
    };
    auto_reply?: {
      enabled: boolean;
      max_per_day: number;
      trigger_types: Array<"mention" | "reply" | "dm" | "comment">;
      only_followers: boolean;
      style: "grateful" | "interactive" | "brief";
    };
  };
  status: "active" | "paused";
}): Promise<EngagementPolicyResponse> {
  return putBackendData<EngagementPolicyResponse>(`/api/backend/engagement-policies/${encodeURIComponent(accountId)}`, payload);
}

export async function getAutopostPolicy(accountId: string): Promise<AutopostPolicyResponse | null> {
  const { status, result } = await requestBackendResult<AutopostPolicyResponse>(`/api/backend/autopost-policies/${encodeURIComponent(accountId)}`);

  if (!result.ok && status === 404) {
    return null;
  }

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function upsertAutopostPolicy(accountId: string, payload: {
  cadence_body: {
    timezone: string;
    weekday_codes: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">;
    slot_times: string[];
    min_spacing_minutes: number;
  };
  content_strategy_body: {
    generation_mode: "from_trend" | "from_source_scope";
    source_types: Array<"rss" | "website" | "twitter" | "youtube" | "substack" | "telegram">;
    max_source_age_days: number;
  };
  execution_body: {
    draft_review_mode: "manual" | "auto_approve";
    auto_queue_publish: boolean;
    max_pending_manual_review_drafts?: number;
  };
  status: "active" | "paused";
}): Promise<AutopostPolicyResponse> {
  return putBackendData<AutopostPolicyResponse>(`/api/backend/autopost-policies/${encodeURIComponent(accountId)}`, payload);
}

export async function listAutopostRuns(accountId: string, limit = 20): Promise<AutopostRunListResponse> {
  return getBackendData<AutopostRunListResponse>(`/api/backend/autopost-policies/${encodeURIComponent(accountId)}/runs?limit=${encodeURIComponent(String(limit))}`);
}

export async function executeAutopostPolicy(accountId: string): Promise<AutopostRunNowResponse> {
  return postBackendData<AutopostRunNowResponse>(`/api/backend/autopost-policies/${encodeURIComponent(accountId)}/execute`, {});
}

export async function pullMentions(accountId: string): Promise<{ job_id: string; status: string }> {
  return postBackendData<{ job_id: string; status: string }>(`/api/backend/accounts/${encodeURIComponent(accountId)}/mentions/pull`, {});
}

export async function pullDirectMessages(accountId: string): Promise<{ job_id: string; status: string }> {
  return postBackendData<{ job_id: string; status: string }>(`/api/backend/accounts/${encodeURIComponent(accountId)}/direct-messages/pull`, {});
}

export async function listConnectorRequests(input: {
  workspaceId: string;
  accountId?: string;
  limit?: number;
}): Promise<ConnectorRequestsResponse> {
  return getBackendData<ConnectorRequestsResponse>(`/api/backend/connector-requests${buildQueryString({
    workspace_id: input.workspaceId,
    account_id: input.accountId,
    limit: input.limit,
  })}`);
}

export async function followAccountOnX(accountId: string, payload: {
  target_handle: string;
}): Promise<{
  connector_request_id: string;
  target_user_id: string;
  target_handle?: string;
  following: boolean;
  pending_follow?: boolean;
}> {
  return postBackendData(`/api/backend/accounts/${encodeURIComponent(accountId)}/engagement-actions/follow`, payload);
}

export async function repostPostOnX(accountId: string, payload: {
  target_post_id: string;
}): Promise<{
  connector_request_id: string;
  target_post_id: string;
  reposted: boolean;
}> {
  return postBackendData(`/api/backend/accounts/${encodeURIComponent(accountId)}/engagement-actions/repost`, payload);
}

export async function commentOnPostOnX(accountId: string, payload: {
  target_post_id: string;
  text: string;
}): Promise<{
  connector_request_id: string;
  external_comment_id: string;
  external_comment_url?: string;
}> {
  return postBackendData(`/api/backend/accounts/${encodeURIComponent(accountId)}/engagement-actions/comment`, payload);
}

export async function replyToPostOnX(accountId: string, payload: {
  target_post_id: string;
  text: string;
}): Promise<{
  connector_request_id: string;
  external_reply_id: string;
  external_reply_url?: string;
}> {
  return postBackendData(`/api/backend/accounts/${encodeURIComponent(accountId)}/engagement-actions/reply`, payload);
}

export async function lookupPostsOnX(accountId: string, payload: {
  post_ids: string[];
}): Promise<{
  posts: Array<{
    external_post_id: string;
    handle: string;
    content: string;
    occurred_at: string;
  }>;
}> {
  return postBackendData(`/api/backend/accounts/${encodeURIComponent(accountId)}/engagement-actions/posts/lookup`, payload);
}

export async function getEngagementThread(threadId: string): Promise<EngagementThreadDetailResponse> {
  return getBackendData<EngagementThreadDetailResponse>(`/api/backend/engagement-threads/${encodeURIComponent(threadId)}`);
}

export async function classifyEngagementThread(threadId: string): Promise<AgentTaskTriggerResponse> {
  return postBackendData<AgentTaskTriggerResponse>(`/api/backend/engagement-threads/${encodeURIComponent(threadId)}/classify`, {});
}

export async function listThreadReplyProposals(threadId: string): Promise<ReplyProposalListResponse> {
  return getBackendData<ReplyProposalListResponse>(`/api/backend/engagement-threads/${encodeURIComponent(threadId)}/reply-proposals`);
}

export async function generateReplyProposal(threadId: string): Promise<AgentTaskTriggerResponse> {
  return postBackendData<AgentTaskTriggerResponse>(`/api/backend/engagement-threads/${encodeURIComponent(threadId)}/reply-proposals/generate`, {});
}

export async function approveReplyProposal(proposalId: string): Promise<BackendReplyProposal> {
  return postBackendData<BackendReplyProposal>(`/api/backend/reply-proposals/${encodeURIComponent(proposalId)}/approve`, {});
}

export async function sendReplyProposal(proposalId: string): Promise<{ job_id: string; status: string }> {
  return postBackendData<{ job_id: string; status: string }>(`/api/backend/reply-proposals/${encodeURIComponent(proposalId)}/send`, {});
}

export async function getWorkerJob(jobId: string): Promise<WorkerJobDetailResponse> {
  return getBackendData<WorkerJobDetailResponse>(`/api/backend/worker-jobs/${encodeURIComponent(jobId)}`);
}

export async function retryAgentTask(taskId: string): Promise<AgentTaskTriggerResponse> {
  return postBackendData<AgentTaskTriggerResponse>(`/api/backend/agent-tasks/${encodeURIComponent(taskId)}/retry`, {});
}

export async function retryWorkerJob(jobId: string): Promise<{ job_id: string; status: string }> {
  return postBackendData<{ job_id: string; status: string }>(`/api/backend/worker-jobs/${encodeURIComponent(jobId)}/retry`, {});
}

export async function retryPublishJob(jobId: string): Promise<BackendPublishJob> {
  return postBackendData<BackendPublishJob>(`/api/backend/publish-jobs/${encodeURIComponent(jobId)}/retry`, {});
}

export async function getAgentRunTrace(runId: string): Promise<BackendAgentRunTraceResponse> {
  return getBackendData<BackendAgentRunTraceResponse>(`/api/backend/agent-runs/${encodeURIComponent(runId)}/trace`);
}
