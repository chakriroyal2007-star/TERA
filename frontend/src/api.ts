import { QueryClient } from "@tanstack/react-query";
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15000 } },
});
export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const apiUrl = (path: string) => {
  if (!path || path === "#") return "#";
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  )
    return path;
  const clean = path.startsWith("/api/v1") ? path : `/api/v1${path.startsWith("/") ? "" : "/"}${path}`;
  return `${API_BASE}${clean}`;
};

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
  case_id?: string;
  category: string;
  description: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  priority: string;
  detected_language?: string;
  english_translation?: string;
  casualties_count?: number;
  injuries_description?: string;
  vehicles_involved?: string;
  immediate_hazards?: string;
  requested_assistance?: string;
  citizen_contact?: string | null;
  pdf_path?: string;
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
  injuries?: string;
  severity: "low" | "medium" | "high" | "critical";
  vehicles?: string;
  immediate_hazards?: string;
  required_resources: string[];
  requested_assistance?: string[];
  detected_language?: string;
  english_translation?: string;
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
export const label = (s: string | null | undefined) =>
  s ? String(s).replaceAll("_", " ").replaceAll(".", " · ") : "—";

export const date = (s: string | null | undefined) => {
  if (!s) return "—";
  try {
    let str = String(s).trim();
    if (str.includes(" ") && !str.includes("T")) {
      str = str.replace(" ", "T");
    }
    // If no timezone offset is present, treat as UTC because all backend records are stored in UTC
    if (!str.endsWith("Z") && !/[+-]\d{2}(:\d{2})?$/.test(str)) {
      str = str + "Z";
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return String(s);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(s);
  }
};

export const timeAgo = (s: string | null | undefined) => {
  if (!s) return "";
  try {
    let str = String(s).trim();
    if (str.includes(" ") && !str.includes("T")) str = str.replace(" ", "T");
    if (!str.endsWith("Z") && !/[+-]\d{2}(:\d{2})?$/.test(str)) str = str + "Z";
    const d = new Date(str);
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return "";
  } catch {
    return "";
  }
};

// Resource selectors load paginated registries rather than silently truncating them.
export async function apiList<T>(path: string): Promise<T[]> {
  try {
    const result: T[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = await api<T[]>(
        path + (path.includes("?") ? "&" : "?") + "limit=100&offset=" + offset,
      );
      if (!Array.isArray(page)) return result;
      result.push(...page);
      if (page.length < 100) return result;
    }
  } catch (err) {
    console.warn(`apiList error for ${path}:`, err);
    return [];
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

// Durable browser persistence ensuring incidents never disappear on refresh or across cold starts
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function saveIncidentRecord(inc: any) {
  if (!inc) return;
  try {
    const list: any[] = JSON.parse(localStorage.getItem("tera_incidents_list") || "[]");
    const idx = list.findIndex(
      (e) =>
        (e && e.id && inc.id && e.id === inc.id) ||
        (e && e.case_id && inc.case_id && e.case_id === inc.case_id) ||
        (e && e.tracking_code && inc.tracking_code && e.tracking_code === inc.tracking_code),
    );
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...inc };
    } else {
      list.unshift(inc);
    }
    localStorage.setItem("tera_incidents_list", JSON.stringify(list.slice(0, 100)));

    const map = JSON.parse(localStorage.getItem("tera_local_incidents") || "{}");
    if (inc.id) {
      map[inc.id] = inc;
      map[String(inc.id).toLowerCase()] = inc;
    }
    if (inc.case_id) {
      map[inc.case_id] = inc;
      map[String(inc.case_id).toUpperCase()] = inc;
      map[String(inc.case_id).toLowerCase()] = inc;
    }
    if (inc.tracking_code) {
      map[inc.tracking_code] = inc;
      map[String(inc.tracking_code).toLowerCase()] = inc;
    }
    localStorage.setItem("tera_local_incidents", JSON.stringify(map));
  } catch (_) {}
}

export function findIncidentRecord(id: string): Incident | null {
  if (!id) return null;
  try {
    const raw = String(id).trim();
    const lower = raw.toLowerCase();
    const upper = raw.toUpperCase();
    const map = JSON.parse(localStorage.getItem("tera_local_incidents") || "{}");
    if (map[raw]) return map[raw];
    if (map[lower]) return map[lower];
    if (map[upper]) return map[upper];
    for (const k of Object.keys(map)) {
      if (k.toLowerCase() === lower) return map[k];
    }
    const list: any[] = JSON.parse(localStorage.getItem("tera_incidents_list") || "[]");
    const found = list.find(
      (e) =>
        e &&
        (e.id === raw ||
          e.case_id === raw ||
          e.tracking_code === raw ||
          (e.id && String(e.id).toLowerCase() === lower) ||
          (e.case_id && String(e.case_id).toLowerCase() === lower) ||
          (e.tracking_code && String(e.tracking_code).toLowerCase() === lower)),
    );
    if (found) return found;
  } catch (_) {}
  return null;
}

export async function syncIncidentWithServer(inc: any): Promise<Incident | null> {
  if (!inc || !inc.id) return null;
  try {
    const res = await api<Incident>("/incidents/sync", "POST", inc);
    if (res && res.id) {
      const merged = { ...inc, ...res };
      saveIncidentRecord(merged);
      return merged;
    }
  } catch (_) {}
  return inc;
}

export function getAllStoredIncidents(): Incident[] {
  try {
    const list: Incident[] = JSON.parse(localStorage.getItem("tera_incidents_list") || "[]");
    const map = JSON.parse(localStorage.getItem("tera_local_incidents") || "{}");
    const mapValues = Object.values(map) as Incident[];
    const combined = [...list, ...mapValues];
    const seen = new Set<string>();
    const res: Incident[] = [];
    for (const item of combined) {
      if (!item) continue;
      const key = item.case_id || item.id;
      if (key && !seen.has(key)) {
        seen.add(key);
        if (item.id) seen.add(item.id);
        if (item.case_id) seen.add(item.case_id);
        res.push(item);
      }
    }
    return res;
  } catch (_) {
    return [];
  }
}
