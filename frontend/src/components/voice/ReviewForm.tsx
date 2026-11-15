import React from "react";
import {
  ArrowUpRight,
  LocateFixed,
  Upload,
  X,
  User,
  Phone,
} from "lucide-react";
import { Guidance, VoiceMessageInput } from "../../Guidance";
import { ExtractedIncidentData } from "../../api";

interface ReviewFormProps {
  detectedLanguage: string;
  transcript: string;
  setTranscript: (t: string) => void;
  followBusy: boolean;
  updateVoiceDetails: (correct?: boolean) => void;
  extraction: ExtractedIncidentData | null;
  setExtraction: React.Dispatch<React.SetStateAction<ExtractedIncidentData | null>>;
  followUp: string;
  setFollowUp: (val: string) => void;
  englishTranslation: string;
  category: "medical" | "road_collision" | "fire" | "disaster" | "other";
  setCategory: (c: "medical" | "road_collision" | "fire" | "disaster" | "other") => void;
  severity: "low" | "medium" | "high" | "critical";
  setSeverity: (s: "low" | "medium" | "high" | "critical") => void;
  description: string;
  setDescription: (d: string) => void;
  address: string;
  setAddress: (a: string) => void;
  latitude: string;
  longitude: string;
  geoBusy: boolean;
  locateGps: () => void;
  onLocationChange?: (lat: string, lng: string, address: string) => void;
  affectedPeople: string;
  setAffectedPeople: (p: string) => void;
  injuries: string;
  setInjuries: (i: string) => void;
  vehicles: string;
  setVehicles: (v: string) => void;
  hazards: string;
  setHazards: (h: string) => void;
  reporterName: string;
  setReporterName: (n: string) => void;
  reporterPhone: string;
  setReporterPhone: (p: string) => void;
  evidenceList: { id: string; name: string; previewUrl: string }[];
  evidenceBusy: boolean;
  handleEvidenceUpload: (files: FileList | null) => void;
  removeEvidence: (id: string) => void;
  resetRecording: () => void;
  submitIncident: () => void;
  submitting: boolean;
}

export function ReviewForm({
  detectedLanguage,
  transcript,
  setTranscript,
  followBusy,
  updateVoiceDetails,
  extraction,
  setExtraction,
  followUp,
  setFollowUp,
  englishTranslation,
  category,
  setCategory,
  severity,
  setSeverity,
  description,
  setDescription,
  address,
  setAddress,
  latitude,
  longitude,
  geoBusy,
  locateGps,
  onLocationChange,
  affectedPeople,
  setAffectedPeople,
  injuries,
  setInjuries,
  vehicles,
  setVehicles,
  hazards,
  setHazards,
  reporterName,
  setReporterName,
  reporterPhone,
  setReporterPhone,
  evidenceList,
  evidenceBusy,
  handleEvidenceUpload,
  removeEvidence,
  resetRecording,
  submitIncident,
  submitting,
}: ReviewFormProps) {
  return (
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

      <button
        type="button"
        className="button secondary"
        disabled={followBusy}
        onClick={() => updateVoiceDetails(true)}
      >
        Re-extract corrected transcript
      </button>

      {extraction && (
        <section className="panel" aria-label="Report clarification">
          <p>Review all details before submitting. Optional questions do not prevent submission.</p>
          {extraction.follow_up_questions?.map((q, i) => (
            <p key={i}>{q}</p>
          ))}
          {extraction.priority_reasons?.map((q, i) => (
            <p key={i}>
              <strong>Priority:</strong> {q}
            </p>
          ))}
          <div className="form-grid">
            {(
              [
                ["total_people", "Total people involved"],
                ["safe_people", "Confirmed safe"],
                ["injured_people", "Injured people"],
                ["missing_people", "Missing people"],
                ["unknown_condition_people", "Condition unknown"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  min="0"
                  max="100000"
                  value={extraction[key] ?? ""}
                  onChange={(e) =>
                    setExtraction({
                      ...extraction,
                      [key]: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
          </div>
          {extraction.conversation?.map((m, i) => (
            <p key={i}>
              <strong>{m.speaker === "citizen" ? "You" : "Assistant"}:</strong> {m.content}
            </p>
          ))}
          <VoiceMessageInput language={detectedLanguage} onText={setFollowUp} />
          <label>
            Clarification or correction
            <textarea
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              placeholder="For example: Two people are safe and do not need assistance."
            />
          </label>
          <button
            type="button"
            className="button secondary"
            disabled={followBusy || !followUp.trim()}
            onClick={() => updateVoiceDetails(false)}
          >
            {followBusy ? "Updating…" : "Update report with this information"}
          </button>
        </section>
      )}

      <Guidance topic={extraction?.guidance_topic} patientGroup={extraction?.patient_group} />

      {englishTranslation && detectedLanguage !== "en" && (
        <div
          className="transcript-box"
          style={{ background: "rgba(30, 41, 59, 0.4)", marginTop: "0.5rem" }}
        >
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.35rem",
          }}
        >
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              marginBottom: "0.25rem",
            }}
          >
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              marginBottom: "0.25rem",
            }}
          >
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
        <label
          className="section-label"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
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
  );
}
