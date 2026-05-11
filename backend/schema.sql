PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'closed')),
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_code TEXT NOT NULL CHECK (role_code IN ('owner', 'admin', 'editor', 'viewer')),
  joined_at DATETIME NOT NULL,
  PRIMARY KEY (workspace_id, user_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account_groups (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE (workspace_id, name),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  group_id TEXT,
  platform TEXT NOT NULL CHECK (platform = 'x'),
  handle TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'disabled', 'error')),
  follower_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  post_count INTEGER NOT NULL DEFAULT 0,
  external_account_id TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE (workspace_id, platform, handle),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES account_groups(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS account_credentials (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('x_oauth1', 'x_oauth2', 'api_key')),
  secret_ref TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('valid', 'invalid', 'expired', 'revoked')),
  last_validated_at DATETIME,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS credential_secrets (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('x_oauth2')),
  secret_json TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS managed_secrets (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  kind TEXT NOT NULL,
  secret_json TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS personas (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL,
  gender TEXT NOT NULL,
  nationality TEXT NOT NULL,
  age INTEGER NOT NULL,
  interests TEXT NOT NULL,
  personality_traits TEXT NOT NULL,
  writing_style TEXT NOT NULL,
  bio TEXT NOT NULL,
  distillation_sample_tweets TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual', 'template', 'distilled', 'generated')),
  created_by_type TEXT NOT NULL CHECK (created_by_type IN ('user', 'agent', 'system')),
  created_by_id TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS persona_templates (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  template_body TEXT NOT NULL,
  is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
  created_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rss', 'website', 'twitter', 'youtube', 'substack', 'telegram')),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'error')),
  last_fetched_at DATETIME,
  created_at DATETIME NOT NULL,
  UNIQUE (account_id, url),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS source_fetch_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  fetched_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  started_at DATETIME NOT NULL,
  lease_expires_at DATETIME,
  finished_at DATETIME,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS source_documents (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  external_doc_id TEXT,
  canonical_url TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body_text TEXT NOT NULL,
  language TEXT NOT NULL,
  published_at DATETIME,
  content_hash TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trends (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  cluster_key TEXT NOT NULL,
  topic TEXT NOT NULL,
  category TEXT NOT NULL,
  score REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'cooling', 'archived')),
  detected_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content_briefs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  trend_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'ready', 'failed', 'archived')),
  generation_mode TEXT NOT NULL CHECK (generation_mode IN ('from_trend', 'from_documents', 'from_source_scope')),
  topic_hint TEXT,
  topic TEXT,
  angle TEXT,
  audience TEXT,
  outline TEXT,
  source_scope TEXT,
  generated_by_run_id TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (trend_id) REFERENCES trends(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS content_brief_evidence_items (
  id TEXT PRIMARY KEY,
  brief_id TEXT NOT NULL,
  source_document_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  usage_reason TEXT NOT NULL,
  key_claims TEXT NOT NULL,
  quoted_excerpt TEXT,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (brief_id) REFERENCES content_briefs(id) ON DELETE CASCADE,
  FOREIGN KEY (source_document_id) REFERENCES source_documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  trend_id TEXT,
  current_version_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'scheduled', 'published', 'failed')),
  topic TEXT NOT NULL,
  scheduled_for DATETIME,
  generated_by_run_id TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (trend_id) REFERENCES trends(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS draft_versions (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  version_no INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT NOT NULL,
  created_by_type TEXT NOT NULL CHECK (created_by_type IN ('user', 'agent', 'system')),
  created_by_id TEXT,
  created_at DATETIME NOT NULL,
  UNIQUE (draft_id, version_no),
  FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS draft_reviews (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('user', 'agent')),
  reviewer_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'edit', 'request_regenerate')),
  comment TEXT,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS publish_schedules (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  scheduled_for DATETIME NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'queued', 'published', 'failed', 'cancelled')),
  created_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS publish_jobs (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  idempotency_key TEXT NOT NULL UNIQUE,
  error_code TEXT,
  error_message TEXT,
  run_after DATETIME NOT NULL,
  started_at DATETIME,
  lease_expires_at DATETIME,
  finished_at DATETIME,
  FOREIGN KEY (schedule_id) REFERENCES publish_schedules(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS connector_rate_limit_buckets (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform = 'x'),
  credential_id TEXT,
  account_id TEXT,
  endpoint_code TEXT NOT NULL,
  window_key TEXT NOT NULL,
  limit_count INTEGER NOT NULL,
  remaining_count INTEGER NOT NULL,
  resets_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (credential_id) REFERENCES account_credentials(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS connector_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  request_id TEXT,
  account_id TEXT NOT NULL,
  credential_id TEXT NOT NULL,
  endpoint_code TEXT NOT NULL,
  idempotency_key TEXT,
  request_payload TEXT NOT NULL,
  response_payload TEXT,
  platform_status_code TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'rate_limited')),
  error_code TEXT,
  error_message TEXT,
  started_at DATETIME NOT NULL,
  finished_at DATETIME,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (credential_id) REFERENCES account_credentials(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS published_posts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  draft_id TEXT,
  connector_request_id TEXT NOT NULL,
  external_post_id TEXT NOT NULL,
  external_post_url TEXT,
  content TEXT NOT NULL,
  published_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE SET NULL,
  FOREIGN KEY (connector_request_id) REFERENCES connector_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS engagement_policies (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL UNIQUE,
  policy_body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')),
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS autopost_policies (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL UNIQUE,
  cadence_body TEXT NOT NULL,
  content_strategy_body TEXT NOT NULL,
  execution_body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')),
  next_run_after DATETIME,
  last_attempted_at DATETIME,
  last_run_status TEXT CHECK (last_run_status IN ('succeeded', 'failed')),
  last_failed_at DATETIME,
  last_error_code TEXT,
  last_error_message TEXT,
  last_enqueued_at DATETIME,
  last_run_id TEXT,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS autopost_runs (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  generation_mode TEXT NOT NULL CHECK (generation_mode IN ('from_trend', 'from_source_scope')),
  source_scope TEXT NOT NULL,
  scheduled_for DATETIME NOT NULL,
  trend_id TEXT,
  brief_id TEXT,
  brief_task_id TEXT,
  draft_id TEXT,
  draft_task_id TEXT,
  schedule_id TEXT,
  publish_job_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'brief_generating', 'draft_generating', 'awaiting_review', 'scheduled', 'publish_queued', 'failed')),
  error_code TEXT,
  error_message TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  finished_at DATETIME,
  FOREIGN KEY (policy_id) REFERENCES autopost_policies(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (trend_id) REFERENCES trends(id) ON DELETE SET NULL,
  FOREIGN KEY (brief_id) REFERENCES content_briefs(id) ON DELETE SET NULL,
  FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE SET NULL,
  FOREIGN KEY (schedule_id) REFERENCES publish_schedules(id) ON DELETE SET NULL,
  FOREIGN KEY (publish_job_id) REFERENCES publish_jobs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS alert_channel_secrets (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('lark_webhook', 'telegram_bot')),
  secret_json TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_channels (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('lark_webhook', 'telegram_bot')),
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')),
  secret_ref TEXT NOT NULL,
  destination_hint TEXT NOT NULL,
  routing_body TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS engagement_threads (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('mention', 'reply', 'dm', 'comment')),
  external_thread_id TEXT NOT NULL,
  counterpart_handle TEXT,
  classification TEXT NOT NULL CHECK (classification IN ('collab', 'commerce', 'spam', 'normal', 'support')),
  status TEXT NOT NULL CHECK (status IN ('open', 'pending_action', 'closed', 'ignored')),
  last_message_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS engagement_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  external_message_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  sender_handle TEXT,
  content TEXT NOT NULL,
  raw_payload TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES engagement_threads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS engagement_reply_proposals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  agent_task_id TEXT NOT NULL,
  agent_run_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_review', 'approved', 'rejected', 'sent')),
  content TEXT NOT NULL,
  rationale TEXT NOT NULL,
  connector_request_id TEXT,
  external_reply_id TEXT,
  created_at DATETIME NOT NULL,
  reviewed_at DATETIME,
  sent_at DATETIME,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (thread_id) REFERENCES engagement_threads(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (connector_request_id) REFERENCES connector_requests(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS account_orchestration_states (
  account_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')),
  next_tick_after DATETIME,
  last_tick_at DATETIME,
  active_run_id TEXT,
  last_decision_type TEXT,
  last_reason_code TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orchestration_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('manual', 'content_task_follow_up', 'draft_review_follow_up', 'system')),
  eligible_actions_json TEXT NOT NULL,
  chosen_action_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  error_code TEXT,
  error_message TEXT,
  created_at DATETIME NOT NULL,
  finished_at DATETIME,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS worker_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('mentions.pull', 'dm.pull', 'engagement.reply.execute', 'editorial.recurring_brief.execute', 'autopost.execute', 'orchestration.tick')),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  run_after DATETIME NOT NULL,
  lease_expires_at DATETIME,
  error_code TEXT,
  error_message TEXT,
  started_at DATETIME,
  finished_at DATETIME,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS source_watchlists (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  scope_body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')),
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE (account_id, name),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recurring_brief_plans (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cadence_body TEXT NOT NULL,
  strategy_body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused')),
  next_run_after DATETIME,
  last_attempted_at DATETIME,
  last_run_status TEXT CHECK (last_run_status IN ('succeeded', 'failed')),
  last_failed_at DATETIME,
  last_error_code TEXT,
  last_error_message TEXT,
  last_enqueued_at DATETIME,
  last_brief_id TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE (account_id, name),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (last_brief_id) REFERENCES content_briefs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('post', 'message', 'health', 'action', 'engagement')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  read_at DATETIME,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  request_id TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  source_type TEXT NOT NULL CHECK (source_type IN ('connector', 'runtime', 'publish', 'risk')),
  source_id TEXT NOT NULL,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  payload TEXT,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS health_scores (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  computed_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS health_score_factors (
  id TEXT PRIMARY KEY,
  health_score_id TEXT NOT NULL,
  factor_code TEXT NOT NULL,
  contribution INTEGER NOT NULL,
  description TEXT NOT NULL,
  FOREIGN KEY (health_score_id) REFERENCES health_scores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS risk_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_definitions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  input_schema TEXT NOT NULL,
  output_schema TEXT NOT NULL,
  tool_policy TEXT NOT NULL,
  is_active INTEGER NOT NULL CHECK (is_active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  agent_definition_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  error_code TEXT,
  error_message TEXT,
  started_at DATETIME,
  lease_expires_at DATETIME,
  finished_at DATETIME,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_definition_id) REFERENCES agent_definitions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  request_id TEXT,
  run_no INTEGER NOT NULL,
  model_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  output TEXT,
  error_code TEXT,
  error_message TEXT,
  started_at DATETIME NOT NULL,
  finished_at DATETIME,
  FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS runtime_processes (
  id TEXT PRIMARY KEY,
  process_type TEXT NOT NULL CHECK (process_type IN ('http_server', 'worker')),
  process_name TEXT NOT NULL,
  pid INTEGER NOT NULL,
  hostname TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'stopped')),
  metadata_json TEXT NOT NULL,
  started_at DATETIME NOT NULL,
  last_heartbeat_at DATETIME NOT NULL,
  stopped_at DATETIME
);

CREATE TABLE IF NOT EXISTS runtime_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  request_id TEXT,
  process_id TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  event_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  message TEXT NOT NULL,
  payload_json TEXT,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
  FOREIGN KEY (process_id) REFERENCES runtime_processes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,
  agent_run_id TEXT NOT NULL,
  request_id TEXT,
  tool_name TEXT NOT NULL,
  request_payload TEXT NOT NULL,
  response_payload TEXT,
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed')),
  started_at DATETIME NOT NULL,
  finished_at DATETIME,
  FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS model_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  request_id TEXT,
  agent_run_id TEXT,
  provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  request_schema_version TEXT NOT NULL,
  prompt_artifact_ref TEXT,
  tool_spec_ref TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'invalid_output')),
  started_at DATETIME NOT NULL,
  finished_at DATETIME,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS model_request_attempts (
  id TEXT PRIMARY KEY,
  model_request_id TEXT NOT NULL,
  attempt_no INTEGER NOT NULL,
  provider_request_id TEXT,
  raw_response_ref TEXT,
  parsed_output TEXT,
  validation_error TEXT,
  error_code TEXT,
  error_message TEXT,
  started_at DATETIME NOT NULL,
  finished_at DATETIME,
  FOREIGN KEY (model_request_id) REFERENCES model_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  request_id TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'agent', 'system')),
  actor_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_state TEXT,
  after_state TEXT,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_accounts_workspace_handle ON accounts (workspace_id, handle);
CREATE INDEX IF NOT EXISTS idx_accounts_workspace_display_name ON accounts (workspace_id, display_name);
CREATE INDEX IF NOT EXISTS idx_account_groups_workspace_name ON account_groups (workspace_id, name);
CREATE INDEX IF NOT EXISTS idx_personas_account_id ON personas (account_id);
CREATE INDEX IF NOT EXISTS idx_sources_account_status ON sources (account_id, status);
CREATE INDEX IF NOT EXISTS idx_source_documents_workspace_published_at ON source_documents (workspace_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_drafts_workspace_status_created_at ON drafts (workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drafts_account_status_updated_at ON drafts (account_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_drafts_workspace_updated_at ON drafts (workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_publish_schedules_account_scheduled_for ON publish_schedules (account_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_publish_schedules_account_status_scheduled_for ON publish_schedules (account_id, status, scheduled_for DESC);
CREATE INDEX IF NOT EXISTS idx_publish_schedules_workspace_scheduled_for ON publish_schedules (workspace_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_content_briefs_account_status_updated_at ON content_briefs (account_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_briefs_workspace_status_updated_at ON content_briefs (workspace_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_briefs_account_updated_at ON content_briefs (account_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_threads_account_last_message_at ON engagement_threads (account_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_messages_thread_created_at ON engagement_messages (thread_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_engagement_messages_thread_external_message_id
  ON engagement_messages (thread_id, external_message_id)
  ;
CREATE INDEX IF NOT EXISTS idx_engagement_reply_proposals_thread_created_at ON engagement_reply_proposals (thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_reply_proposals_status_created_at ON engagement_reply_proposals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_channels_workspace_status_updated_at ON alert_channels (workspace_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_channels_workspace_kind_updated_at ON alert_channels (workspace_id, kind, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace_created_at ON notifications (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace_read_created_at ON notifications (workspace_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members (workspace_id);
CREATE INDEX IF NOT EXISTS idx_connector_requests_request_id ON connector_requests (request_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_connector_requests_account_endpoint_idempotency
  ON connector_requests (account_id, endpoint_code, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_workspace_created_at ON alerts (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_request_id ON alerts (request_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_account_created_at ON risk_events (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_workspace_status_created_at ON agent_tasks (workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status_created_at ON agent_tasks (status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_workspace_created_at ON agent_tasks (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_request_id ON agent_runs (request_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_task_run_no ON agent_runs (task_id, run_no DESC);
CREATE INDEX IF NOT EXISTS idx_managed_secrets_namespace_kind ON managed_secrets (namespace, kind);
CREATE INDEX IF NOT EXISTS idx_runtime_processes_type_status_heartbeat ON runtime_processes (process_type, status, last_heartbeat_at DESC);
CREATE INDEX IF NOT EXISTS idx_runtime_processes_status_heartbeat ON runtime_processes (status, last_heartbeat_at DESC);
CREATE INDEX IF NOT EXISTS idx_runtime_events_created_at ON runtime_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runtime_events_severity_created_at ON runtime_events (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runtime_events_process_created_at ON runtime_events (process_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runtime_events_workspace_created_at ON runtime_events (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_calls_request_id ON tool_calls (request_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_agent_run_started_at ON tool_calls (agent_run_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_requests_request_id ON model_requests (request_id);
CREATE INDEX IF NOT EXISTS idx_model_requests_agent_run_started_at ON model_requests (agent_run_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_entity_created_at ON audit_logs (workspace_id, entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs (request_id);
CREATE INDEX IF NOT EXISTS idx_source_fetch_runs_status_started_at ON source_fetch_runs (status, started_at ASC);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_status_run_after ON publish_jobs (status, run_after ASC);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_schedule_run_after ON publish_jobs (schedule_id, run_after DESC);
CREATE INDEX IF NOT EXISTS idx_worker_jobs_status_run_after ON worker_jobs (status, run_after ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_jobs_orchestration_queued_target
  ON worker_jobs (job_type, target_type, target_id)
  WHERE job_type = 'orchestration.tick' AND status = 'queued';
CREATE INDEX IF NOT EXISTS idx_account_orchestration_states_status_next_tick_after
  ON account_orchestration_states (status, next_tick_after ASC);
CREATE INDEX IF NOT EXISTS idx_orchestration_runs_account_created_at
  ON orchestration_runs (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_autopost_policies_status_next_run_after ON autopost_policies (status, next_run_after ASC);
CREATE INDEX IF NOT EXISTS idx_autopost_runs_account_created_at ON autopost_runs (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_autopost_runs_policy_created_at ON autopost_runs (policy_id, created_at DESC);
