import type {
  BriefingPayload,
  BriefingRow,
  BriefingsListResponse,
  CompetitionChannelsResponse,
  CompetitionGapsResponse,
  LoginResponse,
  NewsResponse,
  TrendInterestResponse,
  TrendMacroResponse,
  TrendRelatedResponse,
  TopicsListResponse,
  TopicDetailWrapperResponse,
} from "./types";
import { clearAuthToken, getAuthToken } from "./auth";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "http://127.0.0.1:8000";

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const url = new URL(API_BASE + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function fetchJson<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  init?: RequestInit & { auth?: boolean }
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init?.auth) {
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(buildUrl(path, params), {
    headers,
    cache: "no-store",
    ...init,
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearAuthToken();
      if (typeof window !== "undefined") window.location.reload();
    }
    const txt = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText}: ${txt || "(sem corpo)"}`);
  }

  return (await res.json()) as T;
}

export async function apiHealth() {
  return fetchJson<{ status: string }>(`/health`);
}

export const apiTrendsMacro = () =>
  fetchJson<TrendMacroResponse>(`/trends/macro`);

export const apiTopicsList = () =>
  fetchJson<TopicsListResponse>(`/topics`);

export const apiTopicDetail = (topicId: string) =>
  fetchJson<TopicDetailWrapperResponse>(`/topics/${encodeURIComponent(topicId)}`);

export const apiTrendsInterest = (keyword: string, window: "now 7-d" | "today 1-m" | "today 3-m") =>
  fetchJson<TrendInterestResponse>(`/trends/interest`, { keyword, window });

export const apiTrendsRelated = (keyword: string) =>
  fetchJson<TrendRelatedResponse>(`/trends/related`, { keyword });

export const apiCompetitionChannels = () =>
  fetchJson<CompetitionChannelsResponse>(`/competition/channels`);

export const apiCompetitionGaps = () =>
  fetchJson<CompetitionGapsResponse>(`/competition/gaps`);

export const apiClearCache = async (prefix?: string) => {
  const params = prefix ? { prefix } : undefined;
  return fetchJson<{ removed: number }>(`/cache`, params, { method: "DELETE", auth: true });
};

export const apiLogin = (username: string, password: string) =>
  fetchJson<LoginResponse>(
    `/auth/login`,
    undefined,
    { method: "POST", body: JSON.stringify({ username, password }) }
  );

export const apiMe = () => fetchJson<{ user: string; exp: number }>(`/auth/me`, undefined, { auth: true });

export const apiGetBriefings = (limit = 30) =>
  fetchJson<BriefingsListResponse>(`/briefings`, { limit }, { auth: true });

export const apiGetBriefing = (topicId: string) =>
  fetchJson<BriefingRow>(`/briefings/${encodeURIComponent(topicId)}`, undefined, { auth: true });

export const apiSaveBriefing = (topicId: string, payload: BriefingPayload) =>
  fetchJson<BriefingRow>(
    `/briefings/${encodeURIComponent(topicId)}`,
    undefined,
    { method: "PUT", auth: true, body: JSON.stringify(payload) }
  );

export async function apiExportBriefing(topicId: string, format: "json" | "csv") {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(buildUrl(`/briefings/${encodeURIComponent(topicId)}/export`, { format }), {
    method: "GET",
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 401) {
      clearAuthToken();
      if (typeof window !== "undefined") window.location.reload();
    }
    const txt = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText}: ${txt || "(sem corpo)"}`);
  }
  if (format === "json") {
    return { filename: `briefing_${topicId}.json`, content: JSON.stringify(await res.json(), null, 2) };
  }
  return { filename: `briefing_${topicId}.csv`, content: await res.text() };
}

export type { NewsResponse };

