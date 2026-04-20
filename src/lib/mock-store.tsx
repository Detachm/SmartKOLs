"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  approveDraft as approveBackendDraft,
  assignAccountsToGroup,
  createAccountGroup,
  createSource,
  deleteAccount as deleteBackendAccount,
  editDraft as editBackendDraft,
  generateDraft,
  getAutopostPolicy,
  getMonitoringOverview,
  getWorkspaceSettingsOverview,
  importAccounts,
  listAccountGroups,
  listAccounts,
  listDrafts,
  listNotifications,
  listSources,
  listTrends,
  pauseSource,
  rejectDraft as rejectBackendDraft,
  removeSource,
  requestDraftRegeneration,
  resumeSource,
  upsertAutopostPolicy,
  type BackendSource,
} from "@/lib/live-api";
import { getLiveSession, logoutLiveSession, type LiveSessionResponse } from "@/lib/session-client";
import { getBackendData, postBackendData, putBackendData, type BackendAccount } from "@/lib/backend-client";
import { waitForAgentTask } from "@/lib/agent-task-client";

export interface Account {
  id: string;
  handle: string;
  displayName: string;
  avatarSeed: string;
  followersCount: number;
  followingCount: number;
  tweetsCount: number;
  active: boolean;
  createdAt: string;
  groupId?: string;
}

export interface Group {
  id: string;
  name: string;
  color: string;
}

export interface Persona {
  gender: string;
  nationality: string;
  age: number;
  interests: string[];
  personalityTraits: string[];
  writingStyle: string;
  bio: string;
  distillationSampleTweets: string;
}

export interface PersonaTemplate {
  id: string;
  name: string;
  description: string;
  persona: Persona;
}

export interface AutopostConfig {
  enabled: boolean;
  frequency: string;
  scheduledTimes: string[];
  activeDays: string[];
  tone: string;
  topics: string[];
  avoidTopics: string[];
  includeHashtags: boolean;
  includeEmojis: boolean;
}

export interface Source {
  id: string;
  name: string;
  url: string;
  type: "rss" | "website" | "twitter" | "youtube" | "substack" | "telegram";
  active: boolean;
  lastFetched: string;
}

export interface MonitoringMessage {
  id: string;
  accountId: string;
  accountHandle: string;
  sender: string;
  senderAvatar: string;
  category: "collab" | "commerce" | "spam" | "normal";
  categoryLabel: string;
  preview: string;
  content: string;
  receivedAt: string;
  read: boolean;
}

export interface Draft {
  id: string;
  accountId: string;
  content: string;
  status: "pending" | "approved" | "rejected";
  scheduledTime: string;
  generatedAt: string;
  topic: string;
}

export interface EngagementRule {
  type: string;
  value: string;
}

export interface AutoFollowConfig {
  enabled: boolean;
  maxPerDay: number;
  rules: EngagementRule[];
}

export interface AutoRetweetConfig {
  enabled: boolean;
  maxPerDay: number;
  minLikes: number;
  whitelist: string[];
  keywords: string[];
  delayMin: number;
  delayMax: number;
  quoteTweetEnabled: boolean;
}

export interface AutoCommentConfig {
  enabled: boolean;
  maxPerDay: number;
  targets: string[];
  style: string;
  mode: string;
}

export interface AutoReplyConfig {
  enabled: boolean;
  maxPerDay: number;
  triggerTypes: string[];
  onlyFollowers: boolean;
  keywords: string[];
  style: string;
}

export interface EngagementConfig {
  autoFollow: AutoFollowConfig;
  autoRetweet: AutoRetweetConfig;
  autoComment: AutoCommentConfig;
  autoReply: AutoReplyConfig;
}

export interface EngagementLog {
  id: string;
  accountId: string;
  type: "follow" | "retweet" | "comment" | "reply";
  targetHandle: string;
  targetName?: string;
  tweetExcerpt?: string;
  commentText?: string;
  replyText?: string;
  at: string;
}

export interface Notification {
  id: string;
  type: "post" | "message" | "health" | "action" | "engagement";
  text: string;
  at: string;
  read: boolean;
  link?: string;
}

export interface TrendingTopic {
  topic: string;
  heat: number;
  category: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarSeed: string;
  lastActive: string;
}

export interface HealthScore {
  score: number;
  breakdown: Array<{ label: string; value: number; max: number }>;
  risk: "low" | "medium" | "high";
}

export const DEFAULT_ENGAGEMENT_CONFIG: EngagementConfig = {
  autoFollow: { enabled: false, maxPerDay: 15, rules: [] },
  autoRetweet: { enabled: false, maxPerDay: 3, minLikes: 1000, whitelist: [], keywords: [], delayMin: 30, delayMax: 120, quoteTweetEnabled: false },
  autoComment: { enabled: false, maxPerDay: 5, targets: [], style: "supportive", mode: "latest" },
  autoReply: { enabled: false, maxPerDay: 30, triggerTypes: ["mention", "reply"], onlyFollowers: false, keywords: [], style: "grateful" },
};

const DAY_TO_CODE: Record<string, string> = {
  "周一": "mon",
  "周二": "tue",
  "周三": "wed",
  "周四": "thu",
  "周五": "fri",
  "周六": "sat",
  "周日": "sun",
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

const CODE_TO_DAY: Record<string, string> = {
  mon: "周一",
  tue: "周二",
  wed: "周三",
  thu: "周四",
  fri: "周五",
  sat: "周六",
  sun: "周日",
};

const STORAGE_KEY = "smartkols_live_store_v1";

interface StoreSidecar {
  autopostExtras: Record<string, Partial<AutopostConfig>>;
  engagementConfigs: Record<string, EngagementConfig>;
  readMessageIds: string[];
  readNotificationIds: string[];
}

interface MockStore {
  accounts: Account[];
  groups: Group[];
  personas: Record<string, Persona>;
  personaTemplates: PersonaTemplate[];
  autopostConfigs: Record<string, AutopostConfig>;
  sources: Record<string, Source[]>;
  tweetPreviews: Record<string, string[]>;
  monitoringMessages: MonitoringMessage[];
  drafts: Draft[];
  engagementConfigs: Record<string, EngagementConfig>;
  engagementLogs: EngagementLog[];
  notifications: Notification[];
  trendingTopics: TrendingTopic[];
  teamMembers: TeamMember[];
  hydrated: boolean;
  addAccount: (account: Account) => void;
  addAccounts: (accounts: Account[]) => void;
  deleteAccount: (id: string) => void;
  deleteAccounts: (ids: string[]) => void;
  updatePersona: (id: string, persona: Persona) => void;
  applyTemplateToAccounts: (ids: string[], templateId: string) => void;
  updateAutopost: (id: string, config: AutopostConfig) => void;
  applyAutopostToAccounts: (ids: string[], config: Partial<AutopostConfig>) => void;
  addSource: (accountId: string, source: Source) => void;
  addSourcesToAccounts: (ids: string[], sources: Source[]) => void;
  deleteSource: (accountId: string, sourceId: string) => void;
  toggleSourceActive: (accountId: string, sourceId: string) => void;
  addGroup: (group: Group) => void;
  moveAccountsToGroup: (ids: string[], groupId: string) => void;
  markMessageRead: (id: string) => void;
  randomizePersonas: (ids: string[]) => void;
  approveDraft: (id: string) => void;
  rejectDraft: (id: string) => void;
  regenerateDraft: (id: string) => void;
  editDraft: (id: string, content: string) => void;
  addDraftsFromTopic: (topic: string) => Promise<number>;
  getEngagementConfig: (accountId: string) => EngagementConfig;
  updateEngagementConfig: (accountId: string, config: EngagementConfig) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (n: Omit<Notification, "id" | "at" | "read">) => void;
  getHealthScore: (accountId: string) => HealthScore;
  resetDemo: () => void;
}

const MockStoreContext = createContext<MockStore | null>(null);

function loadSidecar(): StoreSidecar {
  if (typeof window === "undefined") {
    return { autopostExtras: {}, engagementConfigs: {}, readMessageIds: [], readNotificationIds: [] };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { autopostExtras: {}, engagementConfigs: {}, readMessageIds: [], readNotificationIds: [] };
    }
    const parsed = JSON.parse(raw) as StoreSidecar;
    return {
      autopostExtras: parsed.autopostExtras ?? {},
      engagementConfigs: parsed.engagementConfigs ?? {},
      readMessageIds: parsed.readMessageIds ?? [],
      readNotificationIds: parsed.readNotificationIds ?? [],
    };
  } catch {
    return { autopostExtras: {}, engagementConfigs: {}, readMessageIds: [], readNotificationIds: [] };
  }
}

function persistSidecar(value: StoreSidecar) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function avatarSeedFromAccount(account: { handle: string; avatar_url?: string | null }) {
  return account.handle.replace(/^@/, "") || account.avatar_url || "smartkols";
}

function mapAccount(account: BackendAccount): Account {
  return {
    id: account.id,
    handle: account.handle,
    displayName: account.display_name,
    avatarSeed: avatarSeedFromAccount(account),
    followersCount: account.follower_count,
    followingCount: account.following_count,
    tweetsCount: account.post_count,
    active: account.status === "active",
    createdAt: account.created_at,
    groupId: account.group_id,
  };
}

function mapPersona(raw?: {
  gender: string;
  nationality: string;
  age: number;
  interests: string[];
  personality_traits: string[];
  writing_style: string;
  bio: string;
  distillation_sample_tweets: string;
} | null): Persona {
  return {
    gender: raw?.gender ?? "male",
    nationality: raw?.nationality ?? "",
    age: raw?.age ?? 25,
    interests: raw?.interests ?? [],
    personalityTraits: raw?.personality_traits ?? [],
    writingStyle: raw?.writing_style ?? "",
    bio: raw?.bio ?? "",
    distillationSampleTweets: raw?.distillation_sample_tweets ?? "",
  };
}

function mapSource(source: BackendSource): Source {
  return {
    id: source.id,
    name: source.name,
    url: source.url,
    type: source.type,
    active: source.status === "active",
    lastFetched: source.last_fetched_at ?? source.created_at,
  };
}

function mapDraft(raw: {
  draft: {
    id: string;
    account_id: string;
    status: string;
    topic: string;
    updated_at: string;
    created_at: string;
  };
  current_version?: { content: string };
  schedule?: { scheduled_for: string };
}): Draft {
  return {
    id: raw.draft.id,
    accountId: raw.draft.account_id,
    content: raw.current_version?.content ?? "生成中...",
    status: raw.draft.status === "approved" ? "approved" : raw.draft.status === "rejected" ? "rejected" : "pending",
    scheduledTime: raw.schedule?.scheduled_for ?? raw.draft.updated_at,
    generatedAt: raw.draft.created_at,
    topic: normalizeTopicLabel(raw.draft.topic),
  };
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function looksLikeSentenceNoise(value: string) {
  const words = value.split(" ");
  if (words.length < 4) return false;
  const longAlphaWords = words.filter((word) => /^[a-z]{4,}$/i.test(word));
  return longAlphaWords.length >= 4;
}

function normalizeTopicLabel(topic?: string | null) {
  const raw = normalizeWhitespace(topic ?? "");
  if (!raw) {
    return "未命名话题";
  }

  const noUrl = raw.replace(/https?:\/\/\S+/gi, "").replace(/[#*_`~]+/g, "");
  const trimmed = normalizeWhitespace(noUrl).slice(0, 80);
  if (!trimmed) {
    return "未命名话题";
  }

  if (looksLikeSentenceNoise(trimmed)) {
    return trimmed
      .split(" ")
      .slice(0, 4)
      .join(" ");
  }

  return trimmed;
}

function mapAutopostConfig(
  accountId: string,
  policy: Awaited<ReturnType<typeof getAutopostPolicy>>,
  extras: Record<string, Partial<AutopostConfig>>,
): AutopostConfig {
  const base: AutopostConfig = {
    enabled: policy?.policy.status === "active",
    frequency: `每天${Math.max(policy?.policy.cadence_body.slot_times.length ?? 1, 1)}次`,
    scheduledTimes: policy?.policy.cadence_body.slot_times ?? ["09:00"],
    activeDays: policy?.policy.cadence_body.weekday_codes.map((code) => CODE_TO_DAY[code] ?? code) ?? ["周一", "周三", "周五"],
    tone: "专业",
    topics: [],
    avoidTopics: [],
    includeHashtags: false,
    includeEmojis: false,
  };
  return { ...base, ...(extras[accountId] ?? {}) };
}

function buildMessageCategory(title: string, detail: string): MonitoringMessage["category"] {
  const value = `${title} ${detail}`.toLowerCase();
  if (value.includes("collab") || value.includes("合作")) return "collab";
  if (value.includes("商务") || value.includes("quote") || value.includes("price")) return "commerce";
  if (value.includes("spam") || value.includes("垃圾")) return "spam";
  return "normal";
}

function buildMonitoringMessages(input: {
  notifications: Array<{ id: string; title: string; body: string; created_at: string; read_at?: string; link?: string }>;
  feed: Array<{ id: string; title: string; detail: string; created_at: string }>;
  accountsById: Map<string, Account>;
  readMessageIds: string[];
}): MonitoringMessage[] {
  const fromNotifications = input.notifications.map((item) => {
    const category = buildMessageCategory(item.title, item.body);
    return {
      id: `notif:${item.id}`,
      accountId: "",
      accountHandle: "workspace",
      sender: item.title,
      senderAvatar: "smartkols",
      category,
      categoryLabel: item.title,
      preview: item.body,
      content: item.body,
      receivedAt: item.created_at,
      read: Boolean(item.read_at) || input.readMessageIds.includes(`notif:${item.id}`),
    } satisfies MonitoringMessage;
  });

  const fromFeed = input.feed.map((item) => {
    const category = buildMessageCategory(item.title, item.detail);
    return {
      id: `feed:${item.id}`,
      accountId: "",
      accountHandle: "workspace",
      sender: item.title,
      senderAvatar: "smartkols",
      category,
      categoryLabel: item.title,
      preview: item.detail,
      content: item.detail,
      receivedAt: item.created_at,
      read: input.readMessageIds.includes(`feed:${item.id}`),
    } satisfies MonitoringMessage;
  });

  return [...fromNotifications, ...fromFeed].sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
}

function hashString(s: string): number {
  return s.split("").reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);
}

async function getPersona(accountId: string) {
  return getBackendData<{ persona: {
    gender: string;
    nationality: string;
    age: number;
    interests: string[];
    personality_traits: string[];
    writing_style: string;
    bio: string;
    distillation_sample_tweets: string;
  } }>(`/api/backend/personas/${encodeURIComponent(accountId)}`);
}

async function updatePersonaRequest(accountId: string, workspaceId: string, persona: Persona) {
  return putBackendData<{ persona: unknown }>(`/api/backend/personas/${encodeURIComponent(accountId)}`, {
    workspace_id: workspaceId,
    gender: persona.gender,
    nationality: persona.nationality || "Unknown",
    age: persona.age || 25,
    interests: persona.interests,
    personality_traits: persona.personalityTraits,
    writing_style: persona.writingStyle || "direct",
    bio: persona.bio,
    distillation_sample_tweets: persona.distillationSampleTweets,
    source: "manual",
    actor_type: "user",
  });
}

async function createAccountRequest(workspaceId: string, account: Account) {
  return postBackendData<BackendAccount>("/api/backend/accounts", {
    workspace_id: workspaceId,
    platform: "x",
    handle: account.handle,
    display_name: account.displayName,
    avatar_url: account.avatarSeed.startsWith("http") ? account.avatarSeed : undefined,
    group_id: account.groupId,
  });
}

export function MockStoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LiveSessionResponse | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [personas, setPersonas] = useState<Record<string, Persona>>({});
  const [personaTemplates] = useState<PersonaTemplate[]>([]);
  const [autopostConfigs, setAutopostConfigs] = useState<Record<string, AutopostConfig>>({});
  const [sources, setSources] = useState<Record<string, Source[]>>({});
  const [tweetPreviews, setTweetPreviews] = useState<Record<string, string[]>>({});
  const [monitoringMessages, setMonitoringMessages] = useState<MonitoringMessage[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [engagementConfigs, setEngagementConfigs] = useState<Record<string, EngagementConfig>>({});
  const [engagementLogs] = useState<EngagementLog[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const sidecarRef = useRef<StoreSidecar>(loadSidecar());

  const workspaceId = session?.selected_workspace.id ?? null;

  async function refreshAll(nextSession?: LiveSessionResponse) {
    const activeSession = nextSession ?? session ?? await getLiveSession();
    const currentWorkspaceId = activeSession.selected_workspace.id;
    const sidecar = sidecarRef.current;

    const [accountsResponse, groupsResponse, draftsResponse, notificationsResponse, trendsResponse, monitoringOverview, settingsOverview] = await Promise.all([
      listAccounts(currentWorkspaceId),
      listAccountGroups(currentWorkspaceId),
      listDrafts({ workspaceId: currentWorkspaceId, limit: 200 }),
      listNotifications(currentWorkspaceId, 50),
      listTrends(currentWorkspaceId),
      getMonitoringOverview(currentWorkspaceId, 30),
      getWorkspaceSettingsOverview(currentWorkspaceId),
    ]);

    const nextAccounts = accountsResponse.accounts.map(mapAccount);
    const nextGroups = groupsResponse.groups.map((item) => ({
      id: item.group.id,
      name: item.group.name,
      color: item.group.color,
    }));
    const nextDrafts = draftsResponse.drafts.map(mapDraft);
    const accountsById = new Map(nextAccounts.map((account) => [account.id, account]));

    const perAccountResults = await Promise.all(nextAccounts.map(async (account) => {
      const [personaResult, sourcesResult, autopostPolicy] = await Promise.all([
        getPersona(account.id).catch(() => null),
        listSources(account.id).catch(() => ({ sources: [] })),
        getAutopostPolicy(account.id).catch(() => null),
      ]);

      return {
        accountId: account.id,
        persona: mapPersona(personaResult?.persona),
        sources: sourcesResult.sources.map(mapSource),
        autopost: mapAutopostConfig(account.id, autopostPolicy, sidecar.autopostExtras),
      };
    }));

    const nextPersonas = Object.fromEntries(perAccountResults.map((item) => [item.accountId, item.persona]));
    const nextSources = Object.fromEntries(perAccountResults.map((item) => [item.accountId, item.sources]));
    const nextAutopostConfigs = Object.fromEntries(perAccountResults.map((item) => [item.accountId, item.autopost]));
    const nextTweetPreviews = nextAccounts.reduce<Record<string, string[]>>((acc, account) => {
      acc[account.id] = nextDrafts.filter((draft) => draft.accountId === account.id).slice(0, 5).map((draft) => draft.content);
      return acc;
    }, {});

    setSession(activeSession);
    setAccounts(nextAccounts);
    setGroups(nextGroups);
    setDrafts(nextDrafts);
    setPersonas(nextPersonas);
    setSources(nextSources);
    setAutopostConfigs(nextAutopostConfigs);
    setTweetPreviews(nextTweetPreviews);
    setTrendingTopics(
      trendsResponse.trends
        .filter((item) => item.status === "active")
        .sort((a, b) => b.score - a.score)
        .map((item) => ({
          topic: normalizeTopicLabel(item.topic),
          heat: Math.min(100, Math.max(1, Math.round(item.score * 100))),
          category: item.category,
        })),
    );
    setNotifications(
      notificationsResponse.notifications.map((item) => ({
        id: item.id,
        type: item.type,
        text: `${item.title}${item.body ? ` · ${item.body}` : ""}`,
        at: item.created_at,
        read: Boolean(item.read_at) || sidecar.readNotificationIds.includes(item.id),
        link: item.link,
      })),
    );
    setMonitoringMessages(buildMonitoringMessages({
      notifications: monitoringOverview.notifications,
      feed: monitoringOverview.feed,
      accountsById,
      readMessageIds: sidecar.readMessageIds,
    }));
    setTeamMembers(
      settingsOverview.members.map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        role: member.membership.role_code[0].toUpperCase() + member.membership.role_code.slice(1),
        avatarSeed: member.user.email,
        lastActive: "当前环境",
      })),
    );
    setEngagementConfigs(sidecar.engagementConfigs);
    setHydrated(true);
  }

  useEffect(() => {
    void refreshAll().catch((error) => {
      console.error("failed to bootstrap mock store", error);
      setHydrated(true);
    });
  }, []);

  function persistCurrentSidecar() {
    persistSidecar(sidecarRef.current);
  }

  const addAccount = (account: Account) => {
    setAccounts((prev) => [account, ...prev]);
    if (!workspaceId) return;
    void createAccountRequest(workspaceId, account)
      .then(() => refreshAll())
      .catch((error) => {
        console.error("add account failed", error);
        void refreshAll();
      });
  };

  const addAccounts = (newAccounts: Account[]) => {
    setAccounts((prev) => [...newAccounts, ...prev]);
    if (!workspaceId) return;
    void importAccounts({
      workspace_id: workspaceId,
      create_missing_groups: true,
      rows: newAccounts.map((account) => ({
        handle: account.handle,
        display_name: account.displayName,
        group_name: groups.find((group) => group.id === account.groupId)?.name,
      })),
    })
      .then(() => refreshAll())
      .catch((error) => {
        console.error("import accounts failed", error);
        void refreshAll();
      });
  };

  const deleteAccount = (id: string) => {
    setAccounts((prev) => prev.filter((item) => item.id !== id));
    void deleteBackendAccount(id).then(() => refreshAll()).catch(() => refreshAll());
  };

  const deleteAccounts = (ids: string[]) => {
    setAccounts((prev) => prev.filter((item) => !ids.includes(item.id)));
    void Promise.allSettled(ids.map((id) => deleteBackendAccount(id))).then(() => refreshAll());
  };

  const updatePersona = (id: string, persona: Persona) => {
    setPersonas((prev) => ({ ...prev, [id]: persona }));
    if (!workspaceId) return;
    void updatePersonaRequest(id, workspaceId, persona).catch((error) => {
      console.error("update persona failed", error);
      void refreshAll();
    });
  };

  const applyTemplateToAccounts = (ids: string[], templateId: string) => {
    console.warn("persona templates are not configured in this compatibility store yet", { ids, templateId });
  };

  const updateAutopost = (id: string, config: AutopostConfig) => {
    setAutopostConfigs((prev) => ({ ...prev, [id]: config }));
    sidecarRef.current = {
      ...sidecarRef.current,
      autopostExtras: {
        ...sidecarRef.current.autopostExtras,
        [id]: {
          tone: config.tone,
          topics: config.topics,
          avoidTopics: config.avoidTopics,
          includeHashtags: config.includeHashtags,
          includeEmojis: config.includeEmojis,
        },
      },
    };
    persistCurrentSidecar();
    void upsertAutopostPolicy(id, {
        cadence_body: {
          timezone: "Asia/Shanghai",
          weekday_codes: config.activeDays.map((day) => DAY_TO_CODE[day]).filter(Boolean) as Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">,
          slot_times: config.scheduledTimes,
          min_spacing_minutes: 90,
        },
        content_strategy_body: {
          generation_mode: "from_trend",
          source_types: ["rss", "website", "twitter", "youtube", "substack", "telegram"],
          max_source_age_days: 7,
        },
        execution_body: {
          draft_review_mode: "manual",
          auto_queue_publish: false,
        },
        status: config.enabled ? "active" : "paused",
      })
      .then(() => refreshAll())
      .catch((error) => {
      console.error("update autopost failed", error);
    });
  };

  const applyAutopostToAccounts = (ids: string[], config: Partial<AutopostConfig>) => {
    ids.forEach((id) => {
      const current = autopostConfigs[id];
      if (current) {
        updateAutopost(id, { ...current, ...config });
      }
    });
  };

  const addSource = (accountId: string, source: Source) => {
    setSources((prev) => ({ ...prev, [accountId]: [...(prev[accountId] ?? []), source] }));
    void createSource(accountId, {
      type: source.type,
      name: source.name,
      url: source.url,
    }).then(() => refreshAll()).catch((error) => {
      console.error("add source failed", error);
      void refreshAll();
    });
  };

  const addSourcesToAccounts = (ids: string[], newSources: Source[]) => {
    ids.forEach((id) => {
      newSources.forEach((source) => addSource(id, source));
    });
  };

  const deleteSource = (accountId: string, sourceId: string) => {
    setSources((prev) => ({ ...prev, [accountId]: (prev[accountId] ?? []).filter((item) => item.id !== sourceId) }));
    void removeSource(sourceId).then(() => refreshAll()).catch(() => refreshAll());
  };

  const toggleSourceActive = (accountId: string, sourceId: string) => {
    const current = (sources[accountId] ?? []).find((item) => item.id === sourceId);
    setSources((prev) => ({
      ...prev,
      [accountId]: (prev[accountId] ?? []).map((item) => item.id === sourceId ? { ...item, active: !item.active } : item),
    }));
    if (!current) return;
    void (current.active ? pauseSource(sourceId) : resumeSource(sourceId)).then(() => refreshAll()).catch(() => refreshAll());
  };

  const addGroup = (group: Group) => {
    setGroups((prev) => [...prev, group]);
    if (!workspaceId) return;
    void createAccountGroup({
      workspace_id: workspaceId,
      name: group.name,
      color: group.color,
    }).then(() => refreshAll()).catch(() => refreshAll());
  };

  const moveAccountsToGroup = (ids: string[], groupId: string) => {
    setAccounts((prev) => prev.map((item) => ids.includes(item.id) ? { ...item, groupId } : item));
    void assignAccountsToGroup({ account_ids: ids, group_id: groupId }).then(() => refreshAll()).catch(() => refreshAll());
  };

  const markMessageRead = (id: string) => {
    setMonitoringMessages((prev) => prev.map((item) => item.id === id ? { ...item, read: true } : item));
    sidecarRef.current = {
      ...sidecarRef.current,
      readMessageIds: Array.from(new Set([...sidecarRef.current.readMessageIds, id])),
    };
    persistCurrentSidecar();
  };

  const randomizePersonas = (ids: string[]) => {
    ids.forEach((id) => {
      updatePersona(id, {
        gender: "male",
        nationality: "中国",
        age: 28,
        interests: ["AI", "Crypto", "Tech"],
        personalityTraits: ["直接", "幽默", "分析型"],
        writingStyle: "短句，观点鲜明",
        bio: personas[id]?.bio ?? "",
        distillationSampleTweets: personas[id]?.distillationSampleTweets ?? "",
      });
    });
  };

  const approveDraft = (id: string) => {
    setDrafts((prev) => prev.map((item) => item.id === id ? { ...item, status: "approved" } : item));
    void approveBackendDraft(id).then(() => refreshAll()).catch(() => refreshAll());
  };

  const rejectDraft = (id: string) => {
    setDrafts((prev) => prev.map((item) => item.id === id ? { ...item, status: "rejected" } : item));
    void rejectBackendDraft(id).then(() => refreshAll()).catch(() => refreshAll());
  };

  const regenerateDraft = (id: string) => {
    setDrafts((prev) => prev.map((item) => item.id === id ? { ...item, content: "重新生成中...", generatedAt: new Date().toISOString() } : item));
    void requestDraftRegeneration(id).then(() => refreshAll()).catch(() => refreshAll());
  };

  const editDraft = (id: string, content: string) => {
    setDrafts((prev) => prev.map((item) => item.id === id ? { ...item, content } : item));
    void editBackendDraft(id, { content }).then(() => refreshAll()).catch(() => refreshAll());
  };

  const addDraftsFromTopic = async (topic: string) => {
    const normalizedTopic = normalizeTopicLabel(topic);
    const targets = accounts.filter((item) => item.active).slice(0, 10);
    const optimisticDrafts = targets.map((account, index) => ({
      id: `temp-${normalizedTopic}-${account.id}-${index}`,
      accountId: account.id,
      content: `正在基于「${normalizedTopic}」为 ${account.displayName} 生成草稿...`,
      status: "pending" as const,
      scheduledTime: new Date(Date.now() + (index + 1) * 3_600_000).toISOString(),
      generatedAt: new Date().toISOString(),
      topic: normalizedTopic,
    }));

    setDrafts((prev) => [...optimisticDrafts, ...prev]);

    const queueResults = await Promise.allSettled(targets.map(async (account, index) => {
      const optimisticId = `temp-${normalizedTopic}-${account.id}-${index}`;
      const result = await generateDraft(account.id, { topic: normalizedTopic });

      void (async () => {
        try {
          await waitForAgentTask(result.task_id, { maxAttempts: 60, intervalMs: 2000 });
        } catch {
          // Refresh even on failure so temporary placeholders do not stick forever.
        } finally {
          setDrafts((prev) => prev.filter((item) => item.id !== optimisticId));
          void refreshAll().catch((error) => {
            console.error("refresh after draft generation failed", error);
          });
        }
      })();

      return result.task_id;
    }));

    const queuedCount = queueResults.filter((item) => item.status === "fulfilled").length;

    if (queuedCount === 0) {
      setDrafts((prev) => prev.filter((item) => !item.id.startsWith(`temp-${normalizedTopic}-`)));
      void refreshAll().catch((error) => {
        console.error("refresh after batch draft queue failed", error);
      });
    }

    return queuedCount;
  };

  const getEngagementConfig = (accountId: string): EngagementConfig => {
    return engagementConfigs[accountId] || DEFAULT_ENGAGEMENT_CONFIG;
  };

  const updateEngagementConfig = (accountId: string, config: EngagementConfig) => {
    setEngagementConfigs((prev) => ({ ...prev, [accountId]: config }));
    sidecarRef.current = {
      ...sidecarRef.current,
      engagementConfigs: {
        ...sidecarRef.current.engagementConfigs,
        [accountId]: config,
      },
    };
    persistCurrentSidecar();
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((item) => item.id === id ? { ...item, read: true } : item));
    sidecarRef.current = {
      ...sidecarRef.current,
      readNotificationIds: Array.from(new Set([...sidecarRef.current.readNotificationIds, id])),
    };
    persistCurrentSidecar();
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    sidecarRef.current = {
      ...sidecarRef.current,
      readNotificationIds: Array.from(new Set([...sidecarRef.current.readNotificationIds, ...notifications.map((item) => item.id)])),
    };
    persistCurrentSidecar();
  };

  const addNotification = (n: Omit<Notification, "id" | "at" | "read">) => {
    setNotifications((prev) => [{
      ...n,
      id: `local-${Date.now()}`,
      at: new Date().toISOString(),
      read: false,
    }, ...prev]);
  };

  const getHealthScore = (accountId: string): HealthScore => {
    const account = accounts.find((item) => item.id === accountId);
    const h = hashString(accountId);
    const postingFreq = 10 + (h % 16);
    const engagement = 10 + ((h * 3) % 16);
    const consistency = 10 + ((h * 7) % 16);
    const risk = 10 + ((h * 11) % 16);
    const followerBonus = Math.min(20, Math.floor((account?.followersCount ?? 0) / 5000));
    const score = Math.min(100, postingFreq + engagement + consistency + risk + followerBonus);
    const riskLevel: "low" | "medium" | "high" = score >= 80 ? "low" : score >= 60 ? "medium" : "high";
    return {
      score,
      breakdown: [
        { label: "发帖频率稳定性", value: postingFreq, max: 25 },
        { label: "互动率", value: engagement, max: 25 },
        { label: "内容一致性", value: consistency, max: 25 },
        { label: "风险信号", value: Math.min(25, risk + followerBonus), max: 25 },
      ],
      risk: riskLevel,
    };
  };

  const resetDemo = () => {
    sidecarRef.current = { autopostExtras: {}, engagementConfigs: {}, readMessageIds: [], readNotificationIds: [] };
    persistCurrentSidecar();
    void logoutLiveSession().finally(() => {
      window.location.href = "/login";
    });
  };

  const value = useMemo<MockStore>(() => ({
    accounts,
    groups,
    personas,
    personaTemplates,
    autopostConfigs,
    sources,
    tweetPreviews,
    monitoringMessages,
    drafts,
    engagementConfigs,
    engagementLogs,
    notifications,
    trendingTopics,
    teamMembers,
    hydrated,
    addAccount,
    addAccounts,
    deleteAccount,
    deleteAccounts,
    updatePersona,
    applyTemplateToAccounts,
    updateAutopost,
    applyAutopostToAccounts,
    addSource,
    addSourcesToAccounts,
    deleteSource,
    toggleSourceActive,
    addGroup,
    moveAccountsToGroup,
    markMessageRead,
    randomizePersonas,
    approveDraft,
    rejectDraft,
    regenerateDraft,
    editDraft,
    addDraftsFromTopic,
    getEngagementConfig,
    updateEngagementConfig,
    markNotificationRead,
    markAllNotificationsRead,
    addNotification,
    getHealthScore,
    resetDemo,
  }), [
    accounts,
    groups,
    personas,
    personaTemplates,
    autopostConfigs,
    sources,
    tweetPreviews,
    monitoringMessages,
    drafts,
    engagementConfigs,
    engagementLogs,
    notifications,
    trendingTopics,
    teamMembers,
    hydrated,
  ]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] text-[#111111]">
        <div className="mx-auto max-w-3xl px-8 py-24 text-center text-sm text-[#666666]">
          正在同步真实 workspace 数据...
        </div>
      </div>
    );
  }

  return (
    <MockStoreContext.Provider value={value}>
      {children}
    </MockStoreContext.Provider>
  );
}

export function useMockStore() {
  const ctx = useContext(MockStoreContext);
  if (!ctx) throw new Error("useMockStore must be used inside MockStoreProvider");
  return ctx;
}
