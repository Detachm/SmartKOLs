import { AppError } from "../../core/errors/app-error";
import { newId } from "../../core/ids/new-id";
import { err } from "../../core/result/result";
import type { CreateAccountRequest } from "../../contracts/api/accounts";
import type { ImportAccountsRequest } from "../../contracts/api/account-imports";
import type { AssignAccountsToGroupRequest, CreateAccountGroupRequest } from "../../contracts/api/account-groups";
import type { CreateAlertChannelRequest, UpdateAlertChannelRequest } from "../../contracts/api/alert-channels";
import type { BootstrapLocalAuthRequest } from "../../contracts/api/local-auth";
import type { ApproveDraftRequest, RequestDraftRegenerationRequest } from "../../contracts/api/drafts";
import type { UpsertAutopostPolicyRequest } from "../../contracts/api/autopost-policies";
import type { ApplyPersonaTemplateRequest, CreatePersonaTemplateRequest } from "../../contracts/api/persona-templates";
import type { RetryMonitoringQueueBacklogRequest } from "../../contracts/api/monitoring";
import type { AddWorkspaceMemberRequest, UpdateWorkspaceMemberRoleRequest, UpdateWorkspaceRequest } from "../../contracts/api/settings";
import type { CreateWorkspaceRequest } from "../../contracts/api/workspaces";
import type { ScheduleDraftRequest, UpdatePublishScheduleRequest } from "../../contracts/api/schedules";
import type { UpsertAccountCredentialRequest, CompletePublishJobRequest, FailPublishJobRequest } from "../../contracts/api/account-credentials";
import { createAccountHandler } from "./handlers/accounts/create-account-handler";
import { importAccountsHandler } from "./handlers/accounts/import-accounts-handler";
import { listAccountsHandler } from "./handlers/accounts/list-accounts-handler";
import { getAccountsControlPlaneHandler } from "./handlers/accounts/get-accounts-control-plane-handler";
import { getAccountSurfaceHandler } from "./handlers/accounts/get-account-surface-handler";
import { getAccountAutomationOverviewHandler } from "./handlers/accounts/get-account-automation-overview-handler";
import { queueAccountAutomationTickHandler } from "./handlers/accounts/queue-account-automation-tick-handler";
import { pauseAccountAutomationHandler } from "./handlers/accounts/pause-account-automation-handler";
import { resumeAccountAutomationHandler } from "./handlers/accounts/resume-account-automation-handler";
import { deleteAccountHandler } from "./handlers/accounts/delete-account-handler";
import { createAccountGroupHandler } from "./handlers/account-groups/create-account-group-handler";
import { listAccountGroupsHandler } from "./handlers/account-groups/list-account-groups-handler";
import { assignAccountsToGroupHandler } from "./handlers/account-groups/assign-accounts-to-group-handler";
import { approveDraftHandler } from "./handlers/drafts/approve-draft-handler";
import { requestDraftRegenerationHandler } from "./handlers/drafts/request-draft-regeneration-handler";
import { rejectDraftHandler } from "./handlers/drafts/reject-draft-handler";
import { editDraftHandler } from "./handlers/drafts/edit-draft-handler";
import { generateDraftHandler } from "./handlers/drafts/generate-draft-handler";
import { generateDraftReviewHandler } from "./handlers/drafts/generate-draft-review-handler";
import { listDraftReviewsHandler } from "./handlers/drafts/list-draft-reviews-handler";
import { getAutopostPolicyHandler } from "./handlers/autopost/get-autopost-policy-handler";
import { listAutopostRunsHandler } from "./handlers/autopost/list-autopost-runs-handler";
import { executeAutopostPolicyHandler } from "./handlers/autopost/execute-autopost-policy-handler";
import { upsertAutopostPolicyHandler } from "./handlers/autopost/upsert-autopost-policy-handler";
import { getDraftDetailHandler } from "./handlers/drafts/get-draft-detail-handler";
import { listDraftsHandler } from "./handlers/drafts/list-drafts-handler";
import { getDraftWorkbenchHandler } from "./handlers/drafts/get-draft-workbench-handler";
import { updatePersonaHandler } from "./handlers/personas/update-persona-handler";
import { getPersonaHandler } from "./handlers/personas/get-persona-handler";
import { distillPersonaHandler } from "./handlers/personas/distill-persona-handler";
import { createAlertChannelHandler } from "./handlers/alert-channels/create-alert-channel-handler";
import { deleteAlertChannelHandler } from "./handlers/alert-channels/delete-alert-channel-handler";
import { listAlertChannelsHandler } from "./handlers/alert-channels/list-alert-channels-handler";
import { updateAlertChannelHandler } from "./handlers/alert-channels/update-alert-channel-handler";
import { createPersonaTemplateHandler } from "./handlers/persona-templates/create-persona-template-handler";
import { listPersonaTemplatesHandler } from "./handlers/persona-templates/list-persona-templates-handler";
import { applyPersonaTemplateHandler } from "./handlers/persona-templates/apply-persona-template-handler";
import { bootstrapLocalSessionHandler } from "./handlers/users/bootstrap-local-session-handler";
import { getUserSessionContextHandler } from "./handlers/users/get-user-session-context-handler";
import { scheduleDraftHandler } from "./handlers/schedules/schedule-draft-handler";
import { reschedulePublishScheduleHandler } from "./handlers/schedules/reschedule-publish-schedule-handler";
import { cancelPublishScheduleHandler } from "./handlers/schedules/cancel-publish-schedule-handler";
import { queuePublishJobHandler } from "./handlers/schedules/queue-publish-job-handler";
import { listSchedulesInRangeHandler } from "./handlers/schedules/list-schedules-in-range-handler";
import { completePublishJobHandler } from "./handlers/publish-jobs/complete-publish-job-handler";
import { failPublishJobHandler } from "./handlers/publish-jobs/fail-publish-job-handler";
import { executePublishJobHandler } from "./handlers/publish-jobs/execute-publish-job-handler";
import { retryPublishJobHandler } from "./handlers/publish-jobs/retry-publish-job-handler";
import { upsertAccountCredentialHandler } from "./handlers/account-credentials/upsert-account-credential-handler";
import { validateAccountCredentialHandler } from "./handlers/account-credentials/validate-account-credential-handler";
import { createWorkspaceHandler } from "./handlers/workspaces/create-workspace-handler";
import { listWorkspacesHandler } from "./handlers/workspaces/list-workspaces-handler";
import { getWorkspaceSettingsOverviewHandler } from "./handlers/workspaces/get-workspace-settings-overview-handler";
import { getWorkspaceSurfaceHandler } from "./handlers/workspaces/get-workspace-surface-handler";
import { updateWorkspaceHandler } from "./handlers/workspaces/update-workspace-handler";
import { addWorkspaceMemberHandler } from "./handlers/workspaces/add-workspace-member-handler";
import { updateWorkspaceMemberRoleHandler } from "./handlers/workspaces/update-workspace-member-role-handler";
import { removeWorkspaceMemberHandler } from "./handlers/workspaces/remove-workspace-member-handler";
import { createPostHandler } from "./handlers/connector-x/create-post-handler";
import { getAccountProfileHandler } from "./handlers/connector-x/get-account-profile-handler";
import { pullMentionsHandler } from "./handlers/connector-x/pull-mentions-handler";
import { pullDirectMessagesHandler } from "./handlers/connector-x/pull-direct-messages-handler";
import { classifyInboxThreadHandler } from "./handlers/agent-runtime/classify-inbox-thread-handler";
import { retryAgentTaskHandler } from "./handlers/agent-runtime/retry-agent-task-handler";
import { getAgentTaskHandler } from "./handlers/agent-runtime/get-agent-task-handler";
import { getAgentRunHandler, getAgentRunTraceHandler } from "./handlers/agent-runtime/get-agent-run-handler";
import { getDashboardOverviewHandler } from "./handlers/dashboard/get-dashboard-overview-handler";
import { getAppChromeOverviewHandler } from "./handlers/app-chrome/get-app-chrome-overview-handler";
import { searchAppCommandTargetsHandler } from "./handlers/app-chrome/search-app-command-targets-handler";
import { getAccountAnalyticsHandler } from "./handlers/analytics/get-account-analytics-handler";
import { generateContentBriefHandler } from "./handlers/content-briefs/generate-content-brief-handler";
import { listContentBriefsHandler } from "./handlers/content-briefs/list-content-briefs-handler";
import { getContentBriefHandler } from "./handlers/content-briefs/get-content-brief-handler";
import { getContentBriefEvidenceHandler } from "./handlers/content-briefs/get-content-brief-evidence-handler";
import { getBriefWorkbenchHandler } from "./handlers/content-briefs/get-brief-workbench-handler";
import { archiveContentBriefHandler } from "./handlers/content-briefs/archive-content-brief-handler";
import { regenerateContentBriefHandler } from "./handlers/content-briefs/regenerate-content-brief-handler";
import { generateDraftFromContentBriefHandler } from "./handlers/content-briefs/generate-draft-from-content-brief-handler";
import { getEngagementThreadHandler } from "./handlers/engagement/get-engagement-thread-handler";
import { listAccountEngagementThreadsHandler } from "./handlers/engagement/list-account-engagement-threads-handler";
import { listEngagementMessagesHandler } from "./handlers/engagement/list-engagement-messages-handler";
import { getEngagementWorkbenchHandler } from "./handlers/engagement/get-engagement-workbench-handler";
import { generateReplyProposalHandler } from "./handlers/engagement/generate-reply-proposal-handler";
import { listThreadReplyProposalsHandler } from "./handlers/engagement/list-thread-reply-proposals-handler";
import { getReplyProposalHandler } from "./handlers/engagement/get-reply-proposal-handler";
import { approveReplyProposalHandler } from "./handlers/engagement/approve-reply-proposal-handler";
import { sendReplyProposalHandler } from "./handlers/engagement/send-reply-proposal-handler";
import { upsertEngagementPolicyHandler } from "./handlers/engagement/upsert-engagement-policy-handler";
import { getEngagementPolicyHandler } from "./handlers/engagement/get-engagement-policy-handler";
import { listSourceWatchlistsHandler } from "./handlers/editorial/list-source-watchlists-handler";
import { upsertSourceWatchlistHandler } from "./handlers/editorial/upsert-source-watchlist-handler";
import { removeSourceWatchlistHandler } from "./handlers/editorial/remove-source-watchlist-handler";
import { listRecurringBriefPlansHandler } from "./handlers/editorial/list-recurring-brief-plans-handler";
import { upsertRecurringBriefPlanHandler } from "./handlers/editorial/upsert-recurring-brief-plan-handler";
import { removeRecurringBriefPlanHandler } from "./handlers/editorial/remove-recurring-brief-plan-handler";
import { executeRecurringBriefPlanHandler } from "./handlers/editorial/execute-recurring-brief-plan-handler";
import { getWorkerJobHandler } from "./handlers/execution/get-worker-job-handler";
import { retryWorkerJobHandler } from "./handlers/execution/retry-worker-job-handler";
import { addSourceHandler } from "./handlers/sources/add-source-handler";
import { removeSourceHandler } from "./handlers/sources/remove-source-handler";
import { pauseSourceHandler } from "./handlers/sources/pause-source-handler";
import { resumeSourceHandler } from "./handlers/sources/resume-source-handler";
import { ingestSourceDocumentsHandler } from "./handlers/sources/ingest-source-documents-handler";
import { listSourcesHandler } from "./handlers/sources/list-sources-handler";
import { listAccountSourceDocumentsHandler } from "./handlers/sources/list-account-source-documents-handler";
import { listSourceDocumentsHandler } from "./handlers/sources/list-source-documents-handler";
import { fetchSourceHandler } from "./handlers/sources/fetch-source-handler";
import { listSourceFetchRunsHandler } from "./handlers/sources/list-source-fetch-runs-handler";
import { retrySourceFetchRunHandler } from "./handlers/sources/retry-source-fetch-run-handler";
import { executeSourceFetchRunHandler } from "./handlers/sources/execute-source-fetch-run-handler";
import { refreshTrendsHandler } from "./handlers/trends/refresh-trends-handler";
import { listTrendsHandler } from "./handlers/trends/list-trends-handler";
import { listNotificationsHandler } from "./handlers/notifications/list-notifications-handler";
import { getAccountHealthScoreHandler } from "./handlers/health/get-account-health-score-handler";
import { computeAccountHealthScoreHandler } from "./handlers/health/compute-account-health-score-handler";
import { getAccountHealthFactorsHandler } from "./handlers/health/get-account-health-factors-handler";
import { getMonitoringFeedHandler } from "./handlers/monitoring/get-monitoring-feed-handler";
import { getMonitoringOverviewHandler } from "./handlers/monitoring/get-monitoring-overview-handler";
import { retryMonitoringQueueBacklogHandler } from "./handlers/monitoring/retry-monitoring-queue-backlog-handler";
import { getOperationsOverviewHandler } from "./handlers/operations/get-operations-overview-handler";
import { getOperationsHealthHandler } from "./handlers/operations/get-operations-health-handler";
import { cleanupStaleRuntimeProcessesHandler } from "./handlers/operations/cleanup-stale-runtime-processes-handler";
import { listConnectorRequestsHandler } from "./handlers/connector-x/list-connector-requests-handler";
import { listModelRequestsHandler } from "./handlers/agent-runtime/list-model-requests-handler";
import { listAuditLogsHandler } from "./handlers/audit/list-audit-logs-handler";
import { jsonResponse, readJson } from "./json";
import {
  assertResourceWorkspace,
  assertSessionAccess,
  assertSessionUser,
  assertSessionWorkspace,
  readAuthenticatedSessionFromRequest,
} from "./session-auth";
import type { AppContext } from "../bootstrap/build-app-context";
import type { UpdatePersonaInput } from "../../modules/personas/domain/persona";
import type { DistillPersonaRequest } from "../../contracts/api/personas";
import type { GenerateContentBriefRequest } from "../../contracts/api/content-briefs";
import type { UpsertRecurringBriefPlanRequest, UpsertSourceWatchlistRequest } from "../../contracts/api/editorial";

function notFound(): Response {
  return jsonResponse(err(new AppError("NOT_FOUND", "route not found")), { status: 404 });
}

function statusCodeForAppError(error: AppError): number {
  switch (error.code) {
    case "VALIDATION_ERROR":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "INVALID_STATE":
      return 409;
    case "MODEL_RATE_LIMITED":
    case "SOURCE_FETCH_RATE_LIMITED":
      return 429;
    case "MODEL_TIMEOUT":
    case "SOURCE_FETCH_TIMEOUT":
      return 504;
    case "MODEL_UPSTREAM_5XX":
    case "MODEL_NETWORK_ERROR":
    case "MODEL_INVALID_OUTPUT":
    case "MODEL_SCHEMA_VIOLATION":
    case "MODEL_TOOL_PLAN_INVALID":
    case "SOURCE_FETCH_UPSTREAM_5XX":
    case "SOURCE_FETCH_NETWORK_ERROR":
    case "SOURCE_FETCH_INVALID_RESPONSE":
    case "SOURCE_FETCH_SCHEMA_VIOLATION":
    case "EXTERNAL_DEPENDENCY_ERROR":
      return 502;
    case "SOURCE_FETCH_UNSUPPORTED":
      return 409;
    case "INTERNAL_ERROR":
      return 500;
    default:
      return 500;
  }
}

function bindPayloadWorkspace<T extends { workspace_id: string }>(payload: T, session: { workspace_id: string } | null): T {
  if (!session) {
    return payload;
  }

  const workspaceId = payload.workspace_id?.trim();
  if (workspaceId && workspaceId !== session.workspace_id) {
    throw new AppError("FORBIDDEN", "payload workspace_id does not match the authenticated session", {
      details: {
        session_workspace_id: session.workspace_id,
        payload_workspace_id: workspaceId,
      },
    });
  }

  return {
    ...payload,
    workspace_id: session.workspace_id,
  };
}

export async function routeRequest(context: AppContext, request: Request): Promise<Response> {
  const requestId = request.headers.get("x-request-id")?.trim() || newId();
  const session = readAuthenticatedSessionFromRequest(request);
  if (session) {
    await assertSessionAccess(context.sqlite.db, session);
  }

  const response = await context.requestContext.run({
    request_id: requestId,
    authenticated_user_id: session?.user_id,
    authenticated_workspace_id: session?.workspace_id,
  }, async () => {
  const url = new URL(request.url);
  const { pathname } = url;

  try {
    if (request.method === "GET" && pathname === "/workspaces") {
      const result = await listWorkspacesHandler(context.queries.listWorkspaces, session?.user_id);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "POST" && pathname === "/workspaces") {
      const payload = await readJson<CreateWorkspaceRequest>(request);
      const result = await createWorkspaceHandler(context.commands.createWorkspace, payload);
      return jsonResponse(result, { status: result.ok ? 201 : 400 });
    }

    const workspaceMatch = pathname.match(/^\/workspaces\/([^/]+)$/);
    if (request.method === "PUT" && workspaceMatch) {
      const workspaceId = assertSessionWorkspace(session, decodeURIComponent(workspaceMatch[1]))!;
      const payload = await readJson<UpdateWorkspaceRequest>(request);
      const result = await updateWorkspaceHandler(context.commands.updateWorkspace, workspaceId, payload);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const workspaceSettingsMatch = pathname.match(/^\/workspaces\/([^/]+)\/settings$/);
    if (request.method === "GET" && workspaceSettingsMatch) {
      const workspaceId = assertSessionWorkspace(session, decodeURIComponent(workspaceSettingsMatch[1]))!;
      const result = await getWorkspaceSettingsOverviewHandler(context.queries.getWorkspaceSettingsOverview, workspaceId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    const workspaceSurfaceMatch = pathname.match(/^\/workspaces\/([^/]+)\/surface$/);
    if (request.method === "GET" && workspaceSurfaceMatch) {
      const workspaceId = assertSessionWorkspace(session, decodeURIComponent(workspaceSurfaceMatch[1]))!;
      const result = await getWorkspaceSurfaceHandler(context.queries.getWorkspaceSurface, workspaceId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    const workspaceMembersMatch = pathname.match(/^\/workspaces\/([^/]+)\/members$/);
    if (request.method === "POST" && workspaceMembersMatch) {
      const workspaceId = assertSessionWorkspace(session, decodeURIComponent(workspaceMembersMatch[1]))!;
      const payload = await readJson<AddWorkspaceMemberRequest>(request);
      const result = await addWorkspaceMemberHandler(context.commands.addWorkspaceMember, workspaceId, payload);
      return jsonResponse(result, { status: result.ok ? 201 : 400 });
    }

    const workspaceMemberMatch = pathname.match(/^\/workspaces\/([^/]+)\/members\/([^/]+)$/);
    if (request.method === "PUT" && workspaceMemberMatch) {
      const workspaceId = assertSessionWorkspace(session, decodeURIComponent(workspaceMemberMatch[1]))!;
      const userId = decodeURIComponent(workspaceMemberMatch[2]);
      const payload = await readJson<UpdateWorkspaceMemberRoleRequest>(request);
      const result = await updateWorkspaceMemberRoleHandler(context.commands.updateWorkspaceMemberRole, workspaceId, userId, payload);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }
    if (request.method === "DELETE" && workspaceMemberMatch) {
      const workspaceId = assertSessionWorkspace(session, decodeURIComponent(workspaceMemberMatch[1]))!;
      const userId = decodeURIComponent(workspaceMemberMatch[2]);
      const result = await removeWorkspaceMemberHandler(context.commands.removeWorkspaceMember, workspaceId, userId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    if (request.method === "POST" && pathname === "/local-auth/bootstrap") {
      const payload = await readJson<BootstrapLocalAuthRequest>(request);
      const result = await bootstrapLocalSessionHandler(
        context.commands.bootstrapLocalSession,
        context.queries.getUserSessionContext,
        payload,
      );
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const userSessionContextMatch = pathname.match(/^\/users\/([^/]+)\/session-context$/);
    if (request.method === "GET" && userSessionContextMatch) {
      const userId = decodeURIComponent(userSessionContextMatch[1]);
      assertSessionUser(session, userId);
      const result = await getUserSessionContextHandler(context.queries.getUserSessionContext, userId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    if (request.method === "GET" && pathname === "/accounts") {
      const workspaceId = assertSessionWorkspace(session, url.searchParams.get("workspace_id")?.trim() || undefined);
      const result = await listAccountsHandler(context.queries.listAccounts, { workspace_id: workspaceId });
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "GET" && pathname === "/accounts/control-plane") {
      const result = await getAccountsControlPlaneHandler(context.queries.getAccountsControlPlane, session?.workspace_id);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "GET" && pathname === "/account-groups") {
      const workspaceId = assertSessionWorkspace(session, url.searchParams.get("workspace_id")?.trim() || undefined);
      const result = await listAccountGroupsHandler(context.queries.listAccountGroups, { workspace_id: workspaceId });
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "POST" && pathname === "/accounts") {
      const payload = bindPayloadWorkspace(await readJson<CreateAccountRequest>(request), session);
      const result = await createAccountHandler(context.commands.createAccount, payload);
      return jsonResponse(result, { status: result.ok ? 201 : 400 });
    }

    if (request.method === "POST" && pathname === "/accounts/import") {
      const payload = bindPayloadWorkspace(await readJson<ImportAccountsRequest>(request), session);
      const result = await importAccountsHandler(context.commands.importAccounts, payload);
      return jsonResponse(result, { status: result.ok ? 201 : 400 });
    }

    if (request.method === "POST" && pathname === "/account-groups") {
      const payload = bindPayloadWorkspace(await readJson<CreateAccountGroupRequest>(request), session);
      const result = await createAccountGroupHandler(context.commands.createAccountGroup, payload);
      return jsonResponse(result, { status: result.ok ? 201 : 400 });
    }

    if (request.method === "POST" && pathname === "/accounts/group-membership") {
      const payload = await readJson<AssignAccountsToGroupRequest>(request);
      const result = await assignAccountsToGroupHandler(context.commands.assignAccountsToGroup, payload);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const accountMatch = pathname.match(/^\/accounts\/([^/]+)$/);
    const accountSurfaceMatch = pathname.match(/^\/accounts\/([^/]+)\/surface$/);
    const accountAutomationOverviewMatch = pathname.match(/^\/accounts\/([^/]+)\/automation-overview$/);
    const accountAutomationTickMatch = pathname.match(/^\/accounts\/([^/]+)\/automation\/tick$/);
    const accountAutomationPauseMatch = pathname.match(/^\/accounts\/([^/]+)\/automation\/pause$/);
    const accountAutomationResumeMatch = pathname.match(/^\/accounts\/([^/]+)\/automation\/resume$/);
    if (request.method === "GET" && accountSurfaceMatch) {
      const accountId = decodeURIComponent(accountSurfaceMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await getAccountSurfaceHandler(context.queries.getAccountSurface, accountId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }
    if (request.method === "GET" && accountAutomationOverviewMatch) {
      const accountId = decodeURIComponent(accountAutomationOverviewMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await getAccountAutomationOverviewHandler(context.queries.getAccountAutomationOverview, accountId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }
    if (request.method === "POST" && accountAutomationTickMatch) {
      const accountId = decodeURIComponent(accountAutomationTickMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await queueAccountAutomationTickHandler(context.commands.queueAccountAutomationTick, accountId);
      return jsonResponse(result, { status: result.ok ? 202 : 400 });
    }
    if (request.method === "POST" && accountAutomationPauseMatch) {
      const accountId = decodeURIComponent(accountAutomationPauseMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await pauseAccountAutomationHandler(context.commands.pauseAccountAutomation, accountId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }
    if (request.method === "POST" && accountAutomationResumeMatch) {
      const accountId = decodeURIComponent(accountAutomationResumeMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await resumeAccountAutomationHandler(context.commands.resumeAccountAutomation, accountId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }
    if (request.method === "DELETE" && accountMatch) {
      const accountId = decodeURIComponent(accountMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await deleteAccountHandler(context.commands.deleteAccount, accountId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const autopostPolicyMatch = pathname.match(/^\/autopost-policies\/([^/]+)$/);
    const autopostRunsMatch = pathname.match(/^\/autopost-policies\/([^/]+)\/runs$/);
    const autopostExecuteMatch = pathname.match(/^\/autopost-policies\/([^/]+)\/execute$/);
    if (request.method === "GET" && autopostPolicyMatch) {
      const accountId = decodeURIComponent(autopostPolicyMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await getAutopostPolicyHandler(context.queries.getAutopostPolicy, accountId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }
    if (request.method === "GET" && autopostRunsMatch) {
      const accountId = decodeURIComponent(autopostRunsMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const limit = Number(url.searchParams.get("limit") ?? "20");
      const result = await listAutopostRunsHandler(context.queries.listAutopostRuns, accountId, limit);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }
    if (request.method === "PUT" && autopostPolicyMatch) {
      const accountId = decodeURIComponent(autopostPolicyMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const payload = await readJson<UpsertAutopostPolicyRequest>(request);
      const result = await upsertAutopostPolicyHandler(context.commands.upsertAutopostPolicy, accountId, payload);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }
    if (request.method === "POST" && autopostExecuteMatch) {
      const accountId = decodeURIComponent(autopostExecuteMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await executeAutopostPolicyHandler(context.commands.executeAutopostPolicy, accountId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "GET" && pathname === "/alert-channels") {
      const workspaceId = assertSessionWorkspace(session, url.searchParams.get("workspace_id") ?? undefined);
      if (!workspaceId) {
        throw new AppError("VALIDATION_ERROR", "workspace_id is required");
      }

      const limit = Number(url.searchParams.get("limit") ?? "50");
      const result = await listAlertChannelsHandler(context.queries.listAlertChannels, {
        workspace_id: workspaceId,
        limit,
      });
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "POST" && pathname === "/alert-channels") {
      const payload = bindPayloadWorkspace(await readJson<CreateAlertChannelRequest>(request), session);
      const result = await createAlertChannelHandler(context.commands.createAlertChannel, payload);
      return jsonResponse(result, { status: result.ok ? 201 : 400 });
    }

    const alertChannelMatch = pathname.match(/^\/alert-channels\/([^/]+)$/);
    if (request.method === "PUT" && alertChannelMatch) {
      const channelId = decodeURIComponent(alertChannelMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "alert_channel", id: channelId });
      const payload = await readJson<UpdateAlertChannelRequest>(request);
      const result = await updateAlertChannelHandler(context.commands.updateAlertChannel, channelId, payload);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }
    if (request.method === "DELETE" && alertChannelMatch) {
      const channelId = decodeURIComponent(alertChannelMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "alert_channel", id: channelId });
      const result = await deleteAlertChannelHandler(context.commands.deleteAlertChannel, channelId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    const credentialUpsertMatch = pathname.match(/^\/accounts\/([^/]+)\/credentials$/);
    if (request.method === "POST" && credentialUpsertMatch) {
      const accountId = decodeURIComponent(credentialUpsertMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const payload = await readJson<UpsertAccountCredentialRequest>(request);
      const result = await upsertAccountCredentialHandler(context.commands.upsertAccountCredential, accountId, payload);
      return jsonResponse(result, { status: result.ok ? 201 : 400 });
    }

    const credentialValidateMatch = pathname.match(/^\/accounts\/([^/]+)\/credentials\/validate$/);
    if (request.method === "POST" && credentialValidateMatch) {
      const accountId = decodeURIComponent(credentialValidateMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await validateAccountCredentialHandler(context.commands.validateAccountCredential, accountId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const createPostMatch = pathname.match(/^\/accounts\/([^/]+)\/posts$/);
    if (request.method === "POST" && createPostMatch) {
      const accountId = decodeURIComponent(createPostMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const payload = await readJson<{ text: string }>(request);
      const result = await createPostHandler(context.commands.createPost, {
        account_id: accountId,
        text: payload.text,
      });
      return jsonResponse(result, { status: result.ok ? 201 : 400 });
    }

    const syncAccountProfileMatch = pathname.match(/^\/accounts\/([^/]+)\/profile\/sync$/);
    if (request.method === "POST" && syncAccountProfileMatch) {
      const accountId = decodeURIComponent(syncAccountProfileMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await getAccountProfileHandler(context.commands.getAccountProfile, accountId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const generateDraftMatch = pathname.match(/^\/accounts\/([^/]+)\/drafts\/generate$/);
    if (request.method === "POST" && generateDraftMatch) {
      const accountId = decodeURIComponent(generateDraftMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const payload = await readJson<import("../../contracts/api/drafts").GenerateDraftRequest>(request);
      const result = await generateDraftHandler(context.commands.generateDraft, accountId, payload);
      return jsonResponse(result, { status: result.ok ? 202 : 400 });
    }

    const accountContentBriefsMatch = pathname.match(/^\/accounts\/([^/]+)\/content-briefs$/);
    const accountBriefWorkbenchMatch = pathname.match(/^\/accounts\/([^/]+)\/brief-workbench$/);
    const accountSourceWatchlistsMatch = pathname.match(/^\/accounts\/([^/]+)\/source-watchlists$/);
    const accountRecurringBriefPlansMatch = pathname.match(/^\/accounts\/([^/]+)\/recurring-brief-plans$/);
    if (request.method === "GET" && accountBriefWorkbenchMatch) {
      const accountId = decodeURIComponent(accountBriefWorkbenchMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await getBriefWorkbenchHandler(context.queries.getBriefWorkbench, {
        account_id: accountId,
        selected_brief_id: url.searchParams.get("selected_brief_id") ?? undefined,
        source_id: url.searchParams.get("source_id") ?? undefined,
        source_type: url.searchParams.get("source_type") as import("../../modules/sources/domain/source").Source["type"] | undefined,
        source_status: url.searchParams.get("source_status") as import("../../modules/sources/domain/source").Source["status"] | undefined,
        query: url.searchParams.get("query") ?? undefined,
        published_from: url.searchParams.get("published_from") ?? undefined,
        published_to: url.searchParams.get("published_to") ?? undefined,
        brief_limit: Number(url.searchParams.get("brief_limit") ?? "50"),
        document_limit: Number(url.searchParams.get("document_limit") ?? "120"),
      });
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "GET" && accountContentBriefsMatch) {
      const accountId = decodeURIComponent(accountContentBriefsMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const limit = Number(url.searchParams.get("limit") ?? "50");
      const result = await listContentBriefsHandler(context.queries.listContentBriefs, {
        account_id: accountId,
        limit,
      });
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "POST" && accountContentBriefsMatch) {
      const accountId = decodeURIComponent(accountContentBriefsMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const payload = await readJson<GenerateContentBriefRequest>(request);
      const result = await generateContentBriefHandler(context.commands.generateContentBrief, accountId, payload);
      return jsonResponse(result, { status: result.ok ? 202 : 400 });
    }

    if (request.method === "GET" && accountSourceWatchlistsMatch) {
      const accountId = decodeURIComponent(accountSourceWatchlistsMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await listSourceWatchlistsHandler(context.queries.listSourceWatchlists, accountId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "POST" && accountSourceWatchlistsMatch) {
      const accountId = decodeURIComponent(accountSourceWatchlistsMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const payload = await readJson<UpsertSourceWatchlistRequest>(request);
      const result = await upsertSourceWatchlistHandler(context.commands.upsertSourceWatchlist, accountId, payload);
      return jsonResponse(result, { status: result.ok ? 201 : 400 });
    }

    if (request.method === "GET" && accountRecurringBriefPlansMatch) {
      const accountId = decodeURIComponent(accountRecurringBriefPlansMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await listRecurringBriefPlansHandler(context.queries.listRecurringBriefPlans, accountId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "POST" && accountRecurringBriefPlansMatch) {
      const accountId = decodeURIComponent(accountRecurringBriefPlansMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const payload = await readJson<UpsertRecurringBriefPlanRequest>(request);
      const result = await upsertRecurringBriefPlanHandler(context.commands.upsertRecurringBriefPlan, accountId, payload);
      return jsonResponse(result, { status: result.ok ? 201 : 400 });
    }

    const accountSourceDocumentsMatch = pathname.match(/^\/accounts\/([^/]+)\/source-documents$/);
    if (request.method === "GET" && accountSourceDocumentsMatch) {
      const accountId = decodeURIComponent(accountSourceDocumentsMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await listAccountSourceDocumentsHandler(context.queries.listAccountSourceDocuments, {
        account_id: accountId,
        source_id: url.searchParams.get("source_id") ?? undefined,
        source_type: url.searchParams.get("source_type") as import("../../modules/sources/domain/source").Source["type"] | undefined,
        source_status: url.searchParams.get("source_status") as import("../../modules/sources/domain/source").Source["status"] | undefined,
        query: url.searchParams.get("query") ?? undefined,
        published_from: url.searchParams.get("published_from") ?? undefined,
        published_to: url.searchParams.get("published_to") ?? undefined,
        limit: Number(url.searchParams.get("limit") ?? "100"),
      });
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const contentBriefMatch = pathname.match(/^\/content-briefs\/([^/]+)$/);
    if (request.method === "GET" && contentBriefMatch) {
      const briefId = decodeURIComponent(contentBriefMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "brief", id: briefId });
      const result = await getContentBriefHandler(context.queries.getContentBrief, briefId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    const contentBriefEvidenceMatch = pathname.match(/^\/content-briefs\/([^/]+)\/evidence$/);
    if (request.method === "GET" && contentBriefEvidenceMatch) {
      const briefId = decodeURIComponent(contentBriefEvidenceMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "brief", id: briefId });
      const result = await getContentBriefEvidenceHandler(context.queries.getContentBriefEvidence, briefId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    const contentBriefArchiveMatch = pathname.match(/^\/content-briefs\/([^/]+)\/archive$/);
    if (request.method === "POST" && contentBriefArchiveMatch) {
      const briefId = decodeURIComponent(contentBriefArchiveMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "brief", id: briefId });
      const result = await archiveContentBriefHandler(context.commands.archiveContentBrief, briefId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const contentBriefRegenerateMatch = pathname.match(/^\/content-briefs\/([^/]+)\/regenerate$/);
    if (request.method === "POST" && contentBriefRegenerateMatch) {
      const briefId = decodeURIComponent(contentBriefRegenerateMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "brief", id: briefId });
      const result = await regenerateContentBriefHandler(context.commands.regenerateContentBrief, briefId);
      return jsonResponse(result, { status: result.ok ? 202 : 400 });
    }

    const contentBriefGenerateDraftMatch = pathname.match(/^\/content-briefs\/([^/]+)\/drafts\/generate$/);
    if (request.method === "POST" && contentBriefGenerateDraftMatch) {
      const briefId = decodeURIComponent(contentBriefGenerateDraftMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "brief", id: briefId });
      const result = await generateDraftFromContentBriefHandler(context.commands.generateDraftFromContentBrief, briefId);
      return jsonResponse(result, { status: result.ok ? 202 : 400 });
    }

    const sourceWatchlistMatch = pathname.match(/^\/accounts\/([^/]+)\/source-watchlists\/([^/]+)$/);
    if (request.method === "PUT" && sourceWatchlistMatch) {
      const accountId = decodeURIComponent(sourceWatchlistMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const watchlistId = decodeURIComponent(sourceWatchlistMatch[2]);
      const payload = await readJson<UpsertSourceWatchlistRequest>(request);
      const result = await upsertSourceWatchlistHandler(context.commands.upsertSourceWatchlist, accountId, payload, watchlistId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }
    if (request.method === "DELETE" && sourceWatchlistMatch) {
      const watchlistId = decodeURIComponent(sourceWatchlistMatch[2]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "source_watchlist", id: watchlistId });
      const result = await removeSourceWatchlistHandler(context.commands.removeSourceWatchlist, watchlistId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const recurringBriefPlanMatch = pathname.match(/^\/accounts\/([^/]+)\/recurring-brief-plans\/([^/]+)$/);
    if (request.method === "PUT" && recurringBriefPlanMatch) {
      const accountId = decodeURIComponent(recurringBriefPlanMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const planId = decodeURIComponent(recurringBriefPlanMatch[2]);
      const payload = await readJson<UpsertRecurringBriefPlanRequest>(request);
      const result = await upsertRecurringBriefPlanHandler(context.commands.upsertRecurringBriefPlan, accountId, payload, planId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }
    if (request.method === "DELETE" && recurringBriefPlanMatch) {
      const planId = decodeURIComponent(recurringBriefPlanMatch[2]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "recurring_brief_plan", id: planId });
      const result = await removeRecurringBriefPlanHandler(context.commands.removeRecurringBriefPlan, planId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const recurringBriefPlanRunNowMatch = pathname.match(/^\/accounts\/([^/]+)\/recurring-brief-plans\/([^/]+)\/run-now$/);
    if (request.method === "POST" && recurringBriefPlanRunNowMatch) {
      const planId = decodeURIComponent(recurringBriefPlanRunNowMatch[2]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "recurring_brief_plan", id: planId });
      const result = await executeRecurringBriefPlanHandler(context.commands.executeRecurringBriefPlan, planId);
      return jsonResponse(result, { status: result.ok ? 202 : 400 });
    }

    const pullMentionsMatch = pathname.match(/^\/accounts\/([^/]+)\/mentions\/pull$/);
    if (request.method === "POST" && pullMentionsMatch) {
      const accountId = decodeURIComponent(pullMentionsMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await pullMentionsHandler(context.commands.queuePullMentionsJob, accountId);
      return jsonResponse(result, { status: result.ok ? 202 : 400 });
    }

    const pullDirectMessagesMatch = pathname.match(/^\/accounts\/([^/]+)\/direct-messages\/pull$/);
    if (request.method === "POST" && pullDirectMessagesMatch) {
      const accountId = decodeURIComponent(pullDirectMessagesMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await pullDirectMessagesHandler(context.commands.queuePullDirectMessagesJob, accountId);
      return jsonResponse(result, { status: result.ok ? 202 : 400 });
    }

    const accountEngagementThreadsMatch = pathname.match(/^\/accounts\/([^/]+)\/engagement-threads$/);
    const accountEngagementWorkbenchMatch = pathname.match(/^\/accounts\/([^/]+)\/engagement-workbench$/);
    if (request.method === "GET" && accountEngagementWorkbenchMatch) {
      const accountId = decodeURIComponent(accountEngagementWorkbenchMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await getEngagementWorkbenchHandler(context.queries.getEngagementWorkbench, {
        account_id: accountId,
        thread_id: url.searchParams.get("thread_id") ?? undefined,
        channel: url.searchParams.get("channel") as import("../../modules/engagement/domain/engagement-thread").EngagementChannel | undefined,
        classification: url.searchParams.get("classification") as import("../../modules/engagement/domain/engagement-thread").EngagementClassification | undefined,
        status: url.searchParams.get("status") as import("../../modules/engagement/domain/engagement-thread").EngagementThreadStatus | undefined,
        limit: Number(url.searchParams.get("limit") ?? "100"),
      });
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "GET" && accountEngagementThreadsMatch) {
      const accountId = decodeURIComponent(accountEngagementThreadsMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const channel = url.searchParams.get("channel") ?? undefined;
      const classification = url.searchParams.get("classification") ?? undefined;
      const status = url.searchParams.get("status") ?? undefined;
      const limit = Number(url.searchParams.get("limit") ?? "100");
      const result = await listAccountEngagementThreadsHandler(context.queries.listAccountEngagementThreads, {
        account_id: accountId,
        channel: channel as import("../../modules/engagement/domain/engagement-thread").EngagementChannel | undefined,
        classification: classification as import("../../modules/engagement/domain/engagement-thread").EngagementClassification | undefined,
        status: status as import("../../modules/engagement/domain/engagement-thread").EngagementThreadStatus | undefined,
        limit,
      });
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "GET" && pathname === "/messages") {
      const threadId = url.searchParams.get("thread_id");
      if (!threadId) {
        throw new AppError("VALIDATION_ERROR", "thread_id is required");
      }

      await assertResourceWorkspace(context.sqlite.db, session, { type: "engagement_thread", id: threadId });
      const result = await listEngagementMessagesHandler(context.queries.listEngagementMessages, threadId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    const engagementThreadMatch = pathname.match(/^\/engagement-threads\/([^/]+)$/);
    if (request.method === "GET" && engagementThreadMatch) {
      const threadId = decodeURIComponent(engagementThreadMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "engagement_thread", id: threadId });
      const result = await getEngagementThreadHandler(context.queries.getEngagementThread, threadId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    const threadReplyProposalsMatch = pathname.match(/^\/engagement-threads\/([^/]+)\/reply-proposals$/);
    if (request.method === "GET" && threadReplyProposalsMatch) {
      const threadId = decodeURIComponent(threadReplyProposalsMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "engagement_thread", id: threadId });
      const result = await listThreadReplyProposalsHandler(context.queries.listThreadReplyProposals, threadId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    const generateReplyProposalMatch = pathname.match(/^\/engagement-threads\/([^/]+)\/reply-proposals\/generate$/);
    if (request.method === "POST" && generateReplyProposalMatch) {
      const threadId = decodeURIComponent(generateReplyProposalMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "engagement_thread", id: threadId });
      const result = await generateReplyProposalHandler(context.commands.generateReplyProposal, threadId);
      return jsonResponse(result, { status: result.ok ? 202 : 400 });
    }

    const classifyInboxThreadMatch = pathname.match(/^\/engagement-threads\/([^/]+)\/classify$/);
    if (request.method === "POST" && classifyInboxThreadMatch) {
      const threadId = decodeURIComponent(classifyInboxThreadMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "engagement_thread", id: threadId });
      const result = await classifyInboxThreadHandler(context.commands.classifyInboxThread, threadId);
      return jsonResponse(result, { status: result.ok ? 202 : 400 });
    }

    const replyProposalMatch = pathname.match(/^\/reply-proposals\/([^/]+)$/);
    if (request.method === "GET" && replyProposalMatch) {
      const proposalId = decodeURIComponent(replyProposalMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "reply_proposal", id: proposalId });
      const result = await getReplyProposalHandler(context.queries.getReplyProposal, proposalId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    const approveReplyProposalMatch = pathname.match(/^\/reply-proposals\/([^/]+)\/approve$/);
    if (request.method === "POST" && approveReplyProposalMatch) {
      const proposalId = decodeURIComponent(approveReplyProposalMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "reply_proposal", id: proposalId });
      const result = await approveReplyProposalHandler(context.commands.approveReplyProposal, proposalId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const sendReplyProposalMatch = pathname.match(/^\/reply-proposals\/([^/]+)\/send$/);
    if (request.method === "POST" && sendReplyProposalMatch) {
      const proposalId = decodeURIComponent(sendReplyProposalMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "reply_proposal", id: proposalId });
      const result = await sendReplyProposalHandler(context.commands.queueSendReplyProposalJob, proposalId);
      return jsonResponse(result, { status: result.ok ? 202 : 400 });
    }

    const personaMatch = pathname.match(/^\/personas\/([^/]+)$/);
    if (request.method === "GET" && personaMatch) {
      const accountId = decodeURIComponent(personaMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await getPersonaHandler(context.queries.getPersona, accountId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }
    if (request.method === "PUT" && personaMatch) {
      const accountId = decodeURIComponent(personaMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const payload = await readJson<Omit<UpdatePersonaInput, "account_id">>(request);
      const result = await updatePersonaHandler(context.commands.updatePersona, {
        ...payload,
        account_id: accountId,
      });
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const distillPersonaMatch = pathname.match(/^\/accounts\/([^/]+)\/persona\/distill$/);
    if (request.method === "POST" && distillPersonaMatch) {
      const accountId = decodeURIComponent(distillPersonaMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const payload = await readJson<DistillPersonaRequest>(request);
      const result = await distillPersonaHandler(context.commands.distillPersona, accountId, payload);
      return jsonResponse(result, { status: result.ok ? 202 : 400 });
    }

    if (request.method === "GET" && pathname === "/persona-templates") {
      const workspaceId = assertSessionWorkspace(session, url.searchParams.get("workspace_id")?.trim() || undefined);
      if (!workspaceId) {
        return jsonResponse(err(new AppError("VALIDATION_ERROR", "workspace_id is required", {
          details: { field: "workspace_id" },
        })), { status: 400 });
      }

      const result = await listPersonaTemplatesHandler(context.queries.listPersonaTemplates, {
        workspace_id: workspaceId,
      });
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "POST" && pathname === "/persona-templates") {
      const payload = bindPayloadWorkspace(await readJson<CreatePersonaTemplateRequest>(request), session);
      const result = await createPersonaTemplateHandler(context.commands.createPersonaTemplate, payload);
      return jsonResponse(result, { status: result.ok ? 201 : 400 });
    }

    const personaTemplateApplyMatch = pathname.match(/^\/persona-templates\/([^/]+)\/apply$/);
    if (request.method === "POST" && personaTemplateApplyMatch) {
      const templateId = decodeURIComponent(personaTemplateApplyMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "persona_template", id: templateId });
      const payload = await readJson<ApplyPersonaTemplateRequest>(request);
      const result = await applyPersonaTemplateHandler(context.commands.applyPersonaTemplate, templateId, payload);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const accountSourcesMatch = pathname.match(/^\/accounts\/([^/]+)\/sources$/);
    if (request.method === "GET" && accountSourcesMatch) {
      const accountId = decodeURIComponent(accountSourcesMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await listSourcesHandler(context.queries.listSources, accountId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }
    if (request.method === "POST" && accountSourcesMatch) {
      const accountId = decodeURIComponent(accountSourcesMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const payload = await readJson<import("../../contracts/api/sources").AddSourceRequest>(request);
      const result = await addSourceHandler(context.commands.addSource, accountId, payload);
      return jsonResponse(result, { status: result.ok ? 201 : 400 });
    }

    const sourceDeleteMatch = pathname.match(/^\/sources\/([^/]+)$/);
    if (request.method === "DELETE" && sourceDeleteMatch) {
      const sourceId = decodeURIComponent(sourceDeleteMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "source", id: sourceId });
      const result = await removeSourceHandler(context.commands.removeSource, sourceId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    const sourcePauseMatch = pathname.match(/^\/sources\/([^/]+)\/pause$/);
    if (request.method === "POST" && sourcePauseMatch) {
      const sourceId = decodeURIComponent(sourcePauseMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "source", id: sourceId });
      const result = await pauseSourceHandler(context.commands.pauseSource, sourceId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const sourceResumeMatch = pathname.match(/^\/sources\/([^/]+)\/resume$/);
    if (request.method === "POST" && sourceResumeMatch) {
      const sourceId = decodeURIComponent(sourceResumeMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "source", id: sourceId });
      const result = await resumeSourceHandler(context.commands.resumeSource, sourceId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const sourceDocumentsMatch = pathname.match(/^\/sources\/([^/]+)\/documents$/);
    if (request.method === "GET" && sourceDocumentsMatch) {
      const sourceId = decodeURIComponent(sourceDocumentsMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "source", id: sourceId });
      const result = await listSourceDocumentsHandler(context.queries.listSourceDocuments, sourceId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    const sourceFetchRunsMatch = pathname.match(/^\/sources\/([^/]+)\/fetch-runs$/);
    if (request.method === "GET" && sourceFetchRunsMatch) {
      const sourceId = decodeURIComponent(sourceFetchRunsMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "source", id: sourceId });
      const result = await listSourceFetchRunsHandler(context.queries.listSourceFetchRuns, sourceId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    const sourceIngestMatch = pathname.match(/^\/sources\/([^/]+)\/documents\/ingest$/);
    if (request.method === "POST" && sourceIngestMatch) {
      const sourceId = decodeURIComponent(sourceIngestMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "source", id: sourceId });
      const payload = await readJson<import("../../contracts/api/sources").IngestSourceDocumentsRequest>(request);
      const result = await ingestSourceDocumentsHandler(context.commands.ingestSourceDocuments, sourceId, payload);
      return jsonResponse(result, { status: result.ok ? 201 : 400 });
    }

    const sourceFetchMatch = pathname.match(/^\/sources\/([^/]+)\/fetch$/);
    if (request.method === "POST" && sourceFetchMatch) {
      const sourceId = decodeURIComponent(sourceFetchMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "source", id: sourceId });
      const result = await fetchSourceHandler(context.commands.fetchSource, sourceId);
      return jsonResponse(result, { status: result.ok ? 202 : 400 });
    }

    const retrySourceFetchRunMatch = pathname.match(/^\/source-fetch-runs\/([^/]+)\/retry$/);
    if (request.method === "POST" && retrySourceFetchRunMatch) {
      const runId = decodeURIComponent(retrySourceFetchRunMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "source_fetch_run", id: runId });
      const executeNow = url.searchParams.get("execute_now") === "1";
      const result = await retrySourceFetchRunHandler(
        context.commands.retrySourceFetchRun,
        context.commands.executeSourceFetchRun,
        runId,
        { execute_now: executeNow },
      );
      return jsonResponse(result, { status: result.ok ? (executeNow ? 200 : 202) : 400 });
    }

    const executeSourceFetchRunMatch = pathname.match(/^\/source-fetch-runs\/([^/]+)\/execute$/);
    if (request.method === "POST" && executeSourceFetchRunMatch) {
      const runId = decodeURIComponent(executeSourceFetchRunMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "source_fetch_run", id: runId });
      const result = await executeSourceFetchRunHandler(context.commands.executeSourceFetchRun, runId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const refreshTrendsMatch = pathname.match(/^\/workspaces\/([^/]+)\/trends\/refresh$/);
    if (request.method === "POST" && refreshTrendsMatch) {
      const workspaceId = assertSessionWorkspace(session, decodeURIComponent(refreshTrendsMatch[1]))!;
      const result = await refreshTrendsHandler(context.commands.refreshTrends, workspaceId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "GET" && pathname === "/trends") {
      const workspaceId = assertSessionWorkspace(session, url.searchParams.get("workspace_id") ?? undefined);
      if (!workspaceId) {
        throw new AppError("VALIDATION_ERROR", "workspace_id is required");
      }

      const result = await listTrendsHandler(context.queries.listTrends, workspaceId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "GET" && pathname === "/dashboard/overview") {
      const workspaceId = assertSessionWorkspace(session, url.searchParams.get("workspace_id") ?? undefined);
      if (!workspaceId) {
        throw new AppError("VALIDATION_ERROR", "workspace_id is required");
      }

      const result = await getDashboardOverviewHandler(context.queries.getDashboardOverview, workspaceId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "GET" && pathname === "/app-chrome/overview") {
      const workspaceId = assertSessionWorkspace(session, url.searchParams.get("workspace_id") ?? undefined);
      if (!workspaceId) {
        throw new AppError("VALIDATION_ERROR", "workspace_id is required");
      }

      const notificationLimit = Number(url.searchParams.get("notification_limit") ?? "8");
      const groupLimit = Number(url.searchParams.get("group_limit") ?? "8");
      const result = await getAppChromeOverviewHandler(context.queries.getAppChromeOverview, {
        workspace_id: workspaceId,
        notification_limit: notificationLimit,
        group_limit: groupLimit,
      });
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "GET" && pathname === "/app-chrome/search") {
      const workspaceId = assertSessionWorkspace(session, url.searchParams.get("workspace_id") ?? undefined);
      if (!workspaceId) {
        throw new AppError("VALIDATION_ERROR", "workspace_id is required");
      }

      const query = url.searchParams.get("query") ?? "";
      const limit = Number(url.searchParams.get("limit") ?? "24");
      const result = await searchAppCommandTargetsHandler(context.queries.searchAppCommandTargets, {
        workspace_id: workspaceId,
        query,
        limit,
      });
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "GET" && pathname === "/notifications") {
      const workspaceId = assertSessionWorkspace(session, url.searchParams.get("workspace_id") ?? undefined);
      if (!workspaceId) {
        throw new AppError("VALIDATION_ERROR", "workspace_id is required");
      }

      const limit = Number(url.searchParams.get("limit") ?? "20");
      const result = await listNotificationsHandler(context.queries.listNotifications, workspaceId, limit);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "GET" && pathname === "/monitoring-feed") {
      const workspaceId = assertSessionWorkspace(session, url.searchParams.get("workspace_id") ?? undefined);
      if (!workspaceId) {
        throw new AppError("VALIDATION_ERROR", "workspace_id is required");
      }

      const limit = Number(url.searchParams.get("limit") ?? "20");
      const result = await getMonitoringFeedHandler(context.queries.getMonitoringFeed, workspaceId, limit);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "GET" && pathname === "/monitoring/overview") {
      const workspaceId = assertSessionWorkspace(session, url.searchParams.get("workspace_id") ?? undefined);
      if (!workspaceId) {
        throw new AppError("VALIDATION_ERROR", "workspace_id is required");
      }

      const limit = Number(url.searchParams.get("limit") ?? "20");
      const result = await getMonitoringOverviewHandler(context.queries.getMonitoringOverview, workspaceId, limit);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "POST" && pathname === "/monitoring/queues/retry") {
      const payload = bindPayloadWorkspace(await readJson<RetryMonitoringQueueBacklogRequest>(request), session);
      const result = await retryMonitoringQueueBacklogHandler(context.commands.retryMonitoringQueueBacklog, payload);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "GET" && pathname === "/ops/overview") {
      const limit = Number(url.searchParams.get("limit") ?? "20");
      const result = await getOperationsOverviewHandler(context.queries.getOperationsOverview, limit);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "GET" && pathname === "/ops/health") {
      const result = await getOperationsHealthHandler(context.queries.getOperationsHealth);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "POST" && pathname === "/ops/runtime-processes/cleanup") {
      const payload = await readJson<import("../../contracts/api/operations").CleanupStaleRuntimeProcessesRequest>(request);
      const result = await cleanupStaleRuntimeProcessesHandler(context.commands.cleanupStaleRuntimeProcesses, payload);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "GET" && pathname === "/connector-requests") {
      const workspaceId = assertSessionWorkspace(session, url.searchParams.get("workspace_id") ?? undefined);
      if (!workspaceId) {
        throw new AppError("VALIDATION_ERROR", "workspace_id is required");
      }

      const accountId = url.searchParams.get("account_id") ?? undefined;
      const limit = Number(url.searchParams.get("limit") ?? "20");
      const result = await listConnectorRequestsHandler(context.queries.listConnectorRequests, workspaceId, limit, accountId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "GET" && pathname === "/model-requests") {
      const workspaceId = assertSessionWorkspace(session, url.searchParams.get("workspace_id") ?? undefined);
      if (!workspaceId) {
        throw new AppError("VALIDATION_ERROR", "workspace_id is required");
      }

      const limit = Number(url.searchParams.get("limit") ?? "20");
      const result = await listModelRequestsHandler(context.queries.listModelRequests, workspaceId, limit);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "GET" && pathname === "/audit-logs") {
      const workspaceId = assertSessionWorkspace(session, url.searchParams.get("workspace_id") ?? undefined);
      if (!workspaceId) {
        throw new AppError("VALIDATION_ERROR", "workspace_id is required");
      }

      const entityType = url.searchParams.get("entity_type") ?? undefined;
      const entityId = url.searchParams.get("entity_id") ?? undefined;
      const limit = Number(url.searchParams.get("limit") ?? "20");
      const result = await listAuditLogsHandler(
        context.queries.listAuditLogs,
        workspaceId,
        limit,
        entityType,
        entityId,
      );
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "GET" && pathname === "/schedules") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      if (!from || !to) {
        throw new AppError("VALIDATION_ERROR", "from and to are required");
      }

      const workspaceId = assertSessionWorkspace(session, url.searchParams.get("workspace_id") ?? undefined);
      const accountId = url.searchParams.get("account_id") ?? undefined;
      const status = url.searchParams.get("status") ?? undefined;
      const limit = Number(url.searchParams.get("limit") ?? "500");
      const result = await listSchedulesInRangeHandler(context.queries.listSchedulesInRange, {
        workspace_id: workspaceId,
        account_id: accountId,
        status: status as import("../../modules/schedules/domain/publish-schedule").PublishScheduleStatus | undefined,
        from,
        to,
        limit,
      });
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const accountHealthMatch = pathname.match(/^\/accounts\/([^/]+)\/health-score$/);
    if (request.method === "GET" && accountHealthMatch) {
      const accountId = decodeURIComponent(accountHealthMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await getAccountHealthScoreHandler(context.queries.getAccountHealthScore, accountId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }
    if (request.method === "POST" && accountHealthMatch) {
      const accountId = decodeURIComponent(accountHealthMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await computeAccountHealthScoreHandler(context.commands.computeAccountHealthScore, accountId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const accountHealthFactorsMatch = pathname.match(/^\/accounts\/([^/]+)\/health-score\/factors$/);
    if (request.method === "GET" && accountHealthFactorsMatch) {
      const accountId = decodeURIComponent(accountHealthFactorsMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await getAccountHealthFactorsHandler(context.queries.getAccountHealthFactors, accountId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    const accountAnalyticsMatch = pathname.match(/^\/accounts\/([^/]+)\/analytics$/);
    if (request.method === "GET" && accountAnalyticsMatch) {
      const accountId = decodeURIComponent(accountAnalyticsMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const windowDays = Number(url.searchParams.get("window_days") ?? "30");
      const result = await getAccountAnalyticsHandler(context.queries.getAccountAnalytics, accountId, windowDays);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const engagementPolicyMatch = pathname.match(/^\/engagement-policies\/([^/]+)$/);
    if (request.method === "GET" && engagementPolicyMatch) {
      const accountId = decodeURIComponent(engagementPolicyMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await getEngagementPolicyHandler(context.queries.getEngagementPolicy, accountId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }
    if (request.method === "PUT" && engagementPolicyMatch) {
      const accountId = decodeURIComponent(engagementPolicyMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const payload = await readJson<import("../../contracts/api/engagement-policies").UpsertEngagementPolicyRequest>(request);
      const result = await upsertEngagementPolicyHandler(context.commands.upsertEngagementPolicy, accountId, payload);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const approveDraftMatch = pathname.match(/^\/drafts\/([^/]+)\/approve$/);
    if (request.method === "POST" && approveDraftMatch) {
      const draftId = decodeURIComponent(approveDraftMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "draft", id: draftId });
      const payload = await readJson<ApproveDraftRequest>(request);
      const result = await approveDraftHandler(context.commands.approveDraft, draftId, payload);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const requestDraftRegenerationMatch = pathname.match(/^\/drafts\/([^/]+)\/request-regenerate$/);
    if (request.method === "POST" && requestDraftRegenerationMatch) {
      const draftId = decodeURIComponent(requestDraftRegenerationMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "draft", id: draftId });
      const payload = await readJson<RequestDraftRegenerationRequest>(request);
      const result = await requestDraftRegenerationHandler(context.commands.requestDraftRegeneration, draftId, payload);
      return jsonResponse(result, { status: result.ok ? 202 : 400 });
    }

    if (request.method === "GET" && pathname === "/drafts") {
      const workspaceId = assertSessionWorkspace(session, url.searchParams.get("workspace_id")?.trim() || undefined);
      const accountId = url.searchParams.get("account_id")?.trim() || undefined;
      const status = url.searchParams.get("status")?.trim() || undefined;
      const limit = url.searchParams.has("limit")
        ? Number(url.searchParams.get("limit"))
        : undefined;
      const result = await listDraftsHandler(context.queries.listDrafts, {
        workspace_id: workspaceId,
        account_id: accountId,
        status: status as import("../../modules/drafts/domain/draft").DraftStatus | undefined,
        limit,
      });
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    if (request.method === "GET" && pathname === "/draft-reviews") {
      const draftId = url.searchParams.get("draft_id");
      if (!draftId) {
        throw new AppError("VALIDATION_ERROR", "draft_id is required");
      }

      await assertResourceWorkspace(context.sqlite.db, session, { type: "draft", id: draftId });
      const result = await listDraftReviewsHandler(context.queries.listDraftReviews, draftId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    const accountDraftWorkbenchMatch = pathname.match(/^\/accounts\/([^/]+)\/draft-workbench$/);
    if (request.method === "GET" && accountDraftWorkbenchMatch) {
      const accountId = decodeURIComponent(accountDraftWorkbenchMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "account", id: accountId });
      const result = await getDraftWorkbenchHandler(context.queries.getDraftWorkbench, {
        account_id: accountId,
        selected_brief_id: url.searchParams.get("selected_brief_id") ?? undefined,
        draft_limit: Number(url.searchParams.get("draft_limit") ?? "50"),
        brief_limit: Number(url.searchParams.get("brief_limit") ?? "50"),
      });
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const rejectDraftMatch = pathname.match(/^\/drafts\/([^/]+)\/reject$/);
    if (request.method === "POST" && rejectDraftMatch) {
      const draftId = decodeURIComponent(rejectDraftMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "draft", id: draftId });
      const payload = await readJson<ApproveDraftRequest>(request);
      const result = await rejectDraftHandler(context.commands.rejectDraft, draftId, payload);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const editDraftMatch = pathname.match(/^\/drafts\/([^/]+)$/);
    if (request.method === "GET" && editDraftMatch) {
      const draftId = decodeURIComponent(editDraftMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "draft", id: draftId });
      const result = await getDraftDetailHandler(context.queries.getDraftDetail, draftId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    if (request.method === "PUT" && editDraftMatch) {
      const draftId = decodeURIComponent(editDraftMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "draft", id: draftId });
      const payload = await readJson<{
        editor_type: "user" | "agent";
        editor_id?: string;
        content: string;
        metadata?: string;
        comment?: string;
      }>(request);
      const result = await editDraftHandler(context.commands.editDraft, draftId, payload);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const generateDraftReviewMatch = pathname.match(/^\/drafts\/([^/]+)\/review\/generate$/);
    if (request.method === "POST" && generateDraftReviewMatch) {
      const draftId = decodeURIComponent(generateDraftReviewMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "draft", id: draftId });
      const result = await generateDraftReviewHandler(context.commands.generateDraftReview, draftId);
      return jsonResponse(result, { status: result.ok ? 202 : 400 });
    }

    const scheduleDraftMatch = pathname.match(/^\/drafts\/([^/]+)\/schedule$/);
    if (request.method === "POST" && scheduleDraftMatch) {
      const draftId = decodeURIComponent(scheduleDraftMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "draft", id: draftId });
      const payload = await readJson<ScheduleDraftRequest>(request);
      const result = await scheduleDraftHandler(context.commands.scheduleDraft, draftId, payload);
      return jsonResponse(result, { status: result.ok ? 201 : 400 });
    }

    const queuePublishJobMatch = pathname.match(/^\/schedules\/([^/]+)\/queue$/);
    if (request.method === "POST" && queuePublishJobMatch) {
      const scheduleId = decodeURIComponent(queuePublishJobMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "schedule", id: scheduleId });
      const result = await queuePublishJobHandler(context.commands.queuePublishJob, scheduleId);
      return jsonResponse(result, { status: result.ok ? 201 : 400 });
    }

    const updateScheduleMatch = pathname.match(/^\/schedules\/([^/]+)$/);
    if (request.method === "PUT" && updateScheduleMatch) {
      const scheduleId = decodeURIComponent(updateScheduleMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "schedule", id: scheduleId });
      const payload = await readJson<UpdatePublishScheduleRequest>(request);
      const result = await reschedulePublishScheduleHandler(context.commands.reschedulePublishSchedule, scheduleId, payload);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }
    if (request.method === "DELETE" && updateScheduleMatch) {
      const scheduleId = decodeURIComponent(updateScheduleMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "schedule", id: scheduleId });
      const result = await cancelPublishScheduleHandler(context.commands.cancelPublishSchedule, scheduleId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const completePublishJobMatch = pathname.match(/^\/publish-jobs\/([^/]+)\/complete$/);
    if (request.method === "POST" && completePublishJobMatch) {
      const publishJobId = decodeURIComponent(completePublishJobMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "publish_job", id: publishJobId });
      const payload = await readJson<CompletePublishJobRequest>(request);
      const result = await completePublishJobHandler(context.commands.completePublishJob, publishJobId, payload);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const failPublishJobMatch = pathname.match(/^\/publish-jobs\/([^/]+)\/fail$/);
    if (request.method === "POST" && failPublishJobMatch) {
      const publishJobId = decodeURIComponent(failPublishJobMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "publish_job", id: publishJobId });
      const payload = await readJson<FailPublishJobRequest>(request);
      const result = await failPublishJobHandler(context.commands.markPublishFailed, publishJobId, payload);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const retryPublishJobMatch = pathname.match(/^\/publish-jobs\/([^/]+)\/retry$/);
    if (request.method === "POST" && retryPublishJobMatch) {
      const publishJobId = decodeURIComponent(retryPublishJobMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "publish_job", id: publishJobId });
      const result = await retryPublishJobHandler(context.commands.retryPublishJob, publishJobId);
      return jsonResponse(result, { status: result.ok ? 202 : 400 });
    }

    const executePublishJobMatch = pathname.match(/^\/publish-jobs\/([^/]+)\/execute$/);
    if (request.method === "POST" && executePublishJobMatch) {
      const publishJobId = decodeURIComponent(executePublishJobMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "publish_job", id: publishJobId });
      const result = await executePublishJobHandler(context.commands.executePublishJob, publishJobId);
      return jsonResponse(result, { status: result.ok ? 200 : 400 });
    }

    const agentTaskMatch = pathname.match(/^\/agent-tasks\/([^/]+)$/);
    if (request.method === "GET" && agentTaskMatch) {
      const taskId = decodeURIComponent(agentTaskMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "agent_task", id: taskId });
      const result = await getAgentTaskHandler(context.queries.getAgentTask, taskId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    const retryAgentTaskMatch = pathname.match(/^\/agent-tasks\/([^/]+)\/retry$/);
    if (request.method === "POST" && retryAgentTaskMatch) {
      const taskId = decodeURIComponent(retryAgentTaskMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "agent_task", id: taskId });
      const result = await retryAgentTaskHandler(context.commands.retryAgentTask, taskId);
      return jsonResponse(result, { status: result.ok ? 202 : 400 });
    }

    const workerJobMatch = pathname.match(/^\/worker-jobs\/([^/]+)$/);
    if (request.method === "GET" && workerJobMatch) {
      const jobId = decodeURIComponent(workerJobMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "worker_job", id: jobId });
      const result = await getWorkerJobHandler(context.queries.getWorkerJob, jobId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    const retryWorkerJobMatch = pathname.match(/^\/worker-jobs\/([^/]+)\/retry$/);
    if (request.method === "POST" && retryWorkerJobMatch) {
      const jobId = decodeURIComponent(retryWorkerJobMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "worker_job", id: jobId });
      const result = await retryWorkerJobHandler(context.commands.retryWorkerJob, jobId);
      return jsonResponse(result, { status: result.ok ? 202 : 400 });
    }

    const agentRunMatch = pathname.match(/^\/agent-runs\/([^/]+)$/);
    if (request.method === "GET" && agentRunMatch) {
      const runId = decodeURIComponent(agentRunMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "agent_run", id: runId });
      const result = await getAgentRunHandler(context.queries.getAgentRun, runId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    const agentRunTraceMatch = pathname.match(/^\/agent-runs\/([^/]+)\/trace$/);
    if (request.method === "GET" && agentRunTraceMatch) {
      const runId = decodeURIComponent(agentRunTraceMatch[1]);
      await assertResourceWorkspace(context.sqlite.db, session, { type: "agent_run", id: runId });
      const result = await getAgentRunTraceHandler(context.queries.getAgentRunTrace, runId);
      return jsonResponse(result, { status: result.ok ? 200 : 404 });
    }

    return notFound();
  } catch (error) {
    if (error instanceof AppError) {
      return jsonResponse(err(error), { status: statusCodeForAppError(error) });
    }

    throw error;
  }
  });
  response.headers.set("x-request-id", requestId);
  return response;
}
