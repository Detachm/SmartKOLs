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

export interface AccountAutomationActionPreview {
  type:
    | "draft.generate.from_brief"
    | "brief.generate.from_recurring_plan"
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
}

export interface AccountAutomationNoActionPreview {
  type: "no_action";
  reason_code:
    | "automation_inactive"
    | "automation_paused"
    | "content_task_running"
    | "awaiting_draft_review"
    | "waiting_for_next_due_window"
    | "no_eligible_actions"
    | "tick_failed";
  rationale: string;
}

export interface AccountAutomationOverviewResponse {
  account_id: string;
  workspace_id: string;
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
  recent_runs: Array<{
    run_id: string;
    trigger_kind: "manual" | "content_task_follow_up" | "draft_review_follow_up" | "system";
    status: "running" | "succeeded" | "failed";
    created_at: string;
    finished_at?: string;
    chosen_action?: AccountAutomationActionPreview | AccountAutomationNoActionPreview;
    eligible_actions: AccountAutomationActionPreview[];
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
  kind: "agent_task" | "worker_job" | "publish_job" | "source_fetch_run";
  id: string;
  workspace_id: string;
  status: "queued" | "running" | "failed" | "cancelled";
  title: string;
  subtitle: string;
  account_id?: string;
  error_code?: string;
  error_message?: string;
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
  };
  kinds: Array<{
    kind: BackendMonitoringOperatorQueueItem["kind"];
    matched_failed_count: number;
    retried_count: number;
    failed_count: number;
  }>;
  attempts: Array<{
    kind: BackendMonitoringOperatorQueueItem["kind"];
    source_id: string;
    retried_id?: string;
    status: "retried" | "failed";
    error_code?: string;
    error_message?: string;
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
    topic: string;
    category: string;
    score: number;
    status: "active" | "cooling" | "archived";
    detected_at: string;
    updated_at: string;
  }>;
  notifications: BackendNotification[];
}

export interface BackendTrend {
  id: string;
  workspace_id: string;
  topic: string;
  category: string;
  score: number;
  status: "active" | "cooling" | "archived";
  detected_at: string;
  updated_at: string;
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
  return getBackendData<AccountListResponse>(`/api/backend/accounts${buildQueryString({ workspace_id: workspaceId })}`);
}

export async function getAccountsControlPlane(): Promise<AccountsControlPlaneResponse> {
  return getBackendData<AccountsControlPlaneResponse>("/api/backend/accounts/control-plane");
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

export async function getAccountSurface(accountId: string): Promise<AccountSurfaceResponse> {
  return getBackendData<AccountSurfaceResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/surface`);
}

export async function getAccountAutomationOverview(accountId: string): Promise<AccountAutomationOverviewResponse> {
  return getBackendData<AccountAutomationOverviewResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/automation-overview`);
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
  return getBackendData<DashboardOverviewResponse>(`/api/backend/dashboard/overview${buildQueryString({
    workspace_id: workspaceId,
  })}`);
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
}): Promise<RetryMonitoringQueueBacklogResponse> {
  return postBackendData<RetryMonitoringQueueBacklogResponse>("/api/backend/monitoring/queues/retry", payload);
}

export async function getAccountAnalytics(accountId: string, windowDays = 30): Promise<AccountAnalyticsResponse> {
  return getBackendData<AccountAnalyticsResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/analytics${buildQueryString({
    window_days: windowDays,
  })}`);
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

export async function fetchSource(sourceId: string): Promise<FetchSourceResponse> {
  return postBackendData<FetchSourceResponse>(`/api/backend/sources/${encodeURIComponent(sourceId)}/fetch`, {});
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
  topic?: string;
  trend_id?: string;
  content_brief_id?: string;
}): Promise<GenerateDraftResponse> {
  return postBackendData<GenerateDraftResponse>(`/api/backend/accounts/${encodeURIComponent(accountId)}/drafts/generate`, payload);
}

export async function generateDraftFromContentBrief(briefId: string): Promise<GenerateDraftResponse> {
  return postBackendData<GenerateDraftResponse>(`/api/backend/content-briefs/${encodeURIComponent(briefId)}/drafts/generate`, {});
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
