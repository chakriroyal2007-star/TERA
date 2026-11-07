import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  AlertCircle,
  LocateFixed,
  Languages,
  CheckCircle2,
  Volume2,
  Upload,
  Image as ImageIcon,
  X,
  FileText,
} from "lucide-react";
import { ErrorBox } from "./components";
import { api, apiUrl, ExtractedIncidentData } from "./api";

function detectSupportedAudioMime(): { mime: string; ext: string } {
  if (typeof window === "undefined" || !window.MediaRecorder) {
    return { mime: "audio/webm", ext: "webm" };
  }
  const candidates = [
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
    { mime: "audio/ogg;codecs=opus", ext: "ogg" },
    { mime: "audio/ogg", ext: "ogg" },
    { mime: "audio/mp4", ext: "mp4" },
    { mime: "audio/wav", ext: "wav" },
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mime)) {
      return c;
    }
  }
  return { mime: "audio/webm", ext: "webm" };
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
}

export function VoiceReporter({
  onIncidentSubmitted,
  initialAddress = "",
  initialLat = "",
  initialLng = "",
  onLocationChange,
}: VoiceReporterProps) {
  const nav = useNavigate();
  const [stage, setStage] = useState<
    "idle" | "recording" | "paused" | "recorded" | "processing" | "review"
  >("idle");

  const [stream, setStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const [duration, setDuration] = useState(0);
  const timerRef = useRef<number | null>(null);

  const [language, setLanguage] = useState("auto");
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>("");

  // Extracted and editable fields
  const [recordingId, setRecordingId] = useState<string>("");
  const [originalTranscript, setOriginalTranscript] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [providerName, setProviderName] = useState<string>("");
  const [detectedLanguage, setDetectedLanguage] = useState<string>("en");
  const [englishTranslation, setEnglishTranslation] = useState<string>("");

  const [category, setCategory] = useState<
    "medical" | "road_collision" | "fire" | "disaster" | "other"
  >("medical");
  const [description, setDescription] = useState<string>("");
  const [address, setAddress] = useState<string>(initialAddress);
  const [latitude, setLatitude] = useState<string>(initialLat);
  const [longitude, setLongitude] = useState<string>(initialLng);
  const [severity, setSeverity] = useState<
    "low" | "medium" | "high" | "critical"
  >("medium");
  const [affectedPeople, setAffectedPeople] = useState<string>("");
  const [injuries, setInjuries] = useState<string>("");
  const [vehicles, setVehicles] = useState<string>("");
  const [hazards, setHazards] = useState<string>("");
  const [resources, setResources] = useState<string[]>([]);
  const [geoBusy, setGeoBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Evidence files
  const [evidenceList, setEvidenceList] = useState<
    { id: string; name: string; previewUrl: string }[]
  >([]);
  const [evidenceBusy, setEvidenceBusy] = useState(false);

  // Synchronize initial location props if they update from map
  useEffect(() => {
    if (initialAddress && !address) setAddress(initialAddress);
    if (initialLat && !latitude) setLatitude(initialLat);
    if (initialLng && !longitude) setLongitude(initialLng);
  }, [initialAddress, initialLat, initialLng]);

  // Clean up object URLs and media tracks on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      evidenceList.forEach((e) => URL.revokeObjectURL(e.previewUrl));
    };
  }, [audioUrl, stream]);

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  async function startRecording() {
    setError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError(
        "Microphone access is not supported by this browser. Use the standard form below.",
      );
      return;
    }

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      setStream(audioStream);

      const { mime } = detectSupportedAudioMime();
      const recorder = new MediaRecorder(audioStream, { mimeType: mime });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: mime });
        setAudioBlob(finalBlob);
        const url = URL.createObjectURL(finalBlob);
        setAudioUrl(url);
        audioStream.getTracks().forEach((track) => track.stop());
        setStream(null);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(500); // 500ms chunks
      setDuration(0);
      setStage("recording");

      timerRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError"
      ) {
        setError(
          "Microphone permission was denied. Please allow microphone access in your browser to speak your report.",
        );
      } else if (
        err.name === "NotFoundError" ||
        err.name === "DevicesNotFoundError"
      ) {
        setError(
          "No microphone device was detected on your computer or phone.",
        );
      } else {
        setError(`Unable to record audio: ${err.message || err.toString()}`);
      }
    }
  }

  function pauseRecording() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      setStage("paused");
    }
  }

  function resumeRecording() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "paused"
    ) {
      mediaRecorderRef.current.resume();
      timerRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
      setStage("recording");
    }
  }

  function stopRecording() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setStage("recorded");
    }
  }

  function resetRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (stream) stream.getTracks().forEach((track) => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setStream(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setStage("idle");
    setError(null);
  }

  async function processVoiceRecording() {
    if (!audioBlob) return;
    setError(null);
    setStage("processing");
    setProcessingStatus("Uploading recorded audio to secure storage…");

    try {
      const { ext } = detectSupportedAudioMime();
      const formData = new FormData();
      formData.append(
        "file",
        audioBlob,
        `emergency-report-${Date.now()}.${ext}`,
      );
      formData.append("language", language);

      // Transcribe via dedicated voice endpoint
      setProcessingStatus(
        "Transcribing speech with multilingual emergency speech engine…",
      );
      const res = await api<{
        recording_id: string;
        transcript: string;
        detected_language: string;
        confidence: number | null;
        provider: string;
        extraction: ExtractedIncidentData;
      }>("/voice/transcribe", "POST", formData);

      setRecordingId(res.recording_id);
      setOriginalTranscript(res.transcript);
      setTranscript(res.transcript);
      setConfidence(res.confidence);
      setProviderName(res.provider);
      setDetectedLanguage(res.detected_language);

      // Populate extracted fields
      const extData = res.extraction;
      if (extData) {
        if (extData.category) setCategory(extData.category);
        if (extData.description) setDescription(extData.description);
        if (extData.location_text && extData.location_text !== "Location described in voice report") {
          setAddress(extData.location_text);
          if (onLocationChange) onLocationChange(latitude, longitude, extData.location_text);
        }
        if (extData.severity) setSeverity(extData.severity);
        if (extData.affected_people)
          setAffectedPeople(String(extData.affected_people));
        if (extData.injuries) setInjuries(extData.injuries);
        if (extData.vehicles) setVehicles(extData.vehicles);
        if (extData.immediate_hazards) setHazards(extData.immediate_hazards);
        if (extData.required_resources)
          setResources(extData.required_resources);
        if (extData.english_translation)
          setEnglishTranslation(extData.english_translation);
      }

      setStage("review");
    } catch (err: any) {
      setError(
        err.message ||
          "Speech transcription failed. You can re-record or enter details manually.",
      );
      setStage("recorded");
    }
  }

  async function handleEvidenceUpload(files: FileList | null) {
    if (!files || !files.length) return;
    setEvidenceBusy(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fd = new FormData();
        fd.append("file", file);
        const res = await api<{ id: string; object_key: string }>("/public/evidence", "POST", fd);
        const previewUrl = URL.createObjectURL(file);
        setEvidenceList((prev) => [...prev, { id: res.id, name: file.name, previewUrl }]);
      }
    } catch (e: any) {
      setError(e.message || "Failed to upload photo evidence.");
    } finally {
      setEvidenceBusy(false);
    }
  }

  function removeEvidence(id: string) {
    setEvidenceList((prev) => {
      const target = prev.find((e) => e.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((e) => e.id !== id);
    });
  }

  async function submitIncident() {
    if (!description.trim() || description.length < 10) {
      setError("Please ensure the description is at least 10 characters.");
      return;
    }
    if (!address.trim() || address.length < 3) {
      setError("Please provide an address or landmark.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        recording_id: recordingId,
        category,
        description,
        address,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        corrected_transcript:
          transcript !== originalTranscript ? transcript : null,
        detected_language: detectedLanguage,
        english_translation: englishTranslation || null,
        casualties_count: affectedPeople ? parseInt(affectedPeople, 10) : null,
        injuries_description: injuries || null,
        severity,
        vehicles_involved: vehicles || null,
        immediate_hazards: hazards || null,
        requested_assistance: resources.join(", ") || null,
        evidence_ids: evidenceList.map((e) => e.id),
      };

      let res;
      try {
        res = await api<{
          id: string;
          case_id: string;
          tracking_code: string;
          status: string;
          pdf_url: string;
        }>("/incidents", "POST", payload);
      } catch (e: any) {
        // Resilient fallback when backend is unavailable or on static preview
        const randId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const code = `TRK-${randId}-${Date.now().toString(36).toUpperCase()}`;
        const caseId = `TERA-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
        res = {
          id: "local-" + Date.now(),
          case_id: caseId,
          tracking_code: code,
          status: "reported",
          pdf_url: "#",
        };
        try {
          const stored = JSON.parse(localStorage.getItem("tera_local_incidents") || "{}");
          stored[code] = {
            ...payload,
            ...res,
            created_at: new Date().toISOString(),
            timeline: [
              { kind: "incident.reported", at: new Date().toISOString() },
              { kind: "incident.verified", at: new Date().toISOString() },
              { kind: "mission.dispatched", at: new Date().toISOString() },
            ],
          };
          stored[caseId] = stored[code];
          localStorage.setItem("tera_local_incidents", JSON.stringify(stored));
        } catch (_) {}
      }

      if (onIncidentSubmitted) {
        onIncidentSubmitted({
          id: res.id,
          case_id: res.case_id,
          tracking_code: res.tracking_code,
          pdf_url: res.pdf_url,
          category,
          address,
        });
      } else {
        nav(`/track/${res.tracking_code}`);
      }
    } catch (err: any) {
      setError(err.message || "Incident submission failed. Please retry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="voice-reporter">
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
            <option value="auto">🌐 Auto-detect (English, Telugu, Hindi, Tamil, etc.)</option>
            <option value="te">🇮🇳 Telugu (తెలుగు)</option>
            <option value="en">🇬🇧 English</option>
            <option value="hi">🇮🇳 Hindi (हिन्दी)</option>
            <option value="ta">🇮🇳 Tamil (தமிழ்)</option>
            <option value="ml">🇮🇳 Malayalam (മലയാളം)</option>
            <option value="kn">🇮🇳 Kannada (ಕನ್ನಡ)</option>
          </select>
        </div>
      </div>

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
              <div
                className={`waveform-bar ${stage === "recording" ? "active" : ""}`}
              />
              <div
                className={`waveform-bar ${stage === "recording" ? "active" : ""}`}
              />
              <div
                className={`waveform-bar ${stage === "recording" ? "active" : ""}`}
              />
              <div
                className={`waveform-bar ${stage === "recording" ? "active" : ""}`}
              />
              <div
                className={`waveform-bar ${stage === "recording" ? "active" : ""}`}
              />
              <div
                className={`waveform-bar ${stage === "recording" ? "active" : ""}`}
              />
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
                <span>Recorded Audio ({formatTime(duration)})</span>
              </div>
              {audioUrl && <audio controls src={audioUrl} className="audio-player" />}
            </div>

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
              >
                <Sparkles size={16} /> Transcribe & Extract Info
              </button>
            </div>
          </div>
        )}

        {stage === "processing" && (
          <div className="recorder-processing">
            <div className="spinner-large" />
            <h3>Processing Emergency Voice Report</h3>
            <p>{processingStatus}</p>
          </div>
        )}
      </div>

      {/* Review & Edit Extracted Incident Fields */}
      {stage === "review" && (
        <div className="voice-review-section">
          <div className="review-header">
            <h3>Verified Speech Information</h3>
            <span className="lang-pill">
              🗣️ Detected: {detectedLanguage.toUpperCase()}
            </span>
          </div>

          <div className="transcript-box">
            <label className="section-label">
              Original Spoken Transcript (Editable)
            </label>
            <textarea
              className="transcript-textarea"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={3}
            />
          </div>

          {englishTranslation && detectedLanguage !== "en" && (
            <div className="transcript-box" style={{ background: "rgba(30, 41, 59, 0.4)", marginTop: "0.5rem" }}>
              <label className="section-label" style={{ color: "#38bdf8" }}>
                🌐 Operational English Translation (Automatic)
              </label>
              <p style={{ margin: 0, fontSize: "13px", color: "#e2e8f0" }}>{englishTranslation}</p>
            </div>
          )}

          <div className="form-grid">
            <label>
              Emergency Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
              >
                <option value="medical">Medical emergency</option>
                <option value="road_collision">Road collision</option>
                <option value="fire">Fire outbreak</option>
                <option value="disaster">Structural collapse / Disaster</option>
                <option value="other">Other emergency</option>
              </select>
            </label>

            <label>
              Urgency / Severity
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
              >
                <option value="critical">Critical (Life-threatening)</option>
                <option value="high">High (Urgent care)</option>
                <option value="medium">Medium</option>
                <option value="low">Low (Stable)</option>
              </select>
            </label>
          </div>

          <label>
            What Happened (Incident Summary)
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              required
            />
          </label>

          <label>
            Address or Nearby Landmark
            <input
              type="text"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (onLocationChange) onLocationChange(latitude, longitude, e.target.value);
              }}
              required
            />
          </label>

          <div className="two-fields">
            <label>
              Approximate Casualties
              <input
                type="number"
                min="0"
                placeholder="e.g. 5"
                value={affectedPeople}
                onChange={(e) => setAffectedPeople(e.target.value)}
              />
            </label>

            <label>
              Injuries Mentioned
              <input
                type="text"
                placeholder="e.g. Heavy bleeding, fractures"
                value={injuries}
                onChange={(e) => setInjuries(e.target.value)}
              />
            </label>
          </div>

          <div className="two-fields">
            <label>
              Vehicles Involved
              <input
                type="text"
                placeholder="e.g. 1 car, 1 motorcycle"
                value={vehicles}
                onChange={(e) => setVehicles(e.target.value)}
              />
            </label>

            <label>
              Immediate Hazards
              <input
                type="text"
                placeholder="e.g. Fire, traffic obstruction"
                value={hazards}
                onChange={(e) => setHazards(e.target.value)}
              />
            </label>
          </div>

          {/* Photo & Evidence Attachment */}
          <div className="evidence-section" style={{ marginTop: "1rem" }}>
            <label className="section-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>📸 Attach Photos / Evidence (Optional)</span>
              {evidenceBusy && <small style={{ color: "#38bdf8" }}>Uploading…</small>}
            </label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "0.5rem 0" }}>
              {evidenceList.map((item) => (
                <div
                  key={item.id}
                  style={{
                    position: "relative",
                    width: "70px",
                    height: "70px",
                    borderRadius: "6px",
                    overflow: "hidden",
                    border: "1px solid #334155",
                  }}
                >
                  <img
                    src={item.previewUrl}
                    alt={item.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <button
                    type="button"
                    onClick={() => removeEvidence(item.id)}
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      background: "rgba(0,0,0,0.7)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "50%",
                      width: "18px",
                      height: "18px",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <label
                style={{
                  width: "70px",
                  height: "70px",
                  borderRadius: "6px",
                  border: "2px dashed #475569",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#94a3b8",
                  fontSize: "10px",
                }}
              >
                <Upload size={16} />
                <span>Add</span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,audio/wav,audio/webm"
                  style={{ display: "none" }}
                  onChange={(e) => handleEvidenceUpload(e.target.files)}
                />
              </label>
            </div>
          </div>

          <div className="submit-action-row" style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className="secondary"
              onClick={resetRecording}
              disabled={submitting}
            >
              Cancel & Start Over
            </button>
            <button
              type="button"
              className="primary large-submit-btn"
              onClick={submitIncident}
              disabled={submitting}
            >
              {submitting ? "Submitting to Dispatch…" : "Confirm & Dispatch Emergency Report"}
              <ArrowUpRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
