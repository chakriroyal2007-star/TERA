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
} from "lucide-react";
import { ErrorBox } from "./components";
import { api, ExtractedIncidentData } from "./api";

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

export function VoiceReporter() {
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

  const [category, setCategory] = useState<
    "medical" | "road_collision" | "fire" | "disaster" | "other"
  >("medical");
  const [description, setDescription] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [severity, setSeverity] = useState<
    "low" | "medium" | "high" | "critical"
  >("medium");
  const [affectedPeople, setAffectedPeople] = useState<string>("");
  const [resources, setResources] = useState<string[]>([]);
  const [geoBusy, setGeoBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Clean up object URLs and media tracks on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
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

      setStage("recording");
      setDuration(0);
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
      formData.append("duration", duration.toString());

      // 1. Upload recording
      const uploadRes = await api<{ id: string; checksum: string }>(
        "/speech/recordings",
        "POST",
        formData,
      );
      setRecordingId(uploadRes.id);

      // 2. Transcribe
      setProcessingStatus(
        "Transcribing speech with AI emergency speech engine…",
      );
      const transcribeRes = await api<{
        original_transcript: string;
        detected_language: string;
        confidence: number | null;
        provider: string;
        extraction: ExtractedIncidentData;
      }>(`/speech/recordings/${uploadRes.id}/transcribe`, "POST", {
        language: language === "auto" ? null : language,
      });

      setOriginalTranscript(transcribeRes.original_transcript);
      setTranscript(transcribeRes.original_transcript);
      setConfidence(transcribeRes.confidence);
      setProviderName(transcribeRes.provider);

      // Populate extracted fields
      const extData = transcribeRes.extraction;
      if (extData) {
        if (extData.category) setCategory(extData.category);
        if (extData.description) setDescription(extData.description);
        if (extData.location_text) setAddress(extData.location_text);
        if (extData.severity) setSeverity(extData.severity);
        if (extData.affected_people)
          setAffectedPeople(String(extData.affected_people));
        if (extData.required_resources)
          setResources(extData.required_resources);
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

  function locate() {
    setGeoBusy(true);
    if (!navigator.geolocation) {
      setGeoBusy(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLatitude(p.coords.latitude.toFixed(6));
        setLongitude(p.coords.longitude.toFixed(6));
        setGeoBusy(false);
      },
      () => setGeoBusy(false),
      { enableHighAccuracy: true, timeout: 15000 },
    );
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
        confirmed_extraction: {
          category,
          severity,
          affected_people: affectedPeople || null,
          required_resources: resources,
        },
      };

      const res = await api<{ id: string; tracking_code: string }>(
        "/public/voice-incidents",
        "POST",
        payload,
      );
      nav("/track/" + res.tracking_code);
    } catch (err: any) {
      setError(
        err.message ||
          "Failed to submit emergency report. Please verify your fields.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="voice-reporter">
      <div className="voice-flow-header">
        <div className="voice-title">
          <Sparkles className="sparkle-icon" size={20} />
          <strong>AI Emergency Voice Reporting</strong>
        </div>
        <p className="muted">
          Speak naturally in your preferred language. Audio is transcribed,
          incident details are extracted automatically, and you can review
          before submission.
        </p>
      </div>

      {error && <ErrorBox error={error} />}

      {/* Stage: Idle / Recording / Paused / Recorded */}
      {stage !== "review" && (
        <div className="voice-record-card">
          <div className="record-top">
            <div className="lang-picker">
              <Languages size={16} />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={stage !== "idle"}
              >
                <option value="auto">Auto-detect Spoken Language</option>
                <option value="en">English</option>
                <option value="te">Telugu (తెలుగు)</option>
                <option value="hi">Hindi (हिन्दी)</option>
                <option value="es">Spanish (Español)</option>
              </select>
            </div>
            <div className="timer-badge">
              <span
                className={`pulse-dot ${stage === "recording" ? "active" : ""}`}
              />
              <code>{formatTime(duration)}</code>
            </div>
          </div>

          <div className="recorder-visual">
            {stage === "recording" && (
              <div className="waveform-anim">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            )}
            {stage === "paused" && (
              <div className="recording-hint">Recording Paused</div>
            )}
            {stage === "idle" && (
              <div className="recording-hint">
                Click Record and clearly describe what happened, the location,
                and any injuries.
              </div>
            )}
            {stage === "recorded" && audioUrl && (
              <div className="audio-preview">
                <Volume2 size={20} />
                <audio controls src={audioUrl} />
              </div>
            )}
            {stage === "processing" && (
              <div className="processing-indicator">
                <div className="spinner" />
                <p>
                  <strong>{processingStatus}</strong>
                </p>
              </div>
            )}
          </div>

          <div className="record-controls">
            {stage === "idle" && (
              <button
                type="button"
                className="record-btn start"
                onClick={startRecording}
              >
                <Mic size={20} /> Start Recording
              </button>
            )}

            {stage === "recording" && (
              <>
                <button
                  type="button"
                  className="record-btn pause"
                  onClick={pauseRecording}
                >
                  <Pause size={18} /> Pause
                </button>
                <button
                  type="button"
                  className="record-btn stop"
                  onClick={stopRecording}
                >
                  <Square size={18} /> Finish Recording
                </button>
              </>
            )}

            {stage === "paused" && (
              <>
                <button
                  type="button"
                  className="record-btn resume"
                  onClick={resumeRecording}
                >
                  <Play size={18} /> Resume
                </button>
                <button
                  type="button"
                  className="record-btn stop"
                  onClick={stopRecording}
                >
                  <Square size={18} /> Finish Recording
                </button>
              </>
            )}

            {stage === "recorded" && (
              <>
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
                  <Sparkles size={16} /> Transcribe & Extract Incident
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Stage: Review Extracted Details */}
      {stage === "review" && (
        <div className="voice-review-section">
          <div className="review-banner">
            <CheckCircle2 size={20} className="text-success" />
            <div>
              <strong>Speech Transcribed & Emergency Details Extracted</strong>
              <small>
                Provider: {providerName} |{" "}
                {confidence !== null
                  ? `Confidence: ${(confidence * 100).toFixed(0)}%`
                  : "Confidence information not provided by speech provider."}
              </small>
            </div>
          </div>

          <div className="review-fields">
            {audioUrl && (
              <div className="review-audio-box">
                <label>Recorded Audio Statement</label>
                <audio controls src={audioUrl} />
              </div>
            )}

            <label>
              Spoken Transcript (Review & Edit if needed)
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={3}
                placeholder="Spoken words…"
              />
            </label>

            <div className="two-fields">
              <label>
                Emergency Category
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                >
                  <option value="medical">Medical Emergency</option>
                  <option value="road_collision">Road Collision</option>
                  <option value="fire">Fire Incident</option>
                  <option value="disaster">Disaster Report</option>
                  <option value="other">Other Emergency</option>
                </select>
              </label>

              <label>
                Assessed Severity
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as any)}
                >
                  <option value="critical">Critical (Immediate danger)</option>
                  <option value="high">High priority</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
            </div>

            <label>
              Incident Location / Landmark
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, area, landmark, or intersection"
                required
              />
            </label>

            <button
              type="button"
              className="secondary location-btn"
              disabled={geoBusy}
              onClick={locate}
            >
              <LocateFixed size={16} />
              {geoBusy ? "Acquiring GPS…" : "Attach my current GPS coordinates"}
            </button>

            {(latitude || longitude) && (
              <div className="two-fields">
                <label>
                  Latitude
                  <input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                  />
                </label>
                <label>
                  Longitude
                  <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                  />
                </label>
              </div>
            )}

            <label>
              Emergency Situation Details
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
              />
            </label>

            <div className="two-fields">
              <label>
                People Affected
                <input
                  value={affectedPeople}
                  onChange={(e) => setAffectedPeople(e.target.value)}
                  placeholder="e.g. 2 injured"
                />
              </label>
              <label>
                Identified Resources
                <input
                  value={resources.join(", ")}
                  onChange={(e) =>
                    setResources(
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="e.g. Ambulance, Fire Engine"
                />
              </label>
            </div>

            <div className="review-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setStage("recorded")}
              >
                ← Back to Audio
              </button>
              <button
                type="button"
                className="primary bright"
                disabled={submitting}
                onClick={submitIncident}
              >
                {submitting
                  ? "Submitting to Dispatch…"
                  : "Confirm and Submit Emergency Incident"}
                <ArrowUpRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
