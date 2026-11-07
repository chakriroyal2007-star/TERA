import { QueryClient } from "@tanstack/react-query";
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15000 } },
});
export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const apiUrl = (path: string) => `${API_BASE}/api/v1${path}`;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function csrf() {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("tera_csrf="))
      ?.split("=")[1] || ""
  );
}
let refreshing: Promise<Response> | null = null;
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
  retry = true,
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method,
    credentials: "include",
    headers: {
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      "X-CSRF-Token": csrf(),
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  if (
    res.status === 401 &&
    retry &&
    (!path.startsWith("/auth/") || path === "/auth/me")
  ) {
    refreshing ||= fetch(apiUrl("/auth/refresh"), {
      method: "POST",
      headers: { "X-CSRF-Token": csrf() },
    }).finally(() => {
      refreshing = null;
    });
    if ((await refreshing).ok) return api<T>(path, method, body, false);
  }
  if (!res.ok) {
    const data = await res
      .json()
      .catch(() => ({ detail: "Service unavailable" }));
    throw new ApiError(
      res.status,
      typeof data.detail === "string"
        ? data.detail
        : "Please check the form fields",
    );
  }
  return res.json();
}
export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  organization_id: string | null;
  mfa_enabled: boolean;
}
export interface Incident {
  id: string;
  category: string;
  description: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  priority: string;
  created_at: string;
  events?: any[];
  reports?: any[];
}
export interface VoiceRecordingData {
  id: string;
  duration: number;
  mime_type: string;
  file_size: number;
  checksum: string;
  created_at: string;
  audio_url: string;
}
export interface VoiceTranscriptData {
  original: string;
  corrected: string | null;
  language: string;
  confidence: number | null;
  provider: string;
}
export interface ExtractedIncidentData {
  title?: string;
  category: "medical" | "road_collision" | "fire" | "disaster" | "other";
  description: string;
  location_text: string;
  landmark?: string;
  affected_people?: number | string;
  severity: "low" | "medium" | "high" | "critical";
  required_resources: string[];
  immediate_safety_concerns?: string;
  reporter_contact?: string;
}
export interface IncidentVoiceDetails {
  has_voice: boolean;
  recording?: VoiceRecordingData;
  transcript?: VoiceTranscriptData;
  extraction?: ExtractedIncidentData;
  user_confirmed?: boolean;
}
export interface Mission {
  id: string;
  incident_id: string;
  ambulance_id: string;
  responder_id: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  location_at: string | null;
}
export const label = (s: string) =>
  s.replaceAll("_", " ").replaceAll(".", " · ");
export const date = (s: string) =>
  new Date(s).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

// Resource selectors load paginated registries rather than silently truncating them.
export async function apiList<T>(path: string): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await api<T[]>(
      path + (path.includes("?") ? "&" : "?") + "limit=100&offset=" + offset,
    );
    result.push(...page);
    if (page.length < 100) return result;
  }
}
export async function apiCollection<T>(
  path: string,
): Promise<{ items: T[]; total: number }> {
  const items: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await api<{ items: T[]; total: number }>(
      path + (path.includes("?") ? "&" : "?") + "limit=100&offset=" + offset,
    );
    items.push(...page.items);
    if (items.length >= page.total || page.items.length < 100)
      return { items, total: page.total };
  }
}
