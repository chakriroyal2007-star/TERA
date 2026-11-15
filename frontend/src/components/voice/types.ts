import { ExtractedIncidentData } from "../../api";

export interface ProviderHealth {
  status: "ONLINE" | "DEGRADED" | "NOT_CONFIGURED" | "OFFLINE";
  provider: string;
  message: string;
  audio_processing_ready: boolean;
  ffmpeg_available: boolean;
  supported_languages: string[];
}

export interface VoiceReporterProps {
  onIncidentSubmitted?: (result: {
    id: string;
    case_id: string;
    tracking_code: string;
    pdf_url: string;
    category: string;
    address: string;
  }) => void;
  initialAddress?: string;
  initialLat?: string;
  initialLng?: string;
  onLocationChange?: (lat: string, lng: string, address: string) => void;
  onExtractionApplied?: (extraction: ExtractedIncidentData, transcript: string) => void;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.display_name) {
        const parts = data.display_name.split(", ");
        return parts.slice(0, 4).join(", ");
      }
    }
  } catch (_) {}
  return `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function detectSupportedAudioMime(): { mime: string; cleanMime: string; ext: string } {
  if (typeof window === "undefined" || !window.MediaRecorder) {
    return { mime: "audio/webm", cleanMime: "audio/webm", ext: "webm" };
  }
  const candidates = [
    { mime: "audio/webm;codecs=opus", cleanMime: "audio/webm", ext: "webm" },
    { mime: "audio/webm", cleanMime: "audio/webm", ext: "webm" },
    { mime: "audio/ogg;codecs=opus", cleanMime: "audio/ogg", ext: "ogg" },
    { mime: "audio/ogg", cleanMime: "audio/ogg", ext: "ogg" },
    { mime: "audio/mp4", cleanMime: "audio/mp4", ext: "mp4" },
    { mime: "audio/wav", cleanMime: "audio/wav", ext: "wav" },
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mime)) {
      return c;
    }
  }
  return { mime: "audio/webm", cleanMime: "audio/webm", ext: "webm" };
}

export function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
