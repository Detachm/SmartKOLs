import { systemClock } from "../../core/time/clock";
import { RequestContextStore } from "../../core/request-context/request-context";
import { CreateAccount } from "../../modules/accounts/application/commands/create-account";
import { CreateAccountGroup } from "../../modules/accounts/application/commands/create-account-group";
import { AssignAccountsToGroup } from "../../modules/accounts/application/commands/assign-accounts-to-group";
import { DeleteAccount } from "../../modules/accounts/application/commands/delete-account";
import { ImportAccounts } from "../../modules/accounts/application/commands/import-accounts";
import { UpdatePersona } from "../../modules/personas/application/commands/update-persona";
import { DistillPersona } from "../../modules/personas/application/commands/distill-persona";
import { GetPersona } from "../../modules/personas/application/queries/get-persona";
import { CreatePersonaTemplate } from "../../modules/personas/application/commands/create-persona-template";
import { ApplyPersonaTemplate } from "../../modules/personas/application/commands/apply-persona-template";
import { ListPersonaTemplates } from "../../modules/personas/application/queries/list-persona-templates";
import { UpsertAutopostPolicy } from "../../modules/autopost/application/commands/upsert-autopost-policy";
import { ContinueAutopostRunFromBrief } from "../../modules/autopost/application/commands/continue-autopost-run-from-brief";
import { ExecuteAutopostPolicy } from "../../modules/autopost/application/commands/execute-autopost-policy";
import { FailAutopostRun } from "../../modules/autopost/application/commands/fail-autopost-run";
import { FinalizeAutopostRun } from "../../modules/autopost/application/commands/finalize-autopost-run";
import { GetAutopostPolicy } from "../../modules/autopost/application/queries/get-autopost-policy";
import { ListAutopostRuns } from "../../modules/autopost/application/queries/list-autopost-runs";
import { ApproveDraft } from "../../modules/drafts/application/commands/approve-draft";
import { RequestDraftRegeneration } from "../../modules/drafts/application/commands/request-draft-regeneration";
import { CreateAlertChannel } from "../../modules/alert-channels/application/commands/create-alert-channel";
import { UpdateAlertChannel } from "../../modules/alert-channels/application/commands/update-alert-channel";
import { DeleteAlertChannel } from "../../modules/alert-channels/application/commands/delete-alert-channel";
import { ListAlertChannels } from "../../modules/alert-channels/application/queries/list-alert-channels";
import { SqliteAuditLogRepository } from "../../modules/audit/infrastructure/sqlite-audit-log-repository";
import { SqliteAccountsRepository } from "../../modules/accounts/infrastructure/sqlite-accounts-repository";
import { SqliteAccountGroupsRepository } from "../../modules/accounts/infrastructure/sqlite-account-groups-repository";
import { SqliteAccountDeletionGuard } from "../../modules/accounts/infrastructure/sqlite-account-deletion-guard";
import { SqliteAccountImportWriteTransaction } from "../../modules/accounts/infrastructure/sqlite-account-import-write-transaction";
import { SqliteAutopostPoliciesRepository } from "../../modules/autopost/infrastructure/sqlite-autopost-policies-repository";
import { SqliteAutopostRunsRepository } from "../../modules/autopost/infrastructure/sqlite-autopost-runs-repository";
import { SqlitePersonasRepository } from "../../modules/personas/infrastructure/sqlite-personas-repository";
import { SqlitePersonaTemplatesRepository } from "../../modules/personas/infrastructure/sqlite-persona-templates-repository";
import { SqlitePersonaTemplateWriteTransaction } from "../../modules/personas/infrastructure/sqlite-persona-template-write-transaction";
import { SqliteDraftsRepository } from "../../modules/drafts/infrastructure/sqlite-drafts-repository";
import { SqliteDraftVersionRepository } from "../../modules/drafts/infrastructure/sqlite-draft-version-repository";
import { SqliteWorkspacesRepository } from "../../modules/workspaces/infrastructure/sqlite-workspaces-repository";
import { EditDraft } from "../../modules/drafts/application/commands/edit-draft";
import { RejectDraft } from "../../modules/drafts/application/commands/reject-draft";
import { GenerateDraft } from "../../modules/drafts/application/commands/generate-draft";
import { GenerateDraftFromContentBrief } from "../../modules/drafts/application/commands/generate-draft-from-content-brief";
import { GenerateDraftReview } from "../../modules/drafts/application/commands/generate-draft-review";
import { QueueAccountAutomationTick } from "../../modules/orchestration/application/commands/queue-account-automation-tick";
import { PauseAccountAutomation } from "../../modules/orchestration/application/commands/pause-account-automation";
import { ResumeAccountAutomation } from "../../modules/orchestration/application/commands/resume-account-automation";
import { TickAccountAutomation } from "../../modules/orchestration/application/commands/tick-account-automation";
import { GetAccountAutomationOverview } from "../../modules/orchestration/application/queries/get-account-automation-overview";
import { ApplyOrchestrationDecision } from "../../modules/orchestration/application/services/apply-orchestration-decision";
import { ChiefOrchestrator } from "../../modules/orchestration/application/services/chief-orchestrator";
import { EvaluateAccountEligibility } from "../../modules/orchestration/application/services/evaluate-account-eligibility";
import { createSqliteRuntime } from "../../infrastructure/db/sqlite-runtime";
import { CreateWorkspace } from "../../modules/workspaces/application/commands/create-workspace";
import { UpdateWorkspace } from "../../modules/workspaces/application/commands/update-workspace";
import { AddWorkspaceMember } from "../../modules/workspaces/application/commands/add-workspace-member";
import { UpdateWorkspaceMemberRole } from "../../modules/workspaces/application/commands/update-workspace-member-role";
import { RemoveWorkspaceMember } from "../../modules/workspaces/application/commands/remove-workspace-member";
import { ListWorkspaces } from "../../modules/workspaces/application/queries/list-workspaces";
import { GetWorkspaceSettingsOverview } from "../../modules/workspaces/application/queries/get-workspace-settings-overview";
import { GetWorkspaceSurface } from "../../modules/workspaces/application/queries/get-workspace-surface";
import { SqliteSchedulesRepository } from "../../modules/schedules/infrastructure/sqlite-schedules-repository";
import { ScheduleDraft } from "../../modules/schedules/application/commands/schedule-draft";
import { QueuePublishJob } from "../../modules/schedules/application/commands/queue-publish-job";
import { ReschedulePublishSchedule } from "../../modules/schedules/application/commands/reschedule-publish-schedule";
import { CancelPublishSchedule } from "../../modules/schedules/application/commands/cancel-publish-schedule";
import { MarkPublishSucceeded } from "../../modules/schedules/application/commands/mark-publish-succeeded";
import { MarkPublishFailed } from "../../modules/schedules/application/commands/mark-publish-failed";
import { CompletePublishJob } from "../../modules/schedules/application/commands/complete-publish-job";
import { SqliteAccountCredentialsRepository } from "../../modules/connector-x/infrastructure/sqlite-account-credentials-repository";
import { ValidateAccountCredential } from "../../modules/connector-x/application/commands/validate-account-credential";
import { UpsertAccountCredential } from "../../modules/connector-x/application/commands/upsert-account-credential";
import { SqliteCredentialSecretStore } from "../../modules/connector-x/infrastructure/sqlite-credential-secret-store";
import { GetAccountProfile } from "../../modules/connector-x/application/commands/get-account-profile";
import { SqliteConnectorRequestRepository } from "../../modules/connector-x/infrastructure/sqlite-connector-request-repository";
import { SqliteRateLimitBucketsRepository } from "../../modules/connector-x/infrastructure/sqlite-rate-limit-buckets-repository";
import { SqliteEngagementRepository } from "../../modules/engagement/infrastructure/sqlite-engagement-repository";
import { SqliteEngagementPoliciesRepository } from "../../modules/engagement/infrastructure/sqlite-engagement-policies-repository";
import { CreatePost } from "../../modules/connector-x/application/commands/create-post";
import { PullMentions } from "../../modules/connector-x/application/commands/pull-mentions";
import { PullDirectMessages } from "../../modules/connector-x/application/commands/pull-direct-messages";
import { ReplyToPost } from "../../modules/connector-x/application/commands/reply-to-post";
import { SendDirectMessage } from "../../modules/connector-x/application/commands/send-direct-message";
import { ExecutePublishJob } from "../../modules/schedules/application/commands/execute-publish-job";
import { RetryPublishJob } from "../../modules/schedules/application/commands/retry-publish-job";
import { SqliteAgentRuntimeRepository } from "../../modules/agent-runtime/infrastructure/sqlite-agent-runtime-repository";
import { ClassifyInboxThread } from "../../modules/agent-runtime/application/commands/classify-inbox-thread";
import { seedAgentDefinitions } from "./seed-agent-definitions";
import { GetEngagementThread } from "../../modules/engagement/application/queries/get-engagement-thread";
import { ListEngagementMessages } from "../../modules/engagement/application/queries/list-engagement-messages";
import { ListAccountEngagementThreads } from "../../modules/engagement/application/queries/list-account-engagement-threads";
import { GetAgentTask } from "../../modules/agent-runtime/application/queries/get-agent-task";
import { GetAgentRun } from "../../modules/agent-runtime/application/queries/get-agent-run";
import { GetAgentRunTrace } from "../../modules/agent-runtime/application/queries/get-agent-run-trace";
import { RunAgentTask } from "../../modules/agent-runtime/application/commands/run-agent-task";
import { RetryAgentTask } from "../../modules/agent-runtime/application/commands/retry-agent-task";
import { GenerateReplyProposal } from "../../modules/engagement/application/commands/generate-reply-proposal";
import { ApproveReplyProposal } from "../../modules/engagement/application/commands/approve-reply-proposal";
import { SendReplyProposal } from "../../modules/engagement/application/commands/send-reply-proposal";
import { GetReplyProposal } from "../../modules/engagement/application/queries/get-reply-proposal";
import { ListThreadReplyProposals } from "../../modules/engagement/application/queries/list-thread-reply-proposals";
import { GetDraftDetail } from "../../modules/drafts/application/queries/get-draft-detail";
import { ListDraftReviews } from "../../modules/drafts/application/queries/list-draft-reviews";
import { ListDrafts } from "../../modules/drafts/application/queries/list-drafts";
import { SqliteSourcesRepository } from "../../modules/sources/infrastructure/sqlite-sources-repository";
import { SqliteAccountSourceDocumentReadModel } from "../../modules/sources/infrastructure/sqlite-account-source-document-read-model";
import { SqliteTrendsRepository } from "../../modules/trends/infrastructure/sqlite-trends-repository";
import { AddSource } from "../../modules/sources/application/commands/add-source";
import { RemoveSource } from "../../modules/sources/application/commands/remove-source";
import { PauseSource } from "../../modules/sources/application/commands/pause-source";
import { ResumeSource } from "../../modules/sources/application/commands/resume-source";
import { IngestSourceDocuments } from "../../modules/sources/application/commands/ingest-source-documents";
import { FetchSource } from "../../modules/sources/application/commands/fetch-source";
import { ExecuteSourceFetchRun } from "../../modules/sources/application/commands/execute-source-fetch-run";
import { RetrySourceFetchRun } from "../../modules/sources/application/commands/retry-source-fetch-run";
import { ListSources } from "../../modules/sources/application/queries/list-sources";
import { ListAccountSourceDocuments } from "../../modules/sources/application/queries/list-account-source-documents";
import { ListSourceDocuments } from "../../modules/sources/application/queries/list-source-documents";
import { ListSourceFetchRuns } from "../../modules/sources/application/queries/list-source-fetch-runs";
import { RefreshTrends } from "../../modules/trends/application/commands/refresh-trends";
import { ListTrends } from "../../modules/trends/application/queries/list-trends";
import { UpsertEngagementPolicy } from "../../modules/engagement/application/commands/upsert-engagement-policy";
import { GetEngagementPolicy } from "../../modules/engagement/application/queries/get-engagement-policy";
import type { SourceFetcher } from "../../modules/sources/application/ports/source-fetcher";
import type { SourceFetchAdapter } from "../../modules/sources/application/ports/source-fetch-adapter";
import type { ModelGateway } from "../../modules/agent-runtime/application/ports/model-gateway";
import { SqliteNotificationsRepository } from "../../modules/notifications/infrastructure/sqlite-notifications-repository";
import { SqliteHealthScoresRepository } from "../../modules/health/infrastructure/sqlite-health-scores-repository";
import { ListNotifications } from "../../modules/notifications/application/queries/list-notifications";
import { GetAccountHealthScore } from "../../modules/health/application/queries/get-account-health-score";
import { SqliteAlertsRepository } from "../../modules/monitoring/infrastructure/sqlite-alerts-repository";
import { SqliteHealthScoreFactorsRepository } from "../../modules/health/infrastructure/sqlite-health-score-factors-repository";
import { SqliteRiskEventsRepository } from "../../modules/risk/infrastructure/sqlite-risk-events-repository";
import { GenerateRiskEvents } from "../../modules/risk/application/commands/generate-risk-events";
import { ComputeAccountHealthScore } from "../../modules/health/application/commands/compute-account-health-score";
import { GetAccountHealthFactors } from "../../modules/health/application/queries/get-account-health-factors";
import { GetMonitoringFeed } from "../../modules/monitoring/application/queries/get-monitoring-feed";
import { ListConnectorRequests } from "../../modules/connector-x/application/queries/list-connector-requests";
import { ListModelRequests } from "../../modules/agent-runtime/application/queries/list-model-requests";
import { ListAuditLogs } from "../../modules/audit/application/queries/list-audit-logs";
import { SqlitePublishWriteTransaction } from "../../modules/schedules/infrastructure/sqlite-publish-write-transaction";
import { ListSchedulesInRange } from "../../modules/schedules/application/queries/list-schedules-in-range";
import type { ArtifactStore } from "../../core/artifacts/artifact-store";
import { RegistrySourceFetcher } from "../../modules/sources/infrastructure/registry-source-fetcher";
import { SqliteWorkerJobsRepository } from "../../modules/execution/infrastructure/sqlite-worker-jobs-repository";
import { QueuePullMentionsJob } from "../../modules/execution/application/commands/queue-pull-mentions-job";
import { QueuePullDirectMessagesJob } from "../../modules/execution/application/commands/queue-pull-direct-messages-job";
import { QueueSendReplyProposalJob } from "../../modules/execution/application/commands/queue-send-reply-proposal-job";
import { FailWorkerJob } from "../../modules/execution/application/commands/fail-worker-job";
import { RetryWorkerJob } from "../../modules/execution/application/commands/retry-worker-job";
import { RunWorkerJob } from "../../modules/execution/application/commands/run-worker-job";
import { GetWorkerJob } from "../../modules/execution/application/queries/get-worker-job";
import { ExpireAgentTaskLease } from "../../modules/agent-runtime/application/commands/expire-agent-task-lease";
import { ExpireSourceFetchRunLease } from "../../modules/sources/application/commands/expire-source-fetch-run-lease";
import type { BackendConfig } from "./load-backend-config";
import { XApiClient } from "../../modules/connector-x/infrastructure/x-api-client";
import { XApiCredentialValidator } from "../../modules/connector-x/infrastructure/x-api-credential-validator";
import { XApiTwitterClient } from "../../modules/connector-x/infrastructure/x-api-twitter-client";
import { ListAccounts } from "../../modules/accounts/application/queries/list-accounts";
import { ListAccountGroups } from "../../modules/accounts/application/queries/list-account-groups";
import { GetAccountSurface } from "../../modules/accounts/application/queries/get-account-surface";
import { GetAccountsControlPlane } from "../../modules/accounts/application/queries/get-accounts-control-plane";
import { BootstrapLocalSession } from "../../modules/users/application/commands/bootstrap-local-session";
import { GetUserSessionContext } from "../../modules/users/application/queries/get-user-session-context";
import { SqliteUsersRepository } from "../../modules/users/infrastructure/sqlite-users-repository";
import { SqliteAccountSurfaceReadModel } from "../../modules/accounts/infrastructure/sqlite-account-surface-read-model";
import { SqliteAccountsControlPlaneReadModel } from "../../modules/accounts/infrastructure/sqlite-accounts-control-plane-read-model";
import { SqliteDraftListReadModel } from "../../modules/drafts/infrastructure/sqlite-draft-list-read-model";
import { SqliteScheduleCalendarReadModel } from "../../modules/schedules/infrastructure/sqlite-schedule-calendar-read-model";
import { SqliteAccountAutomationOverviewReadModel } from "../../modules/orchestration/infrastructure/sqlite-account-automation-overview-read-model";
import { SqliteAccountOrchestrationStatesRepository } from "../../modules/orchestration/infrastructure/sqlite-account-orchestration-states-repository";
import { SqliteOrchestrationRunsRepository } from "../../modules/orchestration/infrastructure/sqlite-orchestration-runs-repository";
import { GetMonitoringOverview } from "../../modules/monitoring/application/queries/get-monitoring-overview";
import { RetryMonitoringQueueBacklog } from "../../modules/monitoring/application/commands/retry-monitoring-queue-backlog";
import { SqliteMonitoringAgentTraceReadModel } from "../../modules/monitoring/infrastructure/sqlite-monitoring-agent-trace-read-model";
import { SqliteMonitoringOperatorQueueReadModel } from "../../modules/monitoring/infrastructure/sqlite-monitoring-operator-queue-read-model";
import { SqliteEngagementThreadListReadModel } from "../../modules/engagement/infrastructure/sqlite-engagement-thread-list-read-model";
import { GetDashboardOverview } from "../../modules/dashboard/application/queries/get-dashboard-overview";
import { SqliteDashboardOverviewReadModel } from "../../modules/dashboard/infrastructure/sqlite-dashboard-overview-read-model";
import { GetAppChromeOverview } from "../../modules/app-chrome/application/queries/get-app-chrome-overview";
import { SearchAppCommandTargets } from "../../modules/app-chrome/application/queries/search-app-command-targets";
import { SqliteAppChromeOverviewReadModel } from "../../modules/app-chrome/infrastructure/sqlite-app-chrome-overview-read-model";
import { SqliteAppCommandSearchReadModel } from "../../modules/app-chrome/infrastructure/sqlite-app-command-search-read-model";
import { GetAccountAnalytics } from "../../modules/analytics/application/queries/get-account-analytics";
import { SqliteAccountAnalyticsReadModel } from "../../modules/analytics/infrastructure/sqlite-account-analytics-read-model";
import { SqliteContentBriefsRepository } from "../../modules/content-briefs/infrastructure/sqlite-content-briefs-repository";
import { SqliteAlertChannelsRepository } from "../../modules/alert-channels/infrastructure/sqlite-alert-channels-repository";
import { SqliteAlertChannelSecretStore } from "../../modules/alert-channels/infrastructure/sqlite-alert-channel-secret-store";
import { SqliteManagedSecretVault } from "../../modules/secrets/infrastructure/sqlite-managed-secret-vault";
import { SqliteOperationsOverviewReadModel } from "../../modules/operations/infrastructure/sqlite-operations-overview-read-model";
import { SqliteRuntimeProcessesRepository } from "../../modules/operations/infrastructure/sqlite-runtime-processes-repository";
import { GetOperationsOverview } from "../../modules/operations/application/queries/get-operations-overview";
import { GetOperationsHealth } from "../../modules/operations/application/queries/get-operations-health";
import { CleanupStaleRuntimeProcesses } from "../../modules/operations/application/commands/cleanup-stale-runtime-processes";
import { GenerateContentBrief } from "../../modules/content-briefs/application/commands/generate-content-brief";
import { ArchiveContentBrief } from "../../modules/content-briefs/application/commands/archive-content-brief";
import { RegenerateContentBrief } from "../../modules/content-briefs/application/commands/regenerate-content-brief";
import { ListContentBriefs } from "../../modules/content-briefs/application/queries/list-content-briefs";
import { GetContentBrief } from "../../modules/content-briefs/application/queries/get-content-brief";
import { GetContentBriefEvidence } from "../../modules/content-briefs/application/queries/get-content-brief-evidence";
import { GetBriefWorkbench } from "../../modules/content-briefs/application/queries/get-brief-workbench";
import { UpsertSourceWatchlist } from "../../modules/editorial/application/commands/upsert-source-watchlist";
import { RemoveSourceWatchlist } from "../../modules/editorial/application/commands/remove-source-watchlist";
import { UpsertRecurringBriefPlan } from "../../modules/editorial/application/commands/upsert-recurring-brief-plan";
import { RemoveRecurringBriefPlan } from "../../modules/editorial/application/commands/remove-recurring-brief-plan";
import { ExecuteRecurringBriefPlan } from "../../modules/editorial/application/commands/execute-recurring-brief-plan";
import { FailRecurringBriefPlanExecution } from "../../modules/editorial/application/commands/fail-recurring-brief-plan-execution";
import { ListSourceWatchlists } from "../../modules/editorial/application/queries/list-source-watchlists";
import { ListRecurringBriefPlans } from "../../modules/editorial/application/queries/list-recurring-brief-plans";
import { SqliteSourceWatchlistsRepository } from "../../modules/editorial/infrastructure/sqlite-source-watchlists-repository";
import { SqliteRecurringBriefPlansRepository } from "../../modules/editorial/infrastructure/sqlite-recurring-brief-plans-repository";
import { seedPersonaTemplates } from "./seed-persona-templates";
import { SqliteWorkspaceMembersRepository } from "../../modules/workspaces/infrastructure/sqlite-workspace-members-repository";
import { SqliteWorkspaceSurfaceReadModel } from "../../modules/workspaces/infrastructure/sqlite-workspace-surface-read-model";
import { GetDraftWorkbench } from "../../modules/drafts/application/queries/get-draft-workbench";
import { GetEngagementWorkbench } from "../../modules/engagement/application/queries/get-engagement-workbench";

export interface AppContext {
  sqlite: ReturnType<typeof createSqliteRuntime>;
  requestContext: RequestContextStore;
  commands: {
    createWorkspace: CreateWorkspace;
    updateWorkspace: UpdateWorkspace;
    addWorkspaceMember: AddWorkspaceMember;
    updateWorkspaceMemberRole: UpdateWorkspaceMemberRole;
    removeWorkspaceMember: RemoveWorkspaceMember;
    createAccount: CreateAccount;
    createAccountGroup: CreateAccountGroup;
    assignAccountsToGroup: AssignAccountsToGroup;
    deleteAccount: DeleteAccount;
    importAccounts: ImportAccounts;
    updatePersona: UpdatePersona;
    createPersonaTemplate: CreatePersonaTemplate;
    applyPersonaTemplate: ApplyPersonaTemplate;
    upsertAutopostPolicy: UpsertAutopostPolicy;
    executeAutopostPolicy: ExecuteAutopostPolicy;
    distillPersona: DistillPersona;
    createAlertChannel: CreateAlertChannel;
    updateAlertChannel: UpdateAlertChannel;
    deleteAlertChannel: DeleteAlertChannel;
    bootstrapLocalSession: BootstrapLocalSession;
    upsertSourceWatchlist: UpsertSourceWatchlist;
    removeSourceWatchlist: RemoveSourceWatchlist;
    upsertRecurringBriefPlan: UpsertRecurringBriefPlan;
    removeRecurringBriefPlan: RemoveRecurringBriefPlan;
    executeRecurringBriefPlan: ExecuteRecurringBriefPlan;
    generateContentBrief: GenerateContentBrief;
    queueAccountAutomationTick: QueueAccountAutomationTick;
    pauseAccountAutomation: PauseAccountAutomation;
    resumeAccountAutomation: ResumeAccountAutomation;
    tickAccountAutomation: TickAccountAutomation;
    archiveContentBrief: ArchiveContentBrief;
    regenerateContentBrief: RegenerateContentBrief;
    approveDraft: ApproveDraft;
    requestDraftRegeneration: RequestDraftRegeneration;
    rejectDraft: RejectDraft;
    editDraft: EditDraft;
    generateDraft: GenerateDraft;
    generateDraftFromContentBrief: GenerateDraftFromContentBrief;
    generateDraftReview: GenerateDraftReview;
    scheduleDraft: ScheduleDraft;
    reschedulePublishSchedule: ReschedulePublishSchedule;
    cancelPublishSchedule: CancelPublishSchedule;
    queuePublishJob: QueuePublishJob;
    markPublishSucceeded: MarkPublishSucceeded;
    markPublishFailed: MarkPublishFailed;
    completePublishJob: CompletePublishJob;
    upsertAccountCredential: UpsertAccountCredential;
    validateAccountCredential: ValidateAccountCredential;
    getAccountProfile: GetAccountProfile;
    computeAccountHealthScore: ComputeAccountHealthScore;
    createPost: CreatePost;
    pullMentions: PullMentions;
    pullDirectMessages: PullDirectMessages;
    queuePullMentionsJob: QueuePullMentionsJob;
    queuePullDirectMessagesJob: QueuePullDirectMessagesJob;
    replyToPost: ReplyToPost;
    executePublishJob: ExecutePublishJob;
    retryPublishJob: RetryPublishJob;
    runAgentTask: RunAgentTask;
    retryAgentTask: RetryAgentTask;
    expireAgentTaskLease: ExpireAgentTaskLease;
    classifyInboxThread: ClassifyInboxThread;
    generateReplyProposal: GenerateReplyProposal;
    approveReplyProposal: ApproveReplyProposal;
    sendReplyProposal: SendReplyProposal;
    queueSendReplyProposalJob: QueueSendReplyProposalJob;
    addSource: AddSource;
    removeSource: RemoveSource;
    pauseSource: PauseSource;
    resumeSource: ResumeSource;
    ingestSourceDocuments: IngestSourceDocuments;
    fetchSource: FetchSource;
    executeSourceFetchRun: ExecuteSourceFetchRun;
    retrySourceFetchRun: RetrySourceFetchRun;
    retryMonitoringQueueBacklog: RetryMonitoringQueueBacklog;
    cleanupStaleRuntimeProcesses: CleanupStaleRuntimeProcesses;
    expireSourceFetchRunLease: ExpireSourceFetchRunLease;
    runWorkerJob: RunWorkerJob;
    failWorkerJob: FailWorkerJob;
    retryWorkerJob: RetryWorkerJob;
    refreshTrends: RefreshTrends;
    upsertEngagementPolicy: UpsertEngagementPolicy;
  };
  queries: {
    listWorkspaces: ListWorkspaces;
    getWorkspaceSettingsOverview: GetWorkspaceSettingsOverview;
    getWorkspaceSurface: GetWorkspaceSurface;
    getUserSessionContext: GetUserSessionContext;
    listAccounts: ListAccounts;
    listAccountGroups: ListAccountGroups;
    getAccountsControlPlane: GetAccountsControlPlane;
    getAccountSurface: GetAccountSurface;
    listPersonaTemplates: ListPersonaTemplates;
    getAutopostPolicy: GetAutopostPolicy;
    listAutopostRuns: ListAutopostRuns;
    listAlertChannels: ListAlertChannels;
    getAppChromeOverview: GetAppChromeOverview;
    searchAppCommandTargets: SearchAppCommandTargets;
    getDashboardOverview: GetDashboardOverview;
    getAccountAnalytics: GetAccountAnalytics;
    listSourceWatchlists: ListSourceWatchlists;
    listRecurringBriefPlans: ListRecurringBriefPlans;
    getAccountAutomationOverview: GetAccountAutomationOverview;
    listContentBriefs: ListContentBriefs;
    getContentBrief: GetContentBrief;
    getContentBriefEvidence: GetContentBriefEvidence;
    getBriefWorkbench: GetBriefWorkbench;
    getPersona: GetPersona;
    getEngagementThread: GetEngagementThread;
    listEngagementMessages: ListEngagementMessages;
    listAccountEngagementThreads: ListAccountEngagementThreads;
    getEngagementWorkbench: GetEngagementWorkbench;
    listDrafts: ListDrafts;
    listDraftReviews: ListDraftReviews;
    getDraftWorkbench: GetDraftWorkbench;
    listSchedulesInRange: ListSchedulesInRange;
    getDraftDetail: GetDraftDetail;
    getReplyProposal: GetReplyProposal;
    listThreadReplyProposals: ListThreadReplyProposals;
    listSources: ListSources;
    listAccountSourceDocuments: ListAccountSourceDocuments;
    listSourceDocuments: ListSourceDocuments;
    listSourceFetchRuns: ListSourceFetchRuns;
    listTrends: ListTrends;
    getEngagementPolicy: GetEngagementPolicy;
    listNotifications: ListNotifications;
    getAccountHealthScore: GetAccountHealthScore;
    getAccountHealthFactors: GetAccountHealthFactors;
    getMonitoringFeed: GetMonitoringFeed;
    getMonitoringOverview: GetMonitoringOverview;
    getOperationsOverview: GetOperationsOverview;
    getOperationsHealth: GetOperationsHealth;
    listConnectorRequests: ListConnectorRequests;
    listModelRequests: ListModelRequests;
    listAuditLogs: ListAuditLogs;
    getAgentTask: GetAgentTask;
    getAgentRun: GetAgentRun;
    getAgentRunTrace: GetAgentRunTrace;
    getWorkerJob: GetWorkerJob;
  };
}

export interface BuildAppContextOptions {
  dbPath: string;
  artifactStore?: ArtifactStore;
  connectorXConfig?: BackendConfig["connector_x"];
  modelGateway?: ModelGateway;
  sourceFetchAdapters?: SourceFetchAdapter[];
}

export async function buildAppContext(options: BuildAppContextOptions): Promise<AppContext> {
  const configuredDependencies = requireConfiguredDependencies(options);
  const requestContext = new RequestContextStore();
  const sqlite = createSqliteRuntime(options.dbPath);
  const auditLogs = new SqliteAuditLogRepository(sqlite.db, requestContext);
  const workspaces = new SqliteWorkspacesRepository(sqlite.db);
  const users = new SqliteUsersRepository(sqlite.db);
  const workspaceMembers = new SqliteWorkspaceMembersRepository(sqlite.db);
  const workspaceSurfaceReadModel = new SqliteWorkspaceSurfaceReadModel(sqlite.db);
  const accounts = new SqliteAccountsRepository(sqlite.db);
  const accountGroups = new SqliteAccountGroupsRepository(sqlite.db);
  const accountSurfaceReadModel = new SqliteAccountSurfaceReadModel(sqlite.db);
  const accountsControlPlaneReadModel = new SqliteAccountsControlPlaneReadModel(sqlite.db);
  const accountDeletionGuard = new SqliteAccountDeletionGuard(sqlite.db);
  const accountImportWrites = new SqliteAccountImportWriteTransaction(sqlite.db, requestContext);
  const contentBriefs = new SqliteContentBriefsRepository(sqlite.db);
  const sourceWatchlists = new SqliteSourceWatchlistsRepository(sqlite.db);
  const recurringBriefPlans = new SqliteRecurringBriefPlansRepository(sqlite.db);
  const personas = new SqlitePersonasRepository(sqlite.db);
  const personaTemplates = new SqlitePersonaTemplatesRepository(sqlite.db);
  const personaTemplateWrites = new SqlitePersonaTemplateWriteTransaction(sqlite.db, requestContext);
  const autopostPolicies = new SqliteAutopostPoliciesRepository(sqlite.db);
  const autopostRuns = new SqliteAutopostRunsRepository(sqlite.db);
  const drafts = new SqliteDraftsRepository(sqlite.db);
  const draftListReadModel = new SqliteDraftListReadModel(sqlite.db);
  const scheduleCalendarReadModel = new SqliteScheduleCalendarReadModel(sqlite.db);
  const engagementThreadListReadModel = new SqliteEngagementThreadListReadModel(sqlite.db);
  const appChromeOverviewReadModel = new SqliteAppChromeOverviewReadModel(sqlite.db);
  const appCommandSearchReadModel = new SqliteAppCommandSearchReadModel(sqlite.db);
  const dashboardOverviewReadModel = new SqliteDashboardOverviewReadModel(sqlite.db);
  const accountAnalyticsReadModel = new SqliteAccountAnalyticsReadModel(sqlite.db);
  const accountAutomationOverviewReadModel = new SqliteAccountAutomationOverviewReadModel(sqlite.db);
  const accountOrchestrationStates = new SqliteAccountOrchestrationStatesRepository(sqlite.db);
  const orchestrationRuns = new SqliteOrchestrationRunsRepository(sqlite.db);
  const monitoringAgentTraceReadModel = new SqliteMonitoringAgentTraceReadModel(sqlite.db);
  const monitoringOperatorQueueReadModel = new SqliteMonitoringOperatorQueueReadModel(sqlite.db);
  const operationsOverviewReadModel = new SqliteOperationsOverviewReadModel(sqlite.db);
  const runtimeProcesses = new SqliteRuntimeProcessesRepository(sqlite.db);
  const alertChannels = new SqliteAlertChannelsRepository(sqlite.db);
  const managedSecretsVault = new SqliteManagedSecretVault(sqlite.db);
  await managedSecretsVault.migrateLegacySecrets();
  const alertChannelSecretStore = new SqliteAlertChannelSecretStore(managedSecretsVault, systemClock);
  const versions = new SqliteDraftVersionRepository(sqlite.db);
  const schedules = new SqliteSchedulesRepository(sqlite.db);
  const credentials = new SqliteAccountCredentialsRepository(sqlite.db);
  const secretStore = new SqliteCredentialSecretStore(managedSecretsVault);
  const connectorRequests = new SqliteConnectorRequestRepository(sqlite.db, requestContext);
  const rateLimitBuckets = new SqliteRateLimitBucketsRepository(sqlite.db);
  const notifications = new SqliteNotificationsRepository(sqlite.db);
  const alerts = new SqliteAlertsRepository(sqlite.db, requestContext);
  const healthScores = new SqliteHealthScoresRepository(sqlite.db);
  const healthScoreFactors = new SqliteHealthScoreFactorsRepository(sqlite.db);
  const riskEvents = new SqliteRiskEventsRepository(sqlite.db);
  const engagement = new SqliteEngagementRepository(sqlite.db);
  const engagementPolicies = new SqliteEngagementPoliciesRepository(sqlite.db);
  const sources = new SqliteSourcesRepository(sqlite.db);
  const accountSourceDocumentReadModel = new SqliteAccountSourceDocumentReadModel(sqlite.db);
  const trends = new SqliteTrendsRepository(sqlite.db);
  const xApi = new XApiClient(configuredDependencies.connectorXConfig, secretStore);
  const credentialValidator = new XApiCredentialValidator(xApi);
  const twitterClient = new XApiTwitterClient(xApi);
  const runtime = new SqliteAgentRuntimeRepository(sqlite.db, requestContext);
  const modelGateway = configuredDependencies.modelGateway;
  const publishWrites = new SqlitePublishWriteTransaction(sqlite.db, requestContext);
  const workerJobs = new SqliteWorkerJobsRepository(sqlite.db);
  const sourceFetcher: SourceFetcher = new RegistrySourceFetcher(configuredDependencies.sourceFetchAdapters, {
    getValidCredential: (accountId) => credentials.findValidByAccountId(accountId),
    twitterClient,
  });
  await seedAgentDefinitions(runtime);
  await seedPersonaTemplates(personaTemplates);
  const generateRiskEvents = new GenerateRiskEvents({
    riskEvents,
    alerts,
    notifications,
    clock: systemClock,
  });
  const computeAccountHealthScore = new ComputeAccountHealthScore({
    accounts,
    healthScores,
    factors: healthScoreFactors,
    auditLogs,
    generateRiskEvents,
    clock: systemClock,
  });
  const replyToPost = new ReplyToPost({
    accounts,
    credentials,
    connectorRequests,
    rateLimitBuckets,
    twitterClient,
    clock: systemClock,
  });
  const queueAccountAutomationTick = new QueueAccountAutomationTick({
    accounts,
    states: accountOrchestrationStates,
    workerJobs,
    auditLogs,
    clock: systemClock,
  });
  const pauseAccountAutomation = new PauseAccountAutomation({
    accounts,
    states: accountOrchestrationStates,
    auditLogs,
    clock: systemClock,
  });
  const resumeAccountAutomation = new ResumeAccountAutomation({
    accounts,
    states: accountOrchestrationStates,
    auditLogs,
    queueAccountAutomationTick,
    clock: systemClock,
  });
  const generateDraft = new GenerateDraft({
    runtime,
    accounts,
    queueAccountAutomationTick,
    now: () => systemClock.now().toISOString(),
  });
  const approveDraft = new ApproveDraft({
    drafts,
    auditLogs,
    queueAccountAutomationTick,
    clock: systemClock,
  });
  const requestDraftRegeneration = new RequestDraftRegeneration({
    drafts,
    versions,
    runtime,
    auditLogs,
    queueAccountAutomationTick,
    clock: systemClock,
  });
  const rejectDraft = new RejectDraft({
    drafts,
    auditLogs,
    queueAccountAutomationTick,
    clock: systemClock,
  });
  const editDraft = new EditDraft({ drafts, versions, auditLogs, clock: systemClock });
  const scheduleDraft = new ScheduleDraft({ drafts, schedules, auditLogs, clock: systemClock });
  const reschedulePublishSchedule = new ReschedulePublishSchedule({ schedules, drafts, auditLogs, clock: systemClock });
  const cancelPublishSchedule = new CancelPublishSchedule({ schedules, drafts, auditLogs, clock: systemClock });
  const queuePublishJob = new QueuePublishJob({ schedules, auditLogs, clock: systemClock });
  const generateContentBrief = new GenerateContentBrief({
    runtime,
    accounts,
    contentBriefs,
    queueAccountAutomationTick,
    now: () => systemClock.now().toISOString(),
  });
  const refreshTrends = new RefreshTrends({ sources, trends, auditLogs, clock: systemClock });
  const failAutopostRun = new FailAutopostRun({
    policies: autopostPolicies,
    runs: autopostRuns,
    workerJobs,
    auditLogs,
    alerts,
    clock: systemClock,
  });
  const executeAutopostPolicy = new ExecuteAutopostPolicy({
    policies: autopostPolicies,
    runs: autopostRuns,
    workerJobs,
    sourceDocuments: accountSourceDocumentReadModel,
    trends,
    refreshTrends,
    generateContentBrief,
    auditLogs,
    alerts,
    clock: systemClock,
  });
  const continueAutopostRunFromBrief = new ContinueAutopostRunFromBrief({
    runs: autopostRuns,
    generateDraft,
    failAutopostRun,
    auditLogs,
    clock: systemClock,
  });
  const finalizeAutopostRun = new FinalizeAutopostRun({
    runtime,
    policies: autopostPolicies,
    runs: autopostRuns,
    drafts,
    approveDraft,
    scheduleDraft,
    queuePublishJob,
    failAutopostRun,
    auditLogs,
    clock: systemClock,
  });
  const runAgentTask = new RunAgentTask({
    runtime,
    accounts,
    contentBriefs,
    personas,
    trends,
    sources,
    accountSourceDocuments: accountSourceDocumentReadModel,
    drafts,
    versions,
    engagement,
    artifactStore: configuredDependencies.artifactStore,
    auditLogs,
    alerts,
    queueAccountAutomationTick,
    modelGateway,
    clock: systemClock,
  });
  const executeRecurringBriefPlan = new ExecuteRecurringBriefPlan({
    plans: recurringBriefPlans,
    watchlists: sourceWatchlists,
    trends,
    refreshTrends,
    generateContentBrief,
    workerJobs,
    auditLogs,
    clock: systemClock,
  });
  const generateReplyProposal = new GenerateReplyProposal({
    runtime,
    engagement,
    now: () => systemClock.now().toISOString(),
  });
  const tickAccountAutomation = new TickAccountAutomation({
    accounts,
    states: accountOrchestrationStates,
    runs: orchestrationRuns,
    overviews: accountAutomationOverviewReadModel,
    eligibility: new EvaluateAccountEligibility(),
    chief: new ChiefOrchestrator(),
    applier: new ApplyOrchestrationDecision({
      classifyInboxThread: new ClassifyInboxThread({
        runtime,
        engagement,
        now: () => systemClock.now().toISOString(),
      }),
      continueAutopostRunFromBrief,
      executeAutopostPolicy,
      finalizeAutopostRun,
      generateDraft,
      executeRecurringBriefPlan,
      generateReplyProposal,
    }),
    alerts,
    auditLogs,
    clock: systemClock,
  });
  const failRecurringBriefPlanExecution = new FailRecurringBriefPlanExecution({
    plans: recurringBriefPlans,
    workerJobs,
    auditLogs,
    clock: systemClock,
  });
  const failWorkerJob = new FailWorkerJob({
    workerJobs,
    alerts,
    auditLogs,
    clock: systemClock,
  });
  const sendDirectMessage = new SendDirectMessage({
    accounts,
    credentials,
    connectorRequests,
    rateLimitBuckets,
    twitterClient,
    clock: systemClock,
  });
  const runWorkerJob = new RunWorkerJob({
    workerJobs,
    pullMentions: new PullMentions({ accounts, credentials, engagement, connectorRequests, rateLimitBuckets, twitterClient, clock: systemClock }),
    pullDirectMessages: new PullDirectMessages({ accounts, credentials, engagement, connectorRequests, rateLimitBuckets, twitterClient, clock: systemClock }),
    sendReplyProposal: new SendReplyProposal({
      engagement,
      policies: engagementPolicies,
      accounts,
      replyToPost,
      sendDirectMessage,
      queueAccountAutomationTick,
      auditLogs,
      clock: systemClock,
    }),
    autopostPolicies,
    recurringBriefPlans,
    queueAccountAutomationTick,
    tickAccountAutomation,
    failRecurringBriefPlanExecution,
    failWorkerJob,
    clock: systemClock,
  });
  const getOperationsOverview = new GetOperationsOverview({
    readModel: operationsOverviewReadModel,
    clock: systemClock,
  });
  const getOperationsHealth = new GetOperationsHealth({
    overview: getOperationsOverview,
    clock: systemClock,
  });
  const retryPublishJob = new RetryPublishJob({ schedules, drafts, auditLogs, clock: systemClock });
  const retryAgentTask = new RetryAgentTask({ runtime });
  const retrySourceFetchRun = new RetrySourceFetchRun({ sources, auditLogs, clock: systemClock });
  const retryWorkerJob = new RetryWorkerJob({ workerJobs, clock: systemClock });
  const retryMonitoringQueueBacklog = new RetryMonitoringQueueBacklog({
    operatorQueues: monitoringOperatorQueueReadModel,
    retryAgentTask,
    retryWorkerJob,
    retryPublishJob,
    retrySourceFetchRun,
  });
  const queueSendReplyProposalJob = new QueueSendReplyProposalJob({ engagement, workerJobs, auditLogs, clock: systemClock });
  const cleanupStaleRuntimeProcesses = new CleanupStaleRuntimeProcesses({
    processes: runtimeProcesses,
    clock: systemClock,
  });

  return {
    sqlite,
    requestContext,
    commands: {
      createWorkspace: new CreateWorkspace({ workspaces, auditLogs, clock: systemClock }),
      updateWorkspace: new UpdateWorkspace({ workspaces, auditLogs, clock: systemClock }),
      addWorkspaceMember: new AddWorkspaceMember({ workspaces, users, members: workspaceMembers, auditLogs, clock: systemClock }),
      updateWorkspaceMemberRole: new UpdateWorkspaceMemberRole({ members: workspaceMembers, auditLogs, clock: systemClock }),
      removeWorkspaceMember: new RemoveWorkspaceMember({ members: workspaceMembers, auditLogs, clock: systemClock }),
      createAccount: new CreateAccount({ workspaces, accounts, groups: accountGroups, auditLogs, clock: systemClock }),
      createAccountGroup: new CreateAccountGroup({ groups: accountGroups, workspaces, auditLogs, clock: systemClock }),
      assignAccountsToGroup: new AssignAccountsToGroup({ accounts, groups: accountGroups, auditLogs, clock: systemClock }),
      deleteAccount: new DeleteAccount({ accounts, deletionGuard: accountDeletionGuard, auditLogs, clock: systemClock }),
      importAccounts: new ImportAccounts({ workspaces, groups: accountGroups, accounts, writes: accountImportWrites, clock: systemClock }),
      updatePersona: new UpdatePersona({ personas, auditLogs, clock: systemClock }),
      createPersonaTemplate: new CreatePersonaTemplate({ workspaces, templates: personaTemplates, auditLogs, clock: systemClock }),
      applyPersonaTemplate: new ApplyPersonaTemplate({
        accounts,
        personas,
        templates: personaTemplates,
        writes: personaTemplateWrites,
        clock: systemClock,
      }),
      upsertAutopostPolicy: new UpsertAutopostPolicy({
        accounts,
        policies: autopostPolicies,
        workerJobs,
        queueAccountAutomationTick,
        auditLogs,
        clock: systemClock,
      }),
      executeAutopostPolicy,
      distillPersona: new DistillPersona({
        runtime,
        accounts,
        credentials,
        twitterClient,
        sources,
        now: () => systemClock.now().toISOString(),
      }),
      createAlertChannel: new CreateAlertChannel({
        workspaces,
        channels: alertChannels,
        secretStore: alertChannelSecretStore,
        auditLogs,
        clock: systemClock,
      }),
      updateAlertChannel: new UpdateAlertChannel({
        channels: alertChannels,
        secretStore: alertChannelSecretStore,
        auditLogs,
        clock: systemClock,
      }),
      deleteAlertChannel: new DeleteAlertChannel({
        channels: alertChannels,
        secretStore: alertChannelSecretStore,
        auditLogs,
        clock: systemClock,
      }),
      bootstrapLocalSession: new BootstrapLocalSession({
        users,
        workspaces,
        members: workspaceMembers,
        auditLogs,
        clock: systemClock,
      }),
      upsertSourceWatchlist: new UpsertSourceWatchlist({
        accounts,
        sources,
        watchlists: sourceWatchlists,
        auditLogs,
        clock: systemClock,
      }),
      removeSourceWatchlist: new RemoveSourceWatchlist({
        watchlists: sourceWatchlists,
        plans: recurringBriefPlans,
        auditLogs,
        clock: systemClock,
      }),
      upsertRecurringBriefPlan: new UpsertRecurringBriefPlan({
        accounts,
        sources,
        watchlists: sourceWatchlists,
        plans: recurringBriefPlans,
        workerJobs,
        queueAccountAutomationTick,
        auditLogs,
        clock: systemClock,
      }),
      removeRecurringBriefPlan: new RemoveRecurringBriefPlan({
        plans: recurringBriefPlans,
        workerJobs,
        auditLogs,
        clock: systemClock,
      }),
      executeRecurringBriefPlan,
      generateContentBrief,
      queueAccountAutomationTick,
      pauseAccountAutomation,
      resumeAccountAutomation,
      tickAccountAutomation,
      archiveContentBrief: new ArchiveContentBrief({
        contentBriefs,
        auditLogs,
        now: () => systemClock.now().toISOString(),
      }),
      regenerateContentBrief: new RegenerateContentBrief({
        runtime,
        contentBriefs,
        auditLogs,
        now: () => systemClock.now().toISOString(),
      }),
      approveDraft,
      requestDraftRegeneration,
      rejectDraft,
      editDraft,
      generateDraft,
      generateDraftFromContentBrief: new GenerateDraftFromContentBrief({
        contentBriefs,
        generateDraft,
      }),
      generateDraftReview: new GenerateDraftReview({
        runtime,
        drafts,
        now: () => systemClock.now().toISOString(),
      }),
      scheduleDraft,
      reschedulePublishSchedule,
      cancelPublishSchedule,
      queuePublishJob,
      markPublishSucceeded: new MarkPublishSucceeded({ schedules, auditLogs, clock: systemClock }),
      markPublishFailed: new MarkPublishFailed({ schedules, drafts, publishWrites, clock: systemClock }),
      completePublishJob: new CompletePublishJob({ schedules, drafts, versions, publishWrites, clock: systemClock }),
      upsertAccountCredential: new UpsertAccountCredential({
        credentials,
        secretStore,
        auditLogs,
        clock: systemClock,
      }),
      validateAccountCredential: new ValidateAccountCredential({
        credentials,
        validator: credentialValidator,
        clock: systemClock,
      }),
      getAccountProfile: new GetAccountProfile({
        accounts,
        credentials,
        connectorRequests,
        rateLimitBuckets,
        alerts,
        notifications,
        auditLogs,
        computeHealthScore: computeAccountHealthScore,
        twitterClient,
        clock: systemClock,
      }),
      computeAccountHealthScore,
      createPost: new CreatePost({ accounts, credentials, connectorRequests, rateLimitBuckets, twitterClient, clock: systemClock }),
      pullMentions: new PullMentions({ accounts, credentials, engagement, connectorRequests, rateLimitBuckets, twitterClient, clock: systemClock }),
      pullDirectMessages: new PullDirectMessages({ accounts, credentials, engagement, connectorRequests, rateLimitBuckets, twitterClient, clock: systemClock }),
      queuePullMentionsJob: new QueuePullMentionsJob({ accounts, workerJobs, auditLogs, clock: systemClock }),
      queuePullDirectMessagesJob: new QueuePullDirectMessagesJob({ accounts, workerJobs, auditLogs, clock: systemClock }),
      replyToPost,
      executePublishJob: new ExecutePublishJob({
        schedules,
        drafts,
        versions,
        createPost: new CreatePost({ accounts, credentials, connectorRequests, rateLimitBuckets, twitterClient, clock: systemClock }),
        completePublishJob: new CompletePublishJob({ schedules, drafts, versions, publishWrites, clock: systemClock }),
        markPublishFailed: new MarkPublishFailed({ schedules, drafts, publishWrites, clock: systemClock }),
        clock: systemClock,
      }),
      retryPublishJob,
      runAgentTask,
      retryAgentTask,
      expireAgentTaskLease: new ExpireAgentTaskLease({
        runtime,
        autopostRuns,
        failAutopostRun,
        alerts,
        auditLogs,
        clock: systemClock,
      }),
      classifyInboxThread: new ClassifyInboxThread({
        runtime,
        engagement,
        now: () => systemClock.now().toISOString(),
      }),
      generateReplyProposal,
      approveReplyProposal: new ApproveReplyProposal({
        engagement,
        queueSendReplyProposalJob,
        queueAccountAutomationTick,
        auditLogs,
        clock: systemClock,
      }),
      sendReplyProposal: new SendReplyProposal({
        engagement,
        policies: engagementPolicies,
        accounts,
        replyToPost,
        sendDirectMessage,
        queueAccountAutomationTick,
        auditLogs,
        clock: systemClock,
      }),
      queueSendReplyProposalJob,
      addSource: new AddSource({ accounts, sources, auditLogs, clock: systemClock }),
      removeSource: new RemoveSource({ sources, auditLogs, clock: systemClock }),
      pauseSource: new PauseSource({ sources, auditLogs, clock: systemClock }),
      resumeSource: new ResumeSource({ sources, auditLogs, clock: systemClock }),
      ingestSourceDocuments: new IngestSourceDocuments({ sources, auditLogs, clock: systemClock }),
      fetchSource: new FetchSource({ sources, auditLogs, clock: systemClock }),
      executeSourceFetchRun: new ExecuteSourceFetchRun({
        sources,
        fetcher: sourceFetcher,
        artifactStore: configuredDependencies.artifactStore,
        auditLogs,
        alerts,
        clock: systemClock,
      }),
      retrySourceFetchRun,
      retryMonitoringQueueBacklog,
      cleanupStaleRuntimeProcesses,
      expireSourceFetchRunLease: new ExpireSourceFetchRunLease({ sources, auditLogs, alerts, clock: systemClock }),
      runWorkerJob,
      failWorkerJob,
      retryWorkerJob,
      refreshTrends,
      upsertEngagementPolicy: new UpsertEngagementPolicy({
        accounts,
        policies: engagementPolicies,
        queueAccountAutomationTick,
        auditLogs,
        clock: systemClock,
      }),
    },
    queries: {
      listWorkspaces: new ListWorkspaces({ workspaces, members: workspaceMembers }),
      getWorkspaceSettingsOverview: new GetWorkspaceSettingsOverview({ workspaces, users, members: workspaceMembers }),
      getWorkspaceSurface: new GetWorkspaceSurface({ readModel: workspaceSurfaceReadModel }),
      getUserSessionContext: new GetUserSessionContext({ users, workspaces, members: workspaceMembers }),
      listAccounts: new ListAccounts({ accounts }),
      listAccountGroups: new ListAccountGroups({ groups: accountGroups, accounts }),
      getAccountsControlPlane: new GetAccountsControlPlane({ readModel: accountsControlPlaneReadModel }),
      getAccountSurface: new GetAccountSurface({ readModel: accountSurfaceReadModel }),
      listPersonaTemplates: new ListPersonaTemplates({ templates: personaTemplates, workspaces }),
      getAutopostPolicy: new GetAutopostPolicy({ policies: autopostPolicies }),
      listAutopostRuns: new ListAutopostRuns({ accounts, runs: autopostRuns }),
      listAlertChannels: new ListAlertChannels({ channels: alertChannels }),
      getAppChromeOverview: new GetAppChromeOverview({ readModel: appChromeOverviewReadModel }),
      searchAppCommandTargets: new SearchAppCommandTargets({ readModel: appCommandSearchReadModel }),
      getDashboardOverview: new GetDashboardOverview({ readModel: dashboardOverviewReadModel }),
      getAccountAnalytics: new GetAccountAnalytics({ readModel: accountAnalyticsReadModel }),
      listSourceWatchlists: new ListSourceWatchlists({ watchlists: sourceWatchlists }),
      listRecurringBriefPlans: new ListRecurringBriefPlans({ plans: recurringBriefPlans, watchlists: sourceWatchlists }),
      getAccountAutomationOverview: new GetAccountAutomationOverview({
        readModel: accountAutomationOverviewReadModel,
        runs: orchestrationRuns,
        eligibility: new EvaluateAccountEligibility(),
        chief: new ChiefOrchestrator(),
        clock: systemClock,
      }),
      listContentBriefs: new ListContentBriefs({ contentBriefs, sources, trends }),
      getContentBrief: new GetContentBrief({ contentBriefs, sources, trends }),
      getContentBriefEvidence: new GetContentBriefEvidence({ contentBriefs, sources }),
      getBriefWorkbench: new GetBriefWorkbench({
        accounts,
        contentBriefs,
        sources,
        trends,
        sourceDocuments: accountSourceDocumentReadModel,
        watchlists: sourceWatchlists,
        recurringPlans: recurringBriefPlans,
      }),
      getPersona: new GetPersona({ personas }),
      getEngagementThread: new GetEngagementThread({ engagement }),
      listEngagementMessages: new ListEngagementMessages({ engagement }),
      listAccountEngagementThreads: new ListAccountEngagementThreads({ readModel: engagementThreadListReadModel }),
      getEngagementWorkbench: new GetEngagementWorkbench({
        accounts,
        threads: engagementThreadListReadModel,
        engagement,
        policies: engagementPolicies,
      }),
      listDrafts: new ListDrafts({ readModel: draftListReadModel }),
      listDraftReviews: new ListDraftReviews({ drafts }),
      getDraftWorkbench: new GetDraftWorkbench({
        accounts,
        drafts: draftListReadModel,
        contentBriefs,
        sources,
        trends,
      }),
      listSchedulesInRange: new ListSchedulesInRange({ readModel: scheduleCalendarReadModel }),
      getDraftDetail: new GetDraftDetail({ drafts, versions }),
      getReplyProposal: new GetReplyProposal({ engagement }),
      listThreadReplyProposals: new ListThreadReplyProposals({ engagement }),
      listSources: new ListSources({ sources }),
      listAccountSourceDocuments: new ListAccountSourceDocuments({
        accounts,
        readModel: accountSourceDocumentReadModel,
      }),
      listSourceDocuments: new ListSourceDocuments({ sources }),
      listSourceFetchRuns: new ListSourceFetchRuns({ sources }),
      listTrends: new ListTrends({ trends }),
      getEngagementPolicy: new GetEngagementPolicy({ policies: engagementPolicies }),
      listNotifications: new ListNotifications({ notifications }),
      getAccountHealthScore: new GetAccountHealthScore({ healthScores }),
      getAccountHealthFactors: new GetAccountHealthFactors({ healthScores, factors: healthScoreFactors }),
      getMonitoringFeed: new GetMonitoringFeed({ alerts, notifications, riskEvents }),
      getMonitoringOverview: new GetMonitoringOverview({
        alerts,
        notifications,
        riskEvents,
        connectorRequests,
        runtime,
        agentTraces: monitoringAgentTraceReadModel,
        operatorQueues: monitoringOperatorQueueReadModel,
        alertChannels,
        auditLogs,
        operations: operationsOverviewReadModel,
        clock: systemClock,
      }),
      getOperationsOverview,
      getOperationsHealth,
      listConnectorRequests: new ListConnectorRequests({ connectorRequests }),
      listModelRequests: new ListModelRequests({ runtime }),
      listAuditLogs: new ListAuditLogs({ auditLogs }),
      getAgentTask: new GetAgentTask({ runtime }),
      getAgentRun: new GetAgentRun({ runtime }),
      getAgentRunTrace: new GetAgentRunTrace({ runtime, alerts, auditLogs, connectorRequests }),
      getWorkerJob: new GetWorkerJob({ workerJobs }),
    },
  };
}

function requireConfiguredDependencies(options: BuildAppContextOptions): Required<Pick<
  BuildAppContextOptions,
  "artifactStore" | "connectorXConfig" | "modelGateway" | "sourceFetchAdapters"
>> {
  const missing: string[] = [];

  if (!options.artifactStore) {
    missing.push("artifactStore");
  }
  if (!options.connectorXConfig) {
    missing.push("connectorXConfig");
  }
  if (!options.modelGateway) {
    missing.push("modelGateway");
  }
  if (!options.sourceFetchAdapters) {
    missing.push("sourceFetchAdapters");
  }

  if (missing.length > 0) {
    throw new Error(`buildAppContext requires configured dependencies: ${missing.join(", ")}`);
  }

  return {
    artifactStore: options.artifactStore!,
    connectorXConfig: options.connectorXConfig!,
    modelGateway: options.modelGateway!,
    sourceFetchAdapters: options.sourceFetchAdapters!,
  };
}
