import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
  Activity,
  User,
  Phone,
} from "lucide-react";
import { Guidance, VoiceMessageInput } from "./Guidance";
import { ErrorBox } from "./components";
import { api, apiUrl, ExtractedIncidentData } from "./api";
import { extractIncidentFromText, detectScriptLanguage } from "./extraction";

interface ProviderHealth {
  status: "ONLINE" | "DEGRADED" | "NOT_CONFIGURED" | "OFFLINE";
  provider: string;
  message: string;
  audio_processing_ready: boolean;
  ffmpeg_available: boolean;
  supported_languages: string[];
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
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

function detectSupportedAudioMime(): { mime: string; cleanMime: string; ext: string } {
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

export function VoiceReporter({
  onIncidentSubmitted,
  initialAddress = "",
  initialLat = "",
  initialLng = "",
  onLocationChange,
  onExtractionApplied,
}: VoiceReporterProps) {
  const nav = useNavigate();
  const [stage, setStage] = useState<
    "idle" | "recording" | "paused" | "recorded" | "processing" | "review"
  >("idle");

  // Real-time provider health monitor
  const { data: healthData } = useQuery<ProviderHealth>({
    queryKey: ["speechHealth"],
    queryFn: () => api<ProviderHealth>("/speech/health"),
    staleTime: 30000,
    retry: 1,
  });

  const [stream, setStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Live audio level visualizer
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [duration, setDuration] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef<string>("");

  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");

  const [language, setLanguage] = useState("auto");
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>("");

  // Extracted and editable fields
  const [extraction, setExtraction] = useState<ExtractedIncidentData | null>(null);
  const [followUp, setFollowUp] = useState("");
  const [followBusy, setFollowBusy] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());
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
  const [geoWarning, setGeoWarning] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const draft = localStorage.getItem("tera-voice-draft");
    if (!draft) return;
    let active = true;
    (async () => {
      const meta = await api<any>(`/speech/recordings/${draft}`);
      if (meta.incident_id) { localStorage.removeItem("tera-voice-draft"); return; }
      const saved = await api<any>(`/speech/transcripts/${draft}`);
      if (!active) return;
      setRecordingId(draft); setOriginalTranscript(saved.original_transcript);
      setTranscript(saved.corrected_transcript || saved.original_transcript);
      setDetectedLanguage(saved.detected_language); setProviderName(saved.provider);
      if (saved.extraction) applyExtraction(saved.extraction, saved.corrected_transcript || saved.original_transcript);
      setStage("review");
    })().catch(() => { if (active) setError("The saved voice draft could not be loaded. You can record a new report."); });
    return () => { active = false; };
  }, []);

  function locateGps() {
    setGeoBusy(true);
    setGeoWarning("");
    if (!navigator.geolocation) {
      setGeoBusy(false);
      setGeoWarning("Geolocation is not supported by your browser. Please type landmark manually.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const latStr = p.coords.latitude.toFixed(6);
        const lngStr = p.coords.longitude.toFixed(6);
        setLatitude(latStr);
        setLongitude(lngStr);
        setGeoBusy(false);
        const rev = await reverseGeocode(p.coords.latitude, p.coords.longitude);
        if (rev) {
          setAddress(rev);
          if (onLocationChange) onLocationChange(latStr, lngStr, rev);
        }
      },
      (e) => {
        setGeoBusy(false);
        setGeoWarning("Location permission not granted. You can type address manually.");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  // Automatically attempt to acquire GPS coordinates on mount if none are provided
  useEffect(() => {
    if (!latitude || !longitude || !address) {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (p) => {
            const latStr = p.coords.latitude.toFixed(6);
            const lngStr = p.coords.longitude.toFixed(6);
            setLatitude((prev) => prev || latStr);
            setLongitude((prev) => prev || lngStr);
            const rev = await reverseGeocode(p.coords.latitude, p.coords.longitude);
            if (rev) {
              setAddress((prev) => prev || rev);
              if (onLocationChange) onLocationChange(latStr, lngStr, rev);
            }
          },
          () => {},
          { enableHighAccuracy: true, timeout: 10000 },
        );
      }
    }
  }, []);

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

  // Clean up object URLs, audio contexts and media tracks on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
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

      // Initialize live audio level meter
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          const source = audioCtx.createMediaStreamSource(audioStream);
          source.connect(analyser);
          audioContextRef.current = audioCtx;
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateLevel = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;
            setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(updateLevel);
          };
          updateLevel();
        }
      } catch (_) {}

      const { mime, cleanMime } = detectSupportedAudioMime();
      const recorder = new MediaRecorder(audioStream, { mimeType: mime });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const elapsedSecs = Math.max(1, Math.round((Date.now() - (startTimeRef.current || Date.now())) / 1000));
        setDuration(elapsedSecs);
        const finalBlob = new Blob(chunksRef.current, { type: cleanMime });
        setAudioBlob(finalBlob);
        const url = URL.createObjectURL(finalBlob);
        setAudioUrl(url);
        audioStream.getTracks().forEach((track) => track.stop());
        setStream(null);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
          audioContextRef.current.close().catch(() => {});
        }
        setAudioLevel(0);
        setStage("recorded"); // Transition here so finalBlob and duration are fully ready!
      };

      mediaRecorderRef.current = recorder;
      recorder.start(500); // 500ms chunks
      startTimeRef.current = Date.now();
      liveTranscriptRef.current = "";
      setDuration(0);
      setStage("recording");

      // Start continuous browser Web Speech API for unlimited speech capture
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = language === "auto" ? "en-IN" : (language === "te" ? "te-IN" : (language === "hi" ? "hi-IN" : `${language}-IN`));
          recognition.onresult = (event: any) => {
            let full = "";
            for (let i = 0; i < event.results.length; i++) {
              full += event.results[i][0].transcript + " ";
            }
            if (full.trim()) {
              liveTranscriptRef.current = full.trim();
            }
          };
          recognition.start();
          recognitionRef.current = recognition;
        } catch (_) {}
      }

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
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    if (timerRef.current) clearInterval(timerRef.current);

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        if (typeof mediaRecorderRef.current.requestData === "function") {
          mediaRecorderRef.current.requestData();
        }
      } catch (_) {}
      mediaRecorderRef.current.stop();
      // Note: recorder.onstop transitions to stage "recorded" once finalBlob is ready!
    } else {
      setStage("recorded");
    }
  }

  function resetRecording() {
    localStorage.removeItem("tera-voice-draft");
    setExtraction(null);
    idempotencyKey.current = crypto.randomUUID();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    liveTranscriptRef.current = "";
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    if (stream) stream.getTracks().forEach((track) => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setStream(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setAudioLevel(0);
    setStage("idle");
    setError(null);
  }

  async function processVoiceRecording() {
    if (!audioBlob || audioBlob.size < 300) {
      setError(
        "Recording is empty. Please click 'Re-record', speak your emergency clearly into your microphone, and click Done."
      );
      return;
    }
    setError(null);
    setStage("processing");
    setProcessingStatus("Preparing recorded audio for transcription…");

    try {
      const { ext, cleanMime } = detectSupportedAudioMime();
      const cleanAudioFile = new File([audioBlob], `recording-${Date.now()}.${ext}`, {
        type: cleanMime,
      });
      const formData = new FormData();
      formData.append("file", cleanAudioFile);
      formData.append("language", language);

      let resData: {
        recording_id: string;
        transcript: string;
        detected_language: string;
        confidence: number | null;
        provider: string;
        extraction: ExtractedIncidentData;
      } | null = null;

      const liveText = liveTranscriptRef.current?.trim() || "";

      // 2. Call backend /voice/transcribe (Backend automatically handles any audio length via intelligent chunking)
      try {
        setProcessingStatus(
          "Transcribing speech with multilingual emergency speech engine…",
        );
        resData = await api<{
          recording_id: string;
          transcript: string;
          detected_language: string;
          confidence: number | null;
          provider: string;
          extraction: ExtractedIncidentData;
        }>("/voice/transcribe", "POST", formData);
      } catch (backendErr) {
        throw backendErr;
      }

      if (!resData?.transcript?.trim()) {
        throw new Error(
          "No speech was recognized. Speak closer to the microphone and try again, or use the text report.",
        );
      }

      setRecordingId(resData.recording_id);
      setOriginalTranscript(resData.transcript);
      setTranscript(resData.transcript);
      setConfidence(resData.confidence);
      setProviderName(resData.provider);
      setDetectedLanguage(resData.detected_language);

      applyExtraction(resData.extraction, resData.transcript);
      localStorage.setItem("tera-voice-draft", resData.recording_id);
      setStage("review");
    } catch (err: any) {
      setError(
        err.message ||
          "Speech transcription failed. You can re-record or enter details manually.",
      );
      setStage("recorded");
    }
  }

  function applyExtraction(extData: ExtractedIncidentData, spokenText: string) {
      // Populate extracted fields

      if (extData) {
        if (extData.category) setCategory(extData.category);
        if (extData.description) setDescription(extData.description);
        if (extData.location_text && extData.location_text !== "Location described in voice report") {
          setAddress(extData.location_text);
          if (onLocationChange) onLocationChange(latitude, longitude, extData.location_text);
        }
        if (extData.severity) setSeverity(extData.severity);
        setAffectedPeople(extData.affected_people != null ? String(extData.affected_people) : "");
        setExtraction(extData);
        if (extData.injuries) setInjuries(extData.injuries);
        if (extData.vehicles) setVehicles(extData.vehicles);
        if (extData.immediate_hazards) setHazards(extData.immediate_hazards);
        if (extData.required_resources)
          setResources(extData.required_resources);
        if (extData.english_translation)
          setEnglishTranslation(extData.english_translation);
        if ((extData as any).reporter_name && !reporterName) {
          setReporterName((extData as any).reporter_name);
        }
        if ((extData as any).reporter_phone && !reporterPhone) {
          setReporterPhone((extData as any).reporter_phone);
        }
        if ((extData as any).reporter_contact) {
          const contact = (extData as any).reporter_contact;
          const phoneM = contact.match(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/);
          if (phoneM && !reporterPhone) setReporterPhone(phoneM[0]);
        }
        if (onExtractionApplied) {
          onExtractionApplied(extData, spokenText);
        }
      }

  }

  async function updateVoiceDetails(correct = false) {
    setFollowBusy(true); setError(null);
    try {
      const result = await api<{extraction: ExtractedIncidentData}>(
        correct ? `/speech/transcripts/${recordingId}/correct` : `/voice/recordings/${recordingId}/follow-up`,
        "POST", correct ? {corrected_transcript: transcript} : {message: followUp});
      applyExtraction(result.extraction, transcript);
      setFollowUp("");
    } catch (e: any) { setError(e.message); }
    finally { setFollowBusy(false); }
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
        citizen_contact:
          reporterName && reporterPhone
            ? `${reporterName} (Phone: ${reporterPhone})`
            : reporterPhone
              ? `Phone: ${reporterPhone}`
              : reporterName || null,
        evidence_ids: evidenceList.map((e) => e.id),
        idempotency_key: idempotencyKey.current,
        confirmed_extraction: extraction ? {...extraction, assistance_needed: affectedPeople === "" ? null : Number(affectedPeople), affected_people: affectedPeople === "" ? null : Number(affectedPeople)} : {},
      };

      const res = await api<{
        id: string; case_id: string; tracking_code: string; status: string; pdf_url: string;
      }>("/incidents", "POST", payload);

      localStorage.removeItem("tera-voice-draft");
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

      {/* Review & Edit Extracted Incident Fields */}
      {stage === "review" && (
        <div className="voice-review-section">
          <div className="review-header">
            <h3>Review speech information</h3>
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

          <button type="button" className="button secondary" disabled={followBusy} onClick={() => updateVoiceDetails(true)}>Re-extract corrected transcript</button>
          {extraction && <section className="panel" aria-label="Report clarification">
            <p>Review all details before submitting. Optional questions do not prevent submission.</p>
            {extraction.follow_up_questions?.map((q, i) => <p key={i}>{q}</p>)}
            {extraction.priority_reasons?.map((q, i) => <p key={i}><strong>Priority:</strong> {q}</p>)}
            <div className="form-grid">
              {([['total_people', 'Total people involved'], ['safe_people', 'Confirmed safe'], ['injured_people', 'Injured people'], ['missing_people', 'Missing people'], ['unknown_condition_people', 'Condition unknown']] as const).map(([key, label]) =>
                <label key={key}>{label}<input type="number" min="0" max="100000" value={extraction[key] ?? ""} onChange={e => setExtraction({...extraction, [key]: e.target.value === "" ? null : Number(e.target.value)})} /></label>)}
            </div>
            {extraction.conversation?.map((m, i) => <p key={i}><strong>{m.speaker === "citizen" ? "You" : "Assistant"}:</strong> {m.content}</p>)}
            <VoiceMessageInput language={detectedLanguage} onText={setFollowUp} />
            <label>Clarification or correction<textarea value={followUp} onChange={e => setFollowUp(e.target.value)} placeholder="For example: Two people are safe and do not need assistance." /></label>
            <button type="button" className="button secondary" disabled={followBusy || !followUp.trim()} onClick={() => updateVoiceDetails()}>{followBusy ? "Updating…" : "Update report with this information"}</button>
          </section>}
          <Guidance topic={extraction?.guidance_topic} patientGroup={extraction?.patient_group} />
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

          <div style={{ margin: "0.75rem 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
              <label style={{ margin: 0, fontWeight: 600 }}>Address or Nearby Landmark</label>
              <button
                type="button"
                className="secondary"
                disabled={geoBusy}
                onClick={locateGps}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontSize: "0.8rem",
                  padding: "0.3rem 0.65rem",
                  borderRadius: "6px",
                  color: "#38bdf8",
                  cursor: "pointer",
                }}
              >
                <LocateFixed size={14} />
                {geoBusy ? "Detecting GPS…" : "Use My Current GPS"}
              </button>
            </div>
            <input
              type="text"
              value={address}
              placeholder="e.g. Near Bus Stand, Tirupati"
              onChange={(e) => {
                setAddress(e.target.value);
                if (onLocationChange) onLocationChange(latitude, longitude, e.target.value);
              }}
              required
            />
            {latitude && longitude && (
              <small style={{ color: "#34d399", display: "block", marginTop: "0.25rem" }}>
                📍 GPS Coordinates Attached: {latitude}, {longitude}
              </small>
            )}
          </div>

          <div className="two-fields">
            <label>
              People requiring assistance
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

          <div className="two-fields" style={{ marginTop: "0.5rem" }}>
            <label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.25rem" }}>
                <User size={14} color="#38bdf8" />
                <span>Your Name (Caller / Witness)</span>
              </div>
              <input
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
              />
            </label>

            <label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.25rem" }}>
                <Phone size={14} color="#34d399" />
                <span>Phone / Contact Number</span>
              </div>
              <input
                type="tel"
                placeholder="e.g. +91 98765 43210"
                value={reporterPhone}
                onChange={(e) => setReporterPhone(e.target.value)}
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
