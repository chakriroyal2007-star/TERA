import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, ExtractedIncidentData } from "./api";
import {
  ProviderHealth,
  VoiceReporterProps,
  reverseGeocode,
  detectSupportedAudioMime,
} from "./components/voice/types";
import { useVoiceRecording } from "./components/voice/useVoiceRecording";
import { RecordingControls } from "./components/voice/RecordingControls";
import { ReviewForm } from "./components/voice/ReviewForm";

export type { VoiceReporterProps } from "./components/voice/types";

export function VoiceReporter({
  onIncidentSubmitted,
  initialAddress = "",
  initialLat = "",
  initialLng = "",
  onLocationChange,
  onExtractionApplied,
}: VoiceReporterProps) {
  const nav = useNavigate();
  const [language, setLanguage] = useState("auto");

  const {
    stage,
    setStage,
    audioBlob,
    audioUrl,
    audioLevel,
    duration,
    error,
    setError,
    liveTranscriptRef,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording: hookResetRecording,
  } = useVoiceRecording(language);

  // Real-time provider health monitor
  const { data: healthData } = useQuery<ProviderHealth>({
    queryKey: ["speechHealth"],
    queryFn: () => api<ProviderHealth>("/speech/health"),
    staleTime: 30000,
    retry: 1,
  });

  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [processingStatus, setProcessingStatus] = useState<string>("");

  // Extracted and editable fields
  const [extraction, setExtraction] = useState<ExtractedIncidentData | null>(null);
  const [followUp, setFollowUp] = useState("");
  const [followBusy, setFollowBusy] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());
  const [recordingId, setRecordingId] = useState<string>("");
  const [originalTranscript, setOriginalTranscript] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");
  const [, setConfidence] = useState<number | null>(null);
  const [, setProviderName] = useState<string>("");
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

  // Evidence files
  const [evidenceList, setEvidenceList] = useState<
    { id: string; name: string; previewUrl: string }[]
  >([]);
  const [evidenceBusy, setEvidenceBusy] = useState(false);

  function resetRecording() {
    localStorage.removeItem("tera-voice-draft");
    setExtraction(null);
    idempotencyKey.current = crypto.randomUUID();
    hookResetRecording();
  }

  function applyExtraction(extData: ExtractedIncidentData, spokenText: string) {
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
      if (extData.required_resources) setResources(extData.required_resources);
      if (extData.english_translation) setEnglishTranslation(extData.english_translation);
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

  useEffect(() => {
    const draft = localStorage.getItem("tera-voice-draft");
    if (!draft) return;
    let active = true;
    (async () => {
      const meta = await api<any>(`/speech/recordings/${draft}`);
      if (meta.incident_id) {
        localStorage.removeItem("tera-voice-draft");
        return;
      }
      const saved = await api<any>(`/speech/transcripts/${draft}`);
      if (!active) return;
      setRecordingId(draft);
      setOriginalTranscript(saved.original_transcript);
      setTranscript(saved.corrected_transcript || saved.original_transcript);
      setDetectedLanguage(saved.detected_language);
      setProviderName(saved.provider);
      if (saved.extraction) {
        applyExtraction(saved.extraction, saved.corrected_transcript || saved.original_transcript);
      }
      setStage("review");
    })().catch(() => {
      if (active) setError("The saved voice draft could not be loaded. You can record a new report.");
    });
    return () => {
      active = false;
    };
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
      () => {
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

  // Synchronize initial location props if they update from map
  useEffect(() => {
    if (initialAddress && !address) setAddress(initialAddress);
    if (initialLat && !latitude) setLatitude(initialLat);
    if (initialLng && !longitude) setLongitude(initialLng);
  }, [initialAddress, initialLat, initialLng]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      evidenceList.forEach((e) => URL.revokeObjectURL(e.previewUrl));
    };
  }, []);

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

      setProcessingStatus("Transcribing speech with multilingual emergency speech engine…");
      const resData = await api<{
        recording_id: string;
        transcript: string;
        detected_language: string;
        confidence: number | null;
        provider: string;
        extraction: ExtractedIncidentData;
      }>("/voice/transcribe", "POST", formData);

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

  async function updateVoiceDetails(correct = false) {
    setFollowBusy(true);
    setError(null);
    try {
      const result = await api<{ extraction: ExtractedIncidentData }>(
        correct ? `/speech/transcripts/${recordingId}/correct` : `/voice/recordings/${recordingId}/follow-up`,
        "POST",
        correct ? { corrected_transcript: transcript } : { message: followUp },
      );
      applyExtraction(result.extraction, transcript);
      setFollowUp("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setFollowBusy(false);
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
        corrected_transcript: transcript !== originalTranscript ? transcript : null,
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
        confirmed_extraction: extraction
          ? {
              ...extraction,
              assistance_needed: affectedPeople === "" ? null : Number(affectedPeople),
              affected_people: affectedPeople === "" ? null : Number(affectedPeople),
            }
          : {},
      };

      const res = await api<{
        id: string;
        case_id: string;
        tracking_code: string;
        status: string;
        pdf_url: string;
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
      <RecordingControls
        stage={stage}
        healthData={healthData}
        language={language}
        setLanguage={setLanguage}
        latitude={latitude}
        longitude={longitude}
        address={address}
        geoBusy={geoBusy}
        geoWarning={geoWarning}
        locateGps={locateGps}
        error={error}
        duration={duration}
        audioLevel={audioLevel}
        audioBlob={audioBlob}
        audioUrl={audioUrl}
        processingStatus={processingStatus}
        startRecording={startRecording}
        pauseRecording={pauseRecording}
        resumeRecording={resumeRecording}
        stopRecording={stopRecording}
        resetRecording={resetRecording}
        processVoiceRecording={processVoiceRecording}
      />

      {stage === "review" && (
        <ReviewForm
          detectedLanguage={detectedLanguage}
          transcript={transcript}
          setTranscript={setTranscript}
          followBusy={followBusy}
          updateVoiceDetails={updateVoiceDetails}
          extraction={extraction}
          setExtraction={setExtraction}
          followUp={followUp}
          setFollowUp={setFollowUp}
          englishTranslation={englishTranslation}
          category={category}
          setCategory={setCategory}
          severity={severity}
          setSeverity={setSeverity}
          description={description}
          setDescription={setDescription}
          address={address}
          setAddress={setAddress}
          latitude={latitude}
          longitude={longitude}
          geoBusy={geoBusy}
          locateGps={locateGps}
          onLocationChange={onLocationChange}
          affectedPeople={affectedPeople}
          setAffectedPeople={setAffectedPeople}
          injuries={injuries}
          setInjuries={setInjuries}
          vehicles={vehicles}
          setVehicles={setVehicles}
          hazards={hazards}
          setHazards={setHazards}
          reporterName={reporterName}
          setReporterName={setReporterName}
          reporterPhone={reporterPhone}
          setReporterPhone={setReporterPhone}
          evidenceList={evidenceList}
          evidenceBusy={evidenceBusy}
          handleEvidenceUpload={handleEvidenceUpload}
          removeEvidence={removeEvidence}
          resetRecording={resetRecording}
          submitIncident={submitIncident}
          submitting={submitting}
        />
      )}
    </div>
  );
}
