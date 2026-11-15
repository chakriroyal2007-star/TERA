import React from "react";
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  LocateFixed,
  Languages,
  Volume2,
} from "lucide-react";
import { ErrorBox } from "../../components";
import { ProviderHealth, formatTime } from "./types";
import { RecordingStage } from "./useVoiceRecording";

interface RecordingControlsProps {
  stage: RecordingStage;
  healthData?: ProviderHealth;
  language: string;
  setLanguage: (lang: string) => void;
  latitude: string;
  longitude: string;
  address: string;
  geoBusy: boolean;
  geoWarning: string;
  locateGps: () => void;
  error: string | null;
  duration: number;
  audioLevel: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  processingStatus: string;
  startRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  resetRecording: () => void;
  processVoiceRecording: () => void;
}

export function RecordingControls({
  stage,
  healthData,
  language,
  setLanguage,
  latitude,
  longitude,
  address,
  geoBusy,
  geoWarning,
  locateGps,
  error,
  duration,
  audioLevel,
  audioBlob,
  audioUrl,
  processingStatus,
  startRecording,
  pauseRecording,
  resumeRecording,
  stopRecording,
  resetRecording,
  processVoiceRecording,
}: RecordingControlsProps) {
  return (
    <>
      <div className="voice-recorder-header">
        <div className="voice-tag">
          <Sparkles size={14} /> AI Emergency Voice Reporting
        </div>
        <div className="language-selector">
          <Languages size={15} />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={stage === "recording" || stage === "processing"}
            aria-label="Spoken language selector"
          >
            <option value="auto">🌐 Auto-detect (11 Indian Languages)</option>
            <option value="te">🇮🇳 Telugu (తెలుగు)</option>
            <option value="hi">🇮🇳 Hindi (हिन्दी)</option>
            <option value="en">🇬🇧 English</option>
            <option value="ta">🇮🇳 Tamil (தமிழ்)</option>
            <option value="kn">🇮🇳 Kannada (ಕನ್ನಡ)</option>
            <option value="ml">🇮🇳 Malayalam (മലയാളം)</option>
            <option value="bn">🇮🇳 Bengali (বাংলা)</option>
            <option value="mr">🇮🇳 Marathi (मराठी)</option>
            <option value="gu">🇮🇳 Gujarati (ગુજરાતી)</option>
            <option value="od">🇮🇳 Odia (ଓଡ଼ିଆ)</option>
            <option value="pa">🇮🇳 Punjabi (ਪੰਜਾਬੀ)</option>
          </select>
        </div>
      </div>

      {/* Truthful Provider Health Banner */}
      <div
        className="voice-engine-banner"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.5rem 0.75rem",
          background: "rgba(15, 23, 42, 0.6)",
          borderRadius: "8px",
          border: "1px solid rgba(51, 65, 85, 0.6)",
          marginBottom: "0.75rem",
          fontSize: "0.825rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background:
                healthData?.status === "ONLINE"
                  ? "#10b981"
                  : healthData?.status === "DEGRADED"
                    ? "#f59e0b"
                    : "#64748b",
              boxShadow:
                healthData?.status === "ONLINE" ? "0 0 8px #10b981" : "none",
            }}
          />
          <span style={{ fontWeight: 600, color: "#f8fafc" }}>
            {healthData?.status === "ONLINE"
              ? "Sarvam Multilingual Speech Engine Active"
              : healthData?.status === "DEGRADED"
                ? "Speech Engine Degraded"
                : healthData?.status === "OFFLINE"
                  ? "Speech Engine Offline"
                  : "Speech Engine in Standby"}
          </span>
        </div>
        <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
          {healthData?.status === "ONLINE"
            ? "Telugu, Hindi, English, Tamil & 6 more"
            : "Manual submission always supported"}
        </span>
      </div>

      {healthData && healthData.status !== "ONLINE" && (
        <div
          style={{
            padding: "0.6rem 0.8rem",
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
            borderRadius: "6px",
            color: "#fbbf24",
            fontSize: "0.85rem",
            marginBottom: "0.75rem",
          }}
        >
          Automatic speech transcription is currently in standby. You can still record audio for operator review or enter details in the manual form.
        </div>
      )}

      {/* Interactive Location / GPS Status Bar for Voice Reporting */}
      <div
        className="voice-location-bar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.6rem 0.85rem",
          background: latitude && longitude ? "rgba(16, 185, 129, 0.08)" : "rgba(30, 41, 59, 0.5)",
          borderRadius: "8px",
          border: latitude && longitude ? "1px solid rgba(16, 185, 129, 0.3)" : "1px dashed rgba(71, 85, 105, 0.6)",
          marginBottom: "0.85rem",
          fontSize: "0.825rem",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: "220px" }}>
          <LocateFixed size={16} color={latitude && longitude ? "#10b981" : "#38bdf8"} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 600, color: latitude && longitude ? "#34d399" : "#e2e8f0" }}>
              {address ? address : (geoBusy ? "Detecting GPS location…" : "No location detected yet")}
            </span>
            {latitude && longitude ? (
              <small style={{ color: "#94a3b8", fontSize: "0.72rem" }}>
                GPS: {latitude}, {longitude} (Ready for Dispatch)
              </small>
            ) : (
              <small style={{ color: "#94a3b8", fontSize: "0.72rem" }}>
                Click 'Use My Current GPS' to automatically acquire your coordinates
              </small>
            )}
          </div>
        </div>
        <button
          type="button"
          className="secondary"
          disabled={geoBusy}
          onClick={locateGps}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: "0.78rem",
            padding: "0.35rem 0.75rem",
            borderRadius: "6px",
            whiteSpace: "nowrap",
            background: latitude && longitude ? "rgba(16, 185, 129, 0.15)" : undefined,
            color: latitude && longitude ? "#34d399" : undefined,
          }}
        >
          <LocateFixed size={13} />
          {geoBusy ? "Locating…" : (latitude && longitude ? "Update GPS" : "Use My Current GPS")}
        </button>
      </div>

      {geoWarning && (
        <div
          style={{
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "6px",
            padding: "0.5rem 0.75rem",
            fontSize: "0.8rem",
            color: "#fef08a",
            marginBottom: "0.75rem",
          }}
        >
          {geoWarning}
        </div>
      )}

      {error && <ErrorBox error={error} />}

      {/* Recording Studio Controls */}
      <div className="recorder-console">
        {stage === "idle" && (
          <div className="recorder-idle">
            <button
              type="button"
              className="record-btn-large"
              aria-label="Start Recording"
              onClick={startRecording}
            >
              <Mic size={28} />
              <span>Start Recording (Tap to Speak)</span>
            </button>
            <p className="hint">
              Speak in your language. Clearly mention what happened, how many are injured, and your location.
            </p>
          </div>
        )}

        {(stage === "recording" || stage === "paused") && (
          <div className="recorder-active">
            <div className="live-status">
              <span
                className={`pulse-dot ${stage === "paused" ? "paused" : ""}`}
              />
              <span className="live-timer">{formatTime(duration)}</span>
              <span className="live-label">
                {stage === "recording" ? "Listening & Recording…" : "Paused"}
              </span>
            </div>

            <div className="waveform-container">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((barIndex) => (
                <div
                  key={barIndex}
                  className={`waveform-bar ${stage === "recording" ? "active" : ""}`}
                  style={{
                    height:
                      stage === "recording"
                        ? `${Math.max(8, Math.min(38, 10 + (audioLevel * ((barIndex % 3) + 1)) * 0.35))}px`
                        : "10px",
                    transition: "height 0.08s ease",
                  }}
                />
              ))}
            </div>

            <div className="active-controls">
              {stage === "recording" ? (
                <button
                  type="button"
                  className="icon-action-btn"
                  onClick={pauseRecording}
                  title="Pause"
                >
                  <Pause size={18} /> Pause
                </button>
              ) : (
                <button
                  type="button"
                  className="icon-action-btn"
                  onClick={resumeRecording}
                  title="Resume"
                >
                  <Play size={18} /> Resume
                </button>
              )}
              <button
                type="button"
                className="icon-action-btn danger"
                onClick={stopRecording}
                title="Finish Speaking"
              >
                <Square size={18} /> Done
              </button>
            </div>
          </div>
        )}

        {stage === "recorded" && (
          <div className="recorder-recorded">
            <div className="audio-preview-card">
              <div className="audio-meta">
                <Volume2 size={20} />
                <span>Recorded Audio ({formatTime(duration)}) · {audioBlob ? (audioBlob.size / 1024).toFixed(0) : "0"} KB</span>
              </div>
              {audioUrl && <audio controls src={audioUrl} className="audio-player" />}
            </div>

            {(!audioBlob || audioBlob.size < 300) && (
              <div
                style={{
                  background: "rgba(245, 158, 11, 0.15)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  borderRadius: "6px",
                  padding: "0.5rem 0.75rem",
                  color: "#fbbf24",
                  fontSize: "0.85rem",
                  margin: "0.5rem 0",
                }}
              >
                ⚠️ No audio detected. Please click <strong>Re-record</strong> and speak into your microphone.
              </div>
            )}

            <div className="recorded-actions">
              <button
                type="button"
                className="secondary"
                onClick={resetRecording}
              >
                <RotateCcw size={16} /> Re-record
              </button>
              <button
                type="button"
                className="primary"
                onClick={processVoiceRecording}
                disabled={!audioBlob || audioBlob.size < 300}
                style={{
                  opacity: (!audioBlob || audioBlob.size < 300) ? 0.6 : 1,
                  cursor: (!audioBlob || audioBlob.size < 300) ? "not-allowed" : "pointer",
                }}
              >
                <Sparkles size={16} /> Transcribe & Extract Info
              </button>
            </div>
          </div>
        )}

        {stage === "processing" && (
          <div className="recorder-processing">
            <div className="spinner-large" />
            <h3 style={{ marginTop: "1rem", color: "#f8fafc" }}>Processing Emergency Voice Report</h3>
            <p style={{ color: "#38bdf8", fontWeight: 500 }}>{processingStatus}</p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.5rem", marginTop: "1.25rem" }}>
              <span style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem", borderRadius: "12px", background: "rgba(34, 197, 94, 0.15)", color: "#4ade80", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
                ✓ Audio Securely Saved
              </span>
              <span style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem", borderRadius: "12px", background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", border: "1px solid rgba(59, 130, 246, 0.3)" }}>
                Sarvam Multilingual STT
              </span>
              <span style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem", borderRadius: "12px", background: "rgba(168, 85, 247, 0.15)", color: "#c084fc", border: "1px solid rgba(168, 85, 247, 0.3)" }}>
                Intelligent Fact Extraction
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
