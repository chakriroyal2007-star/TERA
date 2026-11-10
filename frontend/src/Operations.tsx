import { apiList, apiCollection } from "./api";
import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Radio,
  CheckCircle2,
  Mic,
  FileDown,
  Volume2,
  Activity,
  AlertTriangle,
  Phone,
  User as UserIcon,
  Download,
  Building2,
  Bed,
  Check,
  X,
  Shield,
  Stethoscope,
  HeartHandshake,
  Plus,
  Search,
  Sparkles,
  RefreshCw,
  History,
  LocateFixed,
  Calendar,
  Navigation2,
} from "lucide-react";
import {
  api,
  apiUrl,
  queryClient,
  Incident,
  Mission,
  User,
  label,
  date,
  timeAgo,
  IncidentVoiceDetails,
} from "./api";
import {
  PageHead,
  Panel,
  Empty,
  Loading,
  ErrorBox,
  Badge,
  DataForm,
  Action,
} from "./components";
import { Map } from "./Map";
export function IncidentList({ user }: { user: User }) {
  const [offset, setOffset] = useState(0),
    [status, setStatus] = useState("");

  const q = useQuery({
    queryKey: ["incidents", offset, status],
    queryFn: () => api<{ items: Incident[]; total: number }>(
      `/incidents?offset=${offset}&limit=50${status ? "&status=" + status : ""}`,
    ),
    refetchInterval: 2500,
  });

  // Listen for instant incident submission across any tab/window for 0ms latency update
  useEffect(() => {
    const handleImmediateUpdate = () => {
      q.refetch();
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    };

    window.addEventListener("storage", handleImmediateUpdate);
    window.addEventListener("tera_incident_reported", handleImmediateUpdate);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("tera_incidents_channel");
      bc.onmessage = () => handleImmediateUpdate();
    } catch (_) {}

    return () => {
      window.removeEventListener("storage", handleImmediateUpdate);
      window.removeEventListener("tera_incident_reported", handleImmediateUpdate);
      if (bc) bc.close();
    };
  }, []);
  return (
    <>
      <PageHead
        eyebrow="Operations / Incident desk"
        title="Every report. One shared view."
      >
        Review incoming reports and coordinate the next step.
      </PageHead>
      <div className="metrics">
        <div>
          <span>Matching incidents</span>
          <strong>{q.data?.total ?? "—"}</strong>
          <small>From persisted reports</small>
        </div>
        <div>
          <span>Access scope</span>
          <strong className="text-stat">{label(user.role)}</strong>
          <small>Server-authorized records</small>
        </div>
        <div>
          <span>Response workflow</span>
          <strong className="text-stat">Report → Care</strong>
          <small>Tracked through handover</small>
        </div>
      </div>
      <Panel
        title="Incident queue"
        aside={
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">All statuses</option>
            {[
              "reported",
              "verified",
              "dispatched",
              "active",
              "handover",
              "closed",
              "duplicate",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        }
      >
        <ErrorBox error={q.error} />
        {q.isLoading ? (
          <Loading />
        ) : q.data?.items.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Incident</th>
                    <th>Location</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Reported</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(q.data?.items || []).map((i) => (
                    <tr key={i?.id || Math.random()}>
                      <td>
                        <Link
                          className="table-link"
                          to={"/app/incidents/" + (i?.id || "")}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span>{label(i?.category)}</span>
                            {i?.created_at && (Date.now() - new Date(i.created_at).getTime() < 15 * 60 * 1000) && (
                              <span
                                style={{
                                  fontSize: "0.65rem",
                                  padding: "0.1rem 0.35rem",
                                  borderRadius: "4px",
                                  background: "rgba(239, 68, 68, 0.2)",
                                  color: "#f87171",
                                  fontWeight: 700,
                                  border: "1px solid rgba(239, 68, 68, 0.4)",
                                }}
                              >
                                ⚡ NEW
                              </span>
                            )}
                          </div>
                          <small style={{ color: "#38bdf8", fontWeight: 600 }}>
                            {i?.case_id || (i?.id ? String(i.id).slice(0, 8).toUpperCase() : "CASE")}
                          </small>
                        </Link>
                      </td>
                      <td className="truncate">{i?.address || "Address not specified"}</td>
                      <td>
                        <Badge value={i?.priority || "unassessed"} />
                      </td>
                      <td>
                        <Badge value={i?.status || "reported"} />
                      </td>
                      <td className="muted">
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span>{date(i?.created_at)}</span>
                          {timeAgo(i?.created_at) && (
                            <small style={{ color: "#38bdf8", fontSize: "0.74rem", fontWeight: 600 }}>
                              {timeAgo(i?.created_at)}
                            </small>
                          )}
                        </div>
                      </td>
                      <td>
                        <Link
                          aria-label={"Open incident " + (i?.id || "")}
                          to={"/app/incidents/" + (i?.id || "")}
                        >
                          <ArrowUpRight size={18} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                {offset + 1}–{Math.min(offset + 20, q.data.total)} of{" "}
                {q.data.total}
              </span>
              <button
                className="secondary"
                disabled={!offset}
                onClick={() => setOffset(offset - 20)}
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <button
                className="secondary"
                disabled={offset + 20 >= q.data.total}
                onClick={() => setOffset(offset + 20)}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        ) : (
          !q.error && (
            <Empty title="The incident queue is clear">
              New emergency reports will appear here. No demonstration incidents
              have been added.
            </Empty>
          )
        )}
      </Panel>
      <Panel title="Recorded locations">
        <Map
          points={(q.data?.items || []).map((i) => ({
            ...i,
            name: label(i.category),
            detail: i.address,
          }))}
        />
      </Panel>
    </>
  );
}
export function IncidentDetail({ user }: { user: User }) {
  const { id } = useParams();
  const ops = ["operator", "admin"].includes(user.role);
  const q = useQuery({
    queryKey: ["incident", id],
    queryFn: () => api<Incident>("/incidents/" + id),
  });
  const fleet = useQuery({
    queryKey: ["ambulances"],
    queryFn: () => apiList<any>("/ambulances"),
    enabled: ops,
  });
  const responders = useQuery({
    queryKey: ["responders"],
    queryFn: () => apiList<any>("/responders"),
    enabled: ops,
  });
  const hospitals = useQuery({
    queryKey: ["hospitals"],
    queryFn: () => apiList<any>("/hospitals"),
  });
  const suggestions = useQuery({
    queryKey: ["suggestions", id],
    queryFn: async () => {
      try {
        return await api("/incidents/" + id + "/suggestions");
      } catch (_) {
        return { hospitals: [], ambulances: [], delay_alert: false, possible_duplicates: [] };
      }
    },
    enabled: ops,
  });
  const evidence = useQuery({
    queryKey: ["evidence", id],
    queryFn: async () => {
      try {
        return await api<any[]>("/incidents/" + id + "/evidence");
      } catch (_) {
        return [];
      }
    },
    enabled: user.role !== "analyst",
  });
  const voice = useQuery({
    queryKey: ["incident-voice", id],
    queryFn: () => api<IncidentVoiceDetails>("/incidents/" + id + "/voice"),
  });
  const companion = useQuery({
    queryKey: ["incident-companion", id],
    queryFn: () => api<any>("/companion/incidents/" + id + "/session"),
    enabled: ops,
    refetchInterval: 5000,
  });
  if (q.isLoading) return <Loading />;
  if (!q.data) return <ErrorBox error={q.error} />;
  const i = q.data;
  const base = "/incidents/" + id;
  return (
    <>
      <Link to="/app" className="back-link">
        ← Incident queue
      </Link>
      <PageHead
        eyebrow={"Incident / " + (i.case_id || i.id.slice(0, 8).toUpperCase())}
        title={label(i.category)}
        action={
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <a
              href={apiUrl("/incidents/" + id + "/report")}
              className="pdf-download-btn"
              download={i.case_id ? `${i.case_id}.pdf` : `incident-${id}.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              title="Download Official Incident PDF Report"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.4rem 0.75rem",
                fontSize: "0.85rem",
                fontWeight: 600,
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--foreground)",
                textDecoration: "none",
              }}
            >
              <FileDown size={15} /> Incident PDF
            </a>
            <Badge value={i.status} />
          </div>
        }
      >
        {i.address}
      </PageHead>
      <div className="two-col">
        <div>
          <Panel title="Situation overview">
            <p className="description">{i.description}</p>
            {(() => {
              const rawContact =
                i.citizen_contact ||
                (i as any).caller_phone ||
                (i as any).reporter_phone ||
                ((i as any).caller_name || (i as any).reporter_name
                  ? `${(i as any).caller_name || (i as any).reporter_name}${((i as any).caller_phone || (i as any).reporter_phone) ? ` (Phone: ${(i as any).caller_phone || (i as any).reporter_phone})` : ""}`
                  : null);
              if (!rawContact) return null;
              const phoneMatch = String(rawContact).match(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/);
              return (
                <div
                  style={{
                    margin: "0.75rem 0",
                    padding: "0.6rem 0.85rem",
                    borderRadius: "6px",
                    background: "rgba(56, 189, 248, 0.1)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <UserIcon size={16} color="#38bdf8" />
                    <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "#e2e8f0" }}>
                      Caller / Witness Contact: {rawContact}
                    </span>
                  </div>
                  {phoneMatch && (
                    <a
                      href={`tel:${phoneMatch[0].replace(/[\s-]/g, "")}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        padding: "0.3rem 0.75rem",
                        borderRadius: "6px",
                        background: "#10b981",
                        color: "#ffffff",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      <Phone size={13} /> Call Caller Now
                    </a>
                  )}
                </div>
              );
            })()}
            <div className="meta-row">
              <Badge value={i.priority} />
              <span>
                <Clock3 size={14} /> {date(i.created_at)}
              </span>
            </div>
          </Panel>
          {voice.data?.has_voice && (
            <Panel
              title="Emergency voice recording & speech pipeline"
              aside={
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "4px",
                    background: "rgba(220, 38, 38, 0.1)",
                    color: "var(--danger)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                  }}
                >
                  <Mic size={14} /> Voice Verified
                </span>
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div
                  style={{
                    padding: "1rem",
                    borderRadius: "8px",
                    background: "var(--surface-muted, #f8fafc)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <label style={{ fontWeight: 600, margin: 0 }}>
                      Spoken Audio Statement
                    </label>
                    <a
                      href={voice.data?.recording?.audio_url ? apiUrl(voice.data.recording.audio_url) : apiUrl("/incidents/" + id + "/audio")}
                      download={`tera_emergency_${id}.webm`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        fontSize: "0.78rem",
                        color: "#38bdf8",
                        textDecoration: "none",
                      }}
                    >
                      <Download size={13} /> Save Audio
                    </a>
                  </div>
                  <audio
                    controls
                    src={voice.data?.recording?.audio_url ? apiUrl(voice.data.recording.audio_url) : apiUrl("/incidents/" + id + "/audio")}
                    preload="metadata"
                    style={{ width: "100%", marginBottom: "0.5rem" }}
                  />
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                      fontSize: "0.78rem",
                      color: "var(--muted)",
                    }}
                  >
                    <span>Duration: {typeof voice.data?.recording?.duration === "number" ? voice.data.recording.duration.toFixed(1) : "0.0"}s</span>
                    <span>Format: {voice.data?.recording?.mime_type || "audio/webm"}</span>
                    <span>
                      Size: {Math.ceil((voice.data?.recording?.file_size || 0) / 1024)} KB
                    </span>
                    <span
                      title={voice.data?.recording?.checksum || ""}
                      style={{ fontFamily: "monospace" }}
                    >
                      SHA-256: {voice.data?.recording?.checksum ? String(voice.data.recording.checksum).slice(0, 16) : "—"}…
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                    <strong>Speech Engine:</strong>{" "}
                    {voice.data.transcript?.provider || "Configured Provider"}{" "}
                    · <strong>Language:</strong>{" "}
                    {voice.data.transcript?.language?.toUpperCase() || "EN"}{" "}
                    · <strong>Confidence:</strong>{" "}
                    {voice.data.transcript?.confidence !== null &&
                    voice.data.transcript?.confidence !== undefined
                      ? `${(voice.data.transcript.confidence * 100).toFixed(0)}%`
                      : "Confidence information not provided by speech provider."}
                  </div>

                  <div
                    style={{
                      padding: "0.75rem",
                      background: "rgba(15, 23, 42, 0.03)",
                      borderRadius: "6px",
                      borderLeft: "3px solid var(--primary, #0f172a)",
                    }}
                  >
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                      Original Spoken Transcript (Verbatim):
                    </div>
                    <p style={{ margin: 0, fontStyle: "italic", fontSize: "0.9rem" }}>
                      "{voice.data.transcript?.original || "No transcript recorded"}"
                    </p>
                  </div>

                  {voice.data.transcript?.corrected &&
                    voice.data.transcript.corrected !==
                      voice.data.transcript.original && (
                      <div
                        style={{
                          padding: "0.75rem",
                          background: "rgba(37, 99, 235, 0.05)",
                          borderRadius: "6px",
                          borderLeft: "3px solid #2563eb",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            color: "#1d4ed8",
                            marginBottom: "0.25rem",
                          }}
                        >
                          Reporter Corrected Transcript:
                        </div>
                        <p style={{ margin: 0, fontSize: "0.9rem" }}>
                          "{voice.data.transcript.corrected}"
                        </p>
                      </div>
                    )}

                  {voice.data.extraction && (
                    <div
                      style={{
                        padding: "0.75rem",
                        borderRadius: "6px",
                        background: "rgba(220, 38, 38, 0.04)",
                        border: "1px solid rgba(220, 38, 38, 0.2)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          color: "var(--danger, #dc2626)",
                          marginBottom: "0.5rem",
                        }}
                      >
                        AI Extracted Incident Details
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                          gap: "0.5rem",
                          fontSize: "0.85rem",
                        }}
                      >
                        <div>
                          <small style={{ color: "var(--muted)", display: "block" }}>
                            Category
                          </small>
                          <strong>{label(voice.data.extraction.category)}</strong>
                        </div>
                        <div>
                          <small style={{ color: "var(--muted)", display: "block" }}>
                            Extracted Severity
                          </small>
                          <Badge value={voice.data.extraction.severity} />
                        </div>
                        <div>
                          <small style={{ color: "var(--muted)", display: "block" }}>
                            People requiring assistance
                          </small>
                          <strong>
                            {voice.data.extraction.affected_people ?? "Not specified"}
                          </strong>
                        </div>
                        <div>
                          <small style={{ color: "var(--muted)", display: "block" }}>
                            Required Resources
                          </small>
                          <span>
                            {voice.data.extraction.required_resources?.join(", ") ||
                              "None specified"}
                          </span>
                        </div>
                      </div>
                      <dl>
                        {([['total_people','Total involved'],['safe_people','Confirmed safe'],['injured_people','Injured'],['missing_people','Missing'],['unknown_condition_people','Condition unknown']] as const).map(([key,label]) => <div key={key}><dt>{label}</dt><dd>{voice.data?.extraction?.[key] ?? 'Not specified'}</dd></div>)}
                      </dl>
                      {voice.data.extraction.priority_reasons?.map((reason,index)=><p key={index}>AI recommendation: {reason}</p>)}
                      {voice.data.extraction.immediate_safety_concerns && (
                        <div
                          style={{
                            marginTop: "0.5rem",
                            paddingTop: "0.5rem",
                            borderTop: "1px dashed rgba(220, 38, 38, 0.2)",
                            color: "var(--danger)",
                            fontSize: "0.82rem",
                          }}
                        >
                          <strong>Hazard Warning:</strong>{" "}
                          {voice.data.extraction.immediate_safety_concerns}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          )}
          {companion.data?.has_session && (
            <Panel
              title="Live AI Emergency First-Aid Companion"
              aside={
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "4px",
                    background:
                      companion.data.status === "escalation_required"
                        ? "rgba(239, 68, 68, 0.2)"
                        : "rgba(16, 185, 129, 0.1)",
                    color:
                      companion.data.status === "escalation_required"
                        ? "#ef4444"
                        : "#10b981",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  <Activity size={14} /> {companion.data.status}
                </span>
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.85rem" }}>
                  <div>
                    <span style={{ color: "var(--muted)" }}>Language:</span>{" "}
                    <strong>{companion.data.language?.toUpperCase()}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted)" }}>Current Action Step:</span>{" "}
                    <strong>Step {companion.data.current_step_number}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted)" }}>Channel:</span>{" "}
                    <strong>{companion.data.channel}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted)" }}>Session ID:</span>{" "}
                    <code style={{ fontSize: "11px" }}>{companion.data?.session_id ? companion.data.session_id.slice(0, 8) : "—"}…</code>
                  </div>
                </div>

                {companion.data.status === "escalation_required" && (
                  <div
                    style={{
                      background: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid #ef4444",
                      borderRadius: "6px",
                      padding: "0.6rem 0.8rem",
                      color: "#fca5a5",
                      fontSize: "0.85rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <AlertTriangle size={18} color="#ef4444" />
                    <strong>URGENT ALERT:</strong> Patient condition deterioration reported. Human intervention advised!
                  </div>
                )}

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="primary"
                    onClick={async () => {
                      await api(`/companion/sessions/${companion.data.session_id}/takeover`, "POST");
                      companion.refetch();
                    }}
                    style={{ fontSize: "0.85rem", padding: "6px 12px" }}
                  >
                    Operator Takeover
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={async () => {
                      await api(`/companion/sessions/${companion.data.session_id}/stop`, "POST");
                      companion.refetch();
                    }}
                    style={{ fontSize: "0.85rem", padding: "6px 12px" }}
                  >
                    Stop AI Guidance
                  </button>
                </div>
              </div>
            </Panel>
          )}
          <Panel title="Location">
            <Map
              points={[{ ...i, name: label(i.category), detail: i.address }]}
            />
          </Panel>
          <Panel title="Additional reports">
            {i.reports?.map((r: any) => (
              <div className="record" key={r.id}>
                <p>{r.text}</p>
                <small>{date(r.created_at)}</small>
              </div>
            ))}
          </Panel>
          {user.role !== "analyst" && (
            <Panel title="Evidence">
              <ErrorBox error={evidence.error} />
              {evidence.data?.length ? (
                evidence.data.map((e) => (
                  <a
                    className="record evidence-link"
                    href={apiUrl("/evidence/" + e.id)}
                    key={e.id}
                  >
                    {e.content_type} · {Math.ceil(e.size / 1024)} KB{" "}
                    <ArrowUpRight size={16} />
                  </a>
                ))
              ) : (
                <Empty title="No evidence uploaded" />
              )}
            </Panel>
          )}
          <Panel title="Recorded history">
            <ol className="timeline">
              {i.events?.map((e) => (
                <li key={e.id}>
                  <span className="timeline-dot">
                    <CheckCircle2 size={15} />
                  </span>
                  <div>
                    <strong>{label(e.kind)}</strong>
                    <small>{date(e.created_at)}</small>
                    {e.payload.note && <p>{e.payload.note}</p>}
                    {e.payload.reason && <p>{e.payload.reason}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
        <div>
          {ops && (
            <>
              <Panel title="Coordinate response">
                {["reported", "submitted", "pending_verification"].includes(i.status) && (
                  <div style={{ marginBottom: "1rem" }}>
                    <button
                      type="button"
                      className="secondary"
                      style={{
                        width: "100%",
                        marginBottom: "0.75rem",
                        padding: "0.6rem",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontWeight: 600,
                      }}
                      onClick={async () => {
                        await api(`/incidents/${id}/acknowledge`, "POST");
                        queryClient.invalidateQueries({ queryKey: ["incident", id] });
                        queryClient.invalidateQueries({ queryKey: ["incidents"] });
                      }}
                    >
                      ✓ Acknowledge Report (Separate from Dispatch)
                    </button>
                    <DataForm
                      path={base + "/verify"}
                      submit="Verify incident"
                      fields={[
                      {
                        name: "priority",
                        label: "Assessed priority",
                        options: ["low", "medium", "high", "critical"].map(
                          (value) => ({ value, label: value }),
                        ),
                      },
                      {
                        name: "casualties_count",
                        label: "Confirmed people requiring assistance",
                        type: "number", min: 0, max: 100000, required: false,
                        value: i.casualties_count ?? "",
                      },
                      {
                        name: "note",
                        label: "Verification notes",
                        type: "textarea",
                      },
                    ]}
                  />
                  </div>
                )}
                {i.status === "verified" && (
                  <DataForm
                    path={base + "/dispatch"}
                    submit="Dispatch team"
                    fields={[
                      {
                        name: "ambulance_id",
                        label: "Available ambulance",
                        options: (fleet.data || [])
                          .filter((a) => a.available)
                          .map((a) => ({ value: a.id, label: a.registration })),
                      },
                      {
                        name: "responder_id",
                        label: "Available responder",
                        options: (responders.data || [])
                          .filter((r) => r.available)
                          .map((r) => ({ value: r.id, label: r.name })),
                      },
                    ]}
                  />
                )}{" "}
                {["verified", "dispatched", "en_route", "on_scene", "transporting", "active", "hospital_handover"].includes(i.status) && (
                  <IncidentPatientReferralManager incident={i} user={user} />
                )}{" "}
                {i.status === "handover" && (
                  <DataForm
                    path={base + "/close"}
                    submit="Close incident"
                    fields={[
                      {
                        name: "text",
                        label: "Closure summary",
                        type: "textarea",
                      },
                    ]}
                  />
                )}{" "}
                {["closed", "duplicate"].includes(i.status) && (
                  <p className="muted">
                    This incident is finalized. Its history remains available.
                  </p>
                )}
                <ErrorBox
                  error={fleet.error || responders.error || hospitals.error}
                />
              </Panel>
              {!["reported", "closed", "duplicate"].includes(i.status) && (
                <Panel title="Reassess priority">
                  <DataForm
                    path={base + "/priority"}
                    submit="Update priority"
                    fields={[
                      {
                        name: "priority",
                        label: "Priority",
                        value: i.priority,
                        options: ["low", "medium", "high", "critical"].map(
                          (value) => ({ value, label: value }),
                        ),
                      },
                      {
                        name: "note",
                        label: "Reason for reassessment",
                        type: "textarea",
                      },
                    ]}
                  />
                </Panel>
              )}
              <Panel title="Decision support">
                <ErrorBox error={suggestions.error} />
                {suggestions.data?.delay_alert && (
                  <div className="notice warning">
                    This report has waited over 10 minutes without dispatch.
                  </div>
                )}
                {suggestions.data?.possible_duplicates?.map((d: any) => (
                  <div className="record" key={d.id}>
                    <Link to={"/app/incidents/" + d.id}>
                      Review nearby report <ArrowUpRight size={14} />
                    </Link>
                    <small>
                      {d.reason} · {d.distance_km} km
                    </small>
                    {i.status === "reported" && (
                      <DataForm
                        path={base + "/duplicate"}
                        submit="Link as duplicate"
                        fields={[{ name: "note", label: "Reason" }]}
                        transform={(data) => ({ ...data, duplicate_of: d.id })}
                      />
                    )}
                  </div>
                ))}
                {suggestions.data?.hospitals?.slice(0, 5).map((h: any) => (
                  <div className="record" key={h.id}>
                    <strong>{h.name}</strong>
                    <small>
                      {h.distance_km} km · {h.available_beds} available beds
                    </small>
                    <p className="muted">{h.reason}</p>
                  </div>
                ))}
                {!suggestions.data?.hospitals?.length && (
                  <p className="muted">
                    No nearby recommendations available from recorded
                    coordinates and capacity.
                  </p>
                )}
                <p className="fine-print">
                  Recommendations support operator review. Capacity and
                  straight-line distance do not establish clinical suitability.
                </p>
              </Panel>
            </>
          )}
        </div>
      </div>
    </>
  );
}
export function Missions({ user }: { user: User }) {
  const q = useQuery({
    queryKey: ["missions"],
    queryFn: () => apiList<Mission>("/missions"),
  });
  const [geoError, setGeoError] = useState<unknown>(null);
  const [sharing, setSharing] = useState("");
  const order = [
    "assigned",
    "acknowledged",
    "en_route",
    "on_scene",
    "transporting",
    "handover",
    "completed",
  ];
  async function share(id: string) {
    setGeoError(null);
    setSharing(id);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          await api("/missions/" + id + "/location", "POST", {
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
          });
          q.refetch();
        } catch (e) {
          setGeoError(e);
        } finally {
          setSharing("");
        }
      },
      (e) => {
        setGeoError(e.message);
        setSharing("");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }
  return (
    <>
      <PageHead
        eyebrow="TERA Network / Field operations"
        title={
          user.role === "responder"
            ? "Your response missions."
            : "Mission coordination."
        }
      >
        Assignments and location updates from authorized response teams.
      </PageHead>
      <ErrorBox error={q.error || geoError} />
      {q.isLoading ? (
        <Loading />
      ) : !q.data?.length ? (
        <Empty title="No missions assigned">
          Assignments appear after an operator dispatches a team.
        </Empty>
      ) : (
        q.data.map((m) => (
          <Panel
            key={m.id}
            title={"Mission " + m.id.slice(0, 8).toUpperCase()}
            aside={<Badge value={m.status} />}
          >
            <Link className="table-link" to={"/app/incidents/" + m.incident_id}>
              Open incident details <ArrowUpRight size={16} />
            </Link>
            <div className="mission-steps">
              {order.map((s, index) => (
                <span
                  className={index <= order.indexOf(m.status) ? "done" : ""}
                  key={s}
                >
                  {index + 1}. {label(s)}
                </span>
              ))}
            </div>
            {user.role === "responder" && m.status !== "completed" && (
              <div className="two-col">
                <DataForm
                  path={"/missions/" + m.id + "/progress"}
                  submit={
                    "Confirm " + label(order[order.indexOf(m.status) + 1])
                  }
                  fields={[
                    {
                      name: "note",
                      label: "Progress notes (optional)",
                      type: "textarea",
                      required: false,
                    },
                  ]}
                  transform={(data) => ({
                    ...data,
                    status: order[order.indexOf(m.status) + 1],
                  })}
                />
                <div>
                  <button
                    className="secondary"
                    disabled={!!sharing || !navigator.geolocation}
                    onClick={() => share(m.id)}
                  >
                    <MapPin size={16} />
                    {sharing === m.id ? "Sharing…" : "Share current location"}
                  </button>
                  <p className="muted">
                    Shares one actual GPS reading when you choose. No continuous
                    tracking.
                  </p>
                </div>
              </div>
            )}
            <div className="location-meta">
              {m.location_at
                ? "Last location update: " + date(m.location_at)
                : "No location shared yet"}
            </div>
            {m.latitude !== null && (
              <Map
                points={[
                  {
                    ...m,
                    name: "Responder location",
                    detail: m.location_at ? date(m.location_at) : "",
                  },
                ]}
              />
            )}
          </Panel>
        ))
      )}
    </>
  );
}
/* ==========================================================================
   PART 5: OPERATOR-TO-HOSPITAL ASSIGNMENT & RECOMMENDATION WORKFLOW
   ========================================================================== */

export function IncidentPatientReferralManager({
  incident,
  user,
}: {
  incident: Incident;
  user: User;
}) {
  const [assigningPatient, setAssigningPatient] = useState<any | null>(null);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientPriority, setNewPatientPriority] = useState("immediate");
  const [newPatientCondition, setNewPatientCondition] = useState("");

  const patients = useQuery({
    queryKey: ["patients", incident.id],
    queryFn: () => api<any[]>(`/incidents/${incident.id}/patients`),
  });

  const referrals = useQuery({
    queryKey: ["referrals"],
    queryFn: () => api<any[]>("/referrals"),
  });

  const addPatientMutation = useMutation({
    mutationFn: (data: any) => api(`/incidents/${incident.id}/patients`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", incident.id] });
      setShowAddPatient(false);
      setNewPatientName("");
      setNewPatientCondition("");
    },
  });

  const refMap: Record<string, any> = {};
  if (referrals.data) {
    for (const r of referrals.data) {
      if (r.incident_id === incident.id && r.patient_id) {
        refMap[r.patient_id] = r;
      }
    }
  }

  return (
    <div style={{ marginTop: "1rem", marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <div>
          <strong style={{ fontSize: "0.95rem" }}>Associated Patients & Hospital Referral</strong>
          <span style={{ display: "block", fontSize: "0.78rem", color: "var(--muted)" }}>
            Assign emergency hospital care with live bed reservations
          </span>
        </div>
        <button
          type="button"
          className="secondary"
          style={{ fontSize: "0.78rem", padding: "4px 8px" }}
          onClick={() => setShowAddPatient(!showAddPatient)}
        >
          <Plus size={13} style={{ marginRight: "3px", verticalAlign: "middle" }} /> Add Casualty
        </button>
      </div>

      {showAddPatient && (
        <div style={{ background: "var(--surface-muted, #f8fafc)", border: "1px solid var(--border)", borderRadius: "8px", padding: "0.75rem", marginBottom: "0.75rem" }}>
          <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem" }}>Register Additional Casualty</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <input
              type="text"
              placeholder="Patient Name / Identifier (e.g. Casualty 2)"
              value={newPatientName}
              onChange={(e) => setNewPatientName(e.target.value)}
              style={{ padding: "6px 8px", fontSize: "0.85rem" }}
            />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <select
                value={newPatientPriority}
                onChange={(e) => setNewPatientPriority(e.target.value)}
                style={{ padding: "6px 8px", fontSize: "0.85rem", flex: 1 }}
              >
                <option value="immediate">Immediate (Red - Critical)</option>
                <option value="delayed">Delayed (Yellow - Urgent)</option>
                <option value="minor">Minor (Green - Walking)</option>
              </select>
            </div>
            <textarea
              placeholder="Injuries / Clinical observations"
              value={newPatientCondition}
              onChange={(e) => setNewPatientCondition(e.target.value)}
              rows={2}
              style={{ padding: "6px 8px", fontSize: "0.85rem" }}
            />
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="secondary"
                style={{ fontSize: "0.8rem", padding: "4px 8px" }}
                onClick={() => setShowAddPatient(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                disabled={!newPatientName.trim()}
                onClick={() =>
                  addPatientMutation.mutate({
                    name: newPatientName,
                    triage_priority: newPatientPriority,
                    condition_summary: newPatientCondition,
                  })
                }
              >
                Save Casualty
              </button>
            </div>
          </div>
        </div>
      )}

      <ErrorBox error={patients.error || referrals.error || addPatientMutation.error} />
      {patients.isLoading ? (
        <Loading />
      ) : !patients.data?.length ? (
        <div style={{ fontSize: "0.85rem", color: "var(--muted)", padding: "0.5rem" }}>
          No patient records registered yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {patients.data.map((p) => {
            const activeRef = refMap[p.id];
            return (
              <div
                key={p.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "0.75rem",
                  background: activeRef?.status === "accepted" ? "rgba(16, 185, 129, 0.05)" : "var(--surface)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.4rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <strong>{p.name}</strong>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        background:
                          p.triage_priority === "immediate"
                            ? "rgba(239, 68, 68, 0.2)"
                            : p.triage_priority === "delayed"
                            ? "rgba(245, 158, 11, 0.2)"
                            : "rgba(16, 185, 129, 0.2)",
                        color:
                          p.triage_priority === "immediate"
                            ? "#ef4444"
                            : p.triage_priority === "delayed"
                            ? "#f59e0b"
                            : "#10b981",
                      }}
                    >
                      {p.triage_priority}
                    </span>
                  </div>
                  {activeRef ? (
                    <Badge value={activeRef.status} />
                  ) : (
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Unassigned</span>
                  )}
                </div>

                <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                  {p.condition_summary || "Emergency casualty"}
                </div>

                {activeRef ? (
                  <div
                    style={{
                      background: "var(--surface-muted, #f8fafc)",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      marginTop: "0.25rem",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div>
                      <strong>Hospital:</strong> {activeRef.hospital_name}
                    </div>
                    <div>
                      <strong>Department / Bed:</strong> {activeRef.department_name} · {activeRef.bed_kind}
                    </div>
                    {activeRef.reason && (
                      <div style={{ color: activeRef.status === "rejected" ? "var(--danger)" : "var(--muted)" }}>
                        <strong>Note:</strong> {activeRef.reason}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: "0.4rem" }}>
                    <button
                      type="button"
                      className="primary"
                      style={{
                        fontSize: "0.82rem",
                        padding: "6px 12px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                      }}
                      onClick={() => setAssigningPatient(p)}
                    >
                      <Building2 size={14} /> Recommend & Assign Hospital
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {assigningPatient && (
        <HospitalRecommendationModal
          incident={incident}
          patient={assigningPatient}
          onClose={() => setAssigningPatient(null)}
          onSuccess={() => {
            setAssigningPatient(null);
            queryClient.invalidateQueries({ queryKey: ["patients", incident.id] });
            queryClient.invalidateQueries({ queryKey: ["referrals"] });
            queryClient.invalidateQueries({ queryKey: ["incident", incident.id] });
          }}
        />
      )}
    </div>
  );
}

function HospitalRecommendationModal({
  incident,
  patient,
  onClose,
  onSuccess,
}: {
  incident: Incident;
  patient: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>("");
  const [selectedCapacityId, setSelectedCapacityId] = useState<string>("");
  const [referralNotes, setReferralNotes] = useState("");
  const [priority, setPriority] = useState("immediate");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recs = useQuery({
    queryKey: ["hospital-recommendations", incident.id],
    queryFn: () => api<any[]>(`/incidents/${incident.id}/hospital-recommendations`),
  });

  const selectedHospital = recs.data?.find((h) => h.hospital_id === selectedHospitalId);

  const handleSubmit = async () => {
    if (!selectedCapacityId) {
      setError("Please select a receiving department and bed category");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api(`/incidents/${incident.id}/referrals`, "POST", {
        capacity_id: selectedCapacityId,
        patient_id: patient.id,
        priority,
        eta_minutes: selectedHospital?.estimated_eta_minutes || 15,
        notes: referralNotes,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || "Failed to submit hospital referral");
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          width: "100%",
          maxWidth: "720px",
          maxHeight: "90vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "1.15rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Sparkles size={18} color="#10b981" />
              Hospital Recommendation Engine
            </h3>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              Assigning {patient.name} ({incident.category} · Priority: {patient.triage_priority})
            </span>
          </div>
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            style={{ padding: "4px 8px", background: "none", border: "none", cursor: "pointer" }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {error && <div className="notice error">{error}</div>}

          {recs.isLoading ? (
            <Loading />
          ) : !recs.data?.length ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
              No operational hospitals available in the emergency network.
            </div>
          ) : (
            <>
              <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                Ranked Hospitals (Filtered by Distance, Capabilities & Real-Time Bed Availability):
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {recs.data.map((h, idx) => {
                  const isSelected = selectedHospitalId === h.hospital_id;
                  return (
                    <div
                      key={h.hospital_id}
                      className={`recommendation-card-v2 ${idx === 0 ? "top-ranked" : ""}`}
                      style={{
                        cursor: "pointer",
                        borderWidth: isSelected ? "2px" : "1px",
                        borderColor: isSelected ? "#10b981" : undefined,
                      }}
                      onClick={() => {
                        setSelectedHospitalId(h.hospital_id);
                        if (h.bed_options.length > 0 && (!selectedCapacityId || !h.bed_options.some((b: any) => b.capacity_id === selectedCapacityId))) {
                          setSelectedCapacityId(h.bed_options[0].capacity_id);
                        }
                      }}
                    >
                      <div className="recommendation-score-pill">
                        {h.score}% Match {idx === 0 ? "· Best Option" : ""}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingRight: "6rem" }}>
                        <Building2 size={18} color="#10b981" />
                        <strong style={{ fontSize: "1rem" }}>{h.name}</strong>
                        <span style={{ fontSize: "0.75rem", background: "var(--surface-muted, #f8fafc)", padding: "2px 6px", borderRadius: "4px" }}>
                          {h.hospital_type}
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.82rem", color: "var(--muted)" }}>
                        <span>📍 {h.distance_km} km away</span>
                        <span>⏱️ ~{h.estimated_eta_minutes} min ETA</span>
                        <span>🛏️ {h.total_available_beds} verified available beds</span>
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                        {(h.capabilities || []).map((c: string) => {
                          const isMatched = (h.matched_capabilities || []).includes(c);
                          return (
                            <span
                              key={c}
                              style={{
                                fontSize: "0.72rem",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: isMatched ? "rgba(16, 185, 129, 0.2)" : "var(--surface-muted, #f8fafc)",
                                color: isMatched ? "#10b981" : "var(--muted)",
                                fontWeight: isMatched ? 700 : 500,
                              }}
                            >
                              {isMatched ? "✓ " : ""}{c}
                            </span>
                          );
                        })}
                      </div>

                      {isSelected && (
                        <div
                          style={{
                            marginTop: "0.5rem",
                            paddingTop: "0.75rem",
                            borderTop: "1px dashed var(--border)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.75rem",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div>
                            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                              Select Receiving Department & Bed Category:
                            </label>
                            <select
                              value={selectedCapacityId}
                              onChange={(e) => setSelectedCapacityId(e.target.value)}
                              style={{ width: "100%", padding: "7px 10px", fontSize: "0.85rem" }}
                            >
                              {h.bed_options.map((b: any) => (
                                <option key={b.capacity_id} value={b.capacity_id} disabled={b.available < 1}>
                                  {b.department} → {b.kind} ({b.available} available / {b.total} total) {b.available < 1 ? "[FULL]" : ""}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                            <div>
                              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                                Referral Priority:
                              </label>
                              <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                style={{ width: "100%", padding: "7px 10px", fontSize: "0.85rem" }}
                              >
                                <option value="immediate">Immediate (Red)</option>
                                <option value="urgent">Urgent (Yellow)</option>
                                <option value="delayed">Delayed (Green)</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                                Estimated Ambulance ETA:
                              </label>
                              <input
                                type="text"
                                readOnly
                                value={`${h.estimated_eta_minutes} minutes`}
                                style={{ width: "100%", padding: "7px 10px", fontSize: "0.85rem", background: "var(--surface-muted, #f8fafc)" }}
                              />
                            </div>
                          </div>

                          <div>
                            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                              Clinical Handover Notes for Hospital Triage:
                            </label>
                            <textarea
                              placeholder="e.g. Suspected skull fracture, GCS 12, oxygen administered at 4L/min. Require neurosurgical prep."
                              value={referralNotes}
                              onChange={(e) => setReferralNotes(e.target.value)}
                              rows={2}
                              style={{ width: "100%", padding: "7px 10px", fontSize: "0.85rem" }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
          }}
        >
          <button type="button" className="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleSubmit}
            disabled={!selectedCapacityId || submitting}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            {submitting ? "Submitting Referral…" : "Submit Hospital Referral"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   PART 2, 3 & 4: COMPLETE HOSPITAL ONBOARDING & OPERATIONS DASHBOARD
   ========================================================================== */

export function Hospitals({ user }: { user: User }) {
  const [isEditing, setIsEditing] = useState(false);

  const profile = useQuery({
    queryKey: ["hospital-profile"],
    queryFn: () => api<any>("/hospital/profile"),
    enabled: ["hospital", "admin"].includes(user.role),
  });

  const referrals = useQuery({
    queryKey: ["referrals"],
    queryFn: () => api<any[]>("/referrals"),
    enabled: user.role !== "responder",
  });

  const allHospitals = useQuery({
    queryKey: ["hospitals"],
    queryFn: () => apiList<any>("/hospitals"),
  });

  // If coordinator is not yet registered or wants to reconfigure:
  if (user.role === "hospital") {
    if (profile.isLoading) return <Loading />;
    if (!profile.data?.registered || isEditing) {
      return (
        <HospitalOnboardingWizard
          existingHospital={profile.data?.registered ? profile.data.hospital : null}
          onCompleted={() => {
            setIsEditing(false);
            queryClient.invalidateQueries({ queryKey: ["hospital-profile"] });
            queryClient.invalidateQueries({ queryKey: ["hospitals"] });
          }}
          onCancel={profile.data?.registered ? () => setIsEditing(false) : undefined}
        />
      );
    }
    return (
      <HospitalOperationsDashboard
        hospital={profile.data.hospital}
        referrals={referrals.data || []}
        onEditProfile={() => setIsEditing(true)}
      />
    );
  }

  // Operator / Admin Network View:
  return (
    <>
      <PageHead eyebrow="TERA Emergency Network" title="Central Hospital Registry & Network Capacity">
        Search registered operational hospitals and verify live bed availability.
      </PageHead>
      <ErrorBox error={allHospitals.error || referrals.error} />
      <Panel title="Network Hospital Facilities">
        {allHospitals.isLoading ? (
          <Loading />
        ) : !allHospitals.data?.length ? (
          <Empty title="No hospitals registered yet">
            Hospital coordinators can register their facilities through the onboarding wizard.
          </Empty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {allHospitals.data.map((h: any) => (
              <div key={h.id} style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{h.name}</h3>
                    <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                      {h.hospital_type || "General Hospital"} · {h.address || h.city || "Tirupati"}
                    </span>
                  </div>
                  <Badge value={h.operating_status || "Operational"} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", margin: "0.5rem 0" }}>
                  {(h.capabilities || h.facilities || []).map((c: string) => (
                    <span key={c} style={{ fontSize: "0.75rem", background: "var(--surface-muted, #f8fafc)", padding: "2px 8px", borderRadius: "4px" }}>
                      {c}
                    </span>
                  ))}
                </div>
                <div className="capacity-grid" style={{ marginTop: "1rem" }}>
                  {(h.capacities || []).map((c: any) => (
                    <div className="capacity-card" key={c.id}>
                      <div className="eyebrow">{c.department} / {c.kind}</div>
                      <strong>
                        {c.available} <small>available</small>
                      </strong>
                      <p>{c.occupied} occupied · {c.reserved} reserved · {c.total} total</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Interactive Hospital Map">
        <Map points={(allHospitals.data || []).map((h: any) => ({ ...h, name: h.name }))} />
      </Panel>
    </>
  );
}

function HospitalOnboardingWizard({
  existingHospital,
  onCompleted,
  onCancel,
}: {
  existingHospital?: any;
  onCompleted: () => void;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState(1);
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 1: Hospital Profile
  const [name, setName] = useState(existingHospital?.name || "");
  const [hospitalType, setHospitalType] = useState(existingHospital?.hospital_type || "Multi-speciality Hospital");
  const [regId, setRegId] = useState(existingHospital?.reg_identifier || "");
  const [phone, setPhone] = useState(existingHospital?.phone || "");
  const [email, setEmail] = useState(existingHospital?.email || "");
  const [address, setAddress] = useState(existingHospital?.address || "");
  const [city, setCity] = useState(existingHospital?.city || "Tirupati");
  const [state, setState] = useState(existingHospital?.state || "Andhra Pradesh");
  const [postalCode, setPostalCode] = useState(existingHospital?.postal_code || "517501");
  const [country, setCountry] = useState(existingHospital?.country || "India");
  const [lat, setLat] = useState<string>(existingHospital?.latitude !== undefined && existingHospital?.latitude !== null ? String(existingHospital.latitude) : "13.6288");
  const [lng, setLng] = useState<string>(existingHospital?.longitude !== undefined && existingHospital?.longitude !== null ? String(existingHospital.longitude) : "79.4192");
  const [contactPerson, setContactPerson] = useState(existingHospital?.contact_person || "");
  const [contactDesignation, setContactDesignation] = useState(existingHospital?.contact_designation || "Medical Superintendent / Chief Medical Officer");
  const [emergencyPhone, setEmergencyPhone] = useState(existingHospital?.emergency_phone || "");
  const [operatingStatus, setOperatingStatus] = useState(existingHospital?.operating_status || "Operational");

  // Step 2: Departments
  const STANDARD_DEPTS = [
    { name: "Emergency & Trauma Care", dept_type: "Emergency", head_name: "Dr. V. Prasad", contact_number: "+91-877-2234501", operating_hours: "24/7" },
    { name: "Intensive Care Unit (ICU)", dept_type: "Critical Care", head_name: "Dr. K. Ramesh", contact_number: "+91-877-2234502", operating_hours: "24/7" },
    { name: "General Surgery & OT", dept_type: "Surgical", head_name: "Dr. S. Reddy", contact_number: "+91-877-2234503", operating_hours: "24/7" },
    { name: "Cardiology & Cath Lab", dept_type: "Cardiology", head_name: "Dr. A. Sharma", contact_number: "+91-877-2234504", operating_hours: "24/7" },
    { name: "Neurology & Stroke Care", dept_type: "Neurology", head_name: "Dr. P. Rao", contact_number: "+91-877-2234505", operating_hours: "24/7" },
    { name: "Orthopaedics & Fracture Clinic", dept_type: "Orthopaedics", head_name: "Dr. N. Naidu", contact_number: "+91-877-2234506", operating_hours: "24/7" },
    { name: "Paediatrics & NICU", dept_type: "Paediatrics", head_name: "Dr. L. Swathi", contact_number: "+91-877-2234507", operating_hours: "24/7" },
    { name: "Burns Care Unit", dept_type: "Burns", head_name: "Dr. M. Suresh", contact_number: "+91-877-2234508", operating_hours: "24/7" },
    { name: "Blood Bank (24/7)", dept_type: "Blood Bank", head_name: "Dr. H. Kiran", contact_number: "+91-877-2234509", operating_hours: "24/7" },
  ];
  const [selectedDepts, setSelectedDepts] = useState<any[]>(
    existingHospital?.departments?.length ? existingHospital.departments : STANDARD_DEPTS.slice(0, 4)
  );
  const [customDeptName, setCustomDeptName] = useState("");

  // Step 3: Bed Capacities
  const DEFAULT_BEDS = [
    { kind: "Emergency Bed", department: "Emergency & Trauma Care", total: 20, occupied: 6, out_of_service: 1 },
    { kind: "ICU Bed", department: "Intensive Care Unit (ICU)", total: 12, occupied: 4, out_of_service: 0 },
    { kind: "Trauma Bed", department: "Emergency & Trauma Care", total: 8, occupied: 2, out_of_service: 0 },
    { kind: "General Ward Bed", department: "General Surgery & OT", total: 40, occupied: 18, out_of_service: 2 },
    { kind: "Burns Bed", department: "Burns Care Unit", total: 6, occupied: 1, out_of_service: 0 },
    { kind: "Paediatric Bed", department: "Paediatrics & NICU", total: 10, occupied: 3, out_of_service: 0 },
    { kind: "Isolation Bed", department: "Emergency & Trauma Care", total: 6, occupied: 1, out_of_service: 0 },
  ];
  const [capacities, setCapacities] = useState<any[]>(
    existingHospital?.capacities?.length ? existingHospital.capacities : DEFAULT_BEDS
  );

  // Step 4: Capabilities
  const STANDARD_CAPABILITIES = [
    "Emergency trauma support",
    "ICU support",
    "Ventilator availability",
    "Oxygen support",
    "Cardiac care",
    "Stroke care",
    "Burns treatment",
    "Blood bank",
    "Surgery availability",
    "Paediatric emergency care",
  ];
  const [capabilities, setCapabilities] = useState<string[]>(
    existingHospital?.capabilities?.length ? existingHospital.capabilities : STANDARD_CAPABILITIES.slice(0, 6)
  );

  const detectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setGpsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude.toFixed(5)));
        setLng(String(pos.coords.longitude.toFixed(5)));
        setGpsDetecting(false);
      },
      (err) => {
        alert("Could not retrieve GPS coordinates: " + err.message);
        setGpsDetecting(false);
      },
      { timeout: 10000 }
    );
  };

  const handleCapacityChange = (idx: number, field: string, val: number) => {
    setCapacities((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: Math.max(0, val) };
      return copy;
    });
  };

  const toggleDept = (dept: any) => {
    setSelectedDepts((prev) => {
      const exists = prev.some((d) => d.name === dept.name);
      if (exists) return prev.filter((d) => d.name !== dept.name);
      return [...prev, dept];
    });
  };

  const toggleCapability = (cap: string) => {
    setCapabilities((prev) => {
      if (prev.includes(cap)) return prev.filter((c) => c !== cap);
      return [...prev, cap];
    });
  };

  const onboardMutation = useMutation({
    mutationFn: async () => {
      setSubmitError(null);
      const payload = {
        name,
        hospital_type: hospitalType,
        reg_identifier: regId,
        phone,
        email,
        address,
        city,
        state,
        postal_code: postalCode,
        country,
        latitude: lat ? parseFloat(lat) : null,
        longitude: lng ? parseFloat(lng) : null,
        contact_person: contactPerson,
        contact_designation: contactDesignation,
        emergency_phone: emergencyPhone,
        operating_status: operatingStatus,
        departments: selectedDepts,
        capacities,
        capabilities,
        auto_approve: true,
      };
      return await api("/hospital/onboard", "POST", payload);
    },
    onSuccess: () => {
      onCompleted();
    },
    onError: (err: any) => {
      setSubmitError(err?.message || "Failed to submit hospital onboarding");
    },
  });

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", paddingBottom: "3rem" }}>
      <PageHead
        eyebrow="Hospital Onboarding & Accreditation"
        title={existingHospital ? "Update Hospital Profile & Facilities" : "Register Your Hospital on TERA"}
      >
        Configure real emergency departments, verified bed capacity, and trauma capabilities.
      </PageHead>

      {/* Stepper Header */}
      <div className="hospital-stepper">
        {[
          { num: 1, label: "1. Profile & Location" },
          { num: 2, label: "2. Departments" },
          { num: 3, label: "3. Bed Capacity" },
          { num: 4, label: "4. Capabilities" },
          { num: 5, label: "5. Review & Submit" },
        ].map((s) => (
          <div
            key={s.num}
            className={`hospital-step-item ${step === s.num ? "active" : step > s.num ? "completed" : ""}`}
            onClick={() => setStep(s.num)}
          >
            <div className="hospital-step-number">{step > s.num ? "✓" : s.num}</div>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {submitError && <div className="notice error">{submitError}</div>}

      {/* STEP 1: Hospital Profile & Location */}
      {step === 1 && (
        <Panel title="Hospital Profile & Location">
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Official Hospital Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apollo Multi-Speciality Emergency Hospital"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Hospital Type *
                </label>
                <select
                  value={hospitalType}
                  onChange={(e) => setHospitalType(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px" }}
                >
                  <option value="Multi-speciality Hospital">Multi-speciality Hospital</option>
                  <option value="Government Hospital">Government Hospital</option>
                  <option value="Medical College Hospital">Medical College Hospital</option>
                  <option value="Trauma Centre">Trauma Centre</option>
                  <option value="Private Hospital">Private Hospital</option>
                  <option value="Community Health Centre">Community Health Centre</option>
                  <option value="Primary Health Centre">Primary Health Centre</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Registration / Accreditation ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. NABH-AP-2024-881"
                  value={regId}
                  onChange={(e) => setRegId(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Official Phone Number
                </label>
                <input
                  type="text"
                  placeholder="+91-877-2234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Official Email Address
                </label>
                <input
                  type="email"
                  placeholder="emergency@hospital.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                Full Physical Address *
              </label>
              <input
                type="text"
                placeholder="Street address, Landmark, Area"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={{ width: "100%", padding: "8px 12px" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>City *</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} style={{ width: "100%", padding: "8px 12px" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>State *</label>
                <input type="text" value={state} onChange={(e) => setState(e.target.value)} style={{ width: "100%", padding: "8px 12px" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>Postal Code</label>
                <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} style={{ width: "100%", padding: "8px 12px" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>Country</label>
                <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} style={{ width: "100%", padding: "8px 12px" }} />
              </div>
            </div>

            {/* GPS Coordinates & Interactive Detection */}
            <div style={{ background: "var(--surface-muted, #f8fafc)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <div>
                  <strong style={{ fontSize: "0.9rem" }}>Hospital GPS Coordinates</strong>
                  <span style={{ display: "block", fontSize: "0.78rem", color: "var(--muted)" }}>
                    Used by the operator dispatch engine to calculate ambulance travel times & route responders.
                  </span>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={detectLocation}
                  disabled={gpsDetecting}
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem" }}
                >
                  <LocateFixed size={14} />
                  {gpsDetecting ? "Detecting GPS…" : "Use Current GPS Location"}
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.2rem" }}>Latitude</label>
                  <input type="text" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="13.6288" style={{ width: "100%", padding: "6px 10px" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.2rem" }}>Longitude</label>
                  <input type="text" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="79.4192" style={{ width: "100%", padding: "6px 10px" }} />
                </div>
              </div>
            </div>

            {/* Contact Person & Designation */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Hospital Contact Person
                </label>
                <input
                  type="text"
                  placeholder="Dr. V. Prasad"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Contact Designation
                </label>
                <input
                  type="text"
                  value={contactDesignation}
                  onChange={(e) => setContactDesignation(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  24/7 Emergency Triage Phone *
                </label>
                <input
                  type="text"
                  placeholder="+91-9848022334"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
              {onCancel && (
                <button type="button" className="secondary" onClick={onCancel}>
                  Cancel
                </button>
              )}
              <button
                type="button"
                className="primary"
                disabled={!name.trim() || !address.trim()}
                onClick={() => setStep(2)}
              >
                Continue to Facilities & Departments →
              </button>
            </div>
          </div>
        </Panel>
      )}

      {/* STEP 2: Departments & Facilities */}
      {step === 2 && (
        <Panel title="Configure Hospital Facilities & Departments">
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--muted)" }}>
              Select the active clinical and emergency departments available in your hospital. Do not register departments your facility does not provide.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem" }}>
              {STANDARD_DEPTS.map((dept) => {
                const isChecked = selectedDepts.some((d) => d.name === dept.name);
                return (
                  <div
                    key={dept.name}
                    onClick={() => toggleDept(dept)}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "0.85rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.6rem",
                      background: isChecked ? "rgba(16, 185, 129, 0.08)" : "var(--surface)",
                      borderColor: isChecked ? "#10b981" : "var(--border)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      style={{ marginTop: "3px" }}
                    />
                    <div>
                      <strong style={{ fontSize: "0.9rem", display: "block" }}>{dept.name}</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        {dept.dept_type} · {dept.operating_hours} · In-charge: {dept.head_name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom Department Adder */}
            <div style={{ background: "var(--surface-muted, #f8fafc)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--border)", marginTop: "0.5rem" }}>
              <strong style={{ fontSize: "0.88rem", display: "block", marginBottom: "0.5rem" }}>Add Custom Department</strong>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  placeholder="e.g. Nephrology & Dialysis"
                  value={customDeptName}
                  onChange={(e) => setCustomDeptName(e.target.value)}
                  style={{ flex: 1, padding: "6px 10px" }}
                />
                <button
                  type="button"
                  className="secondary"
                  disabled={!customDeptName.trim()}
                  onClick={() => {
                    setSelectedDepts((prev) => [
                      ...prev,
                      { name: customDeptName.trim(), dept_type: "Speciality", head_name: "Dept Head", contact_number: phone, operating_hours: "24/7" },
                    ]);
                    setCustomDeptName("");
                  }}
                >
                  + Add Custom Department
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem" }}>
              <button type="button" className="secondary" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button
                type="button"
                className="primary"
                disabled={selectedDepts.length === 0}
                onClick={() => setStep(3)}
              >
                Continue to Bed Capacity Management →
              </button>
            </div>
          </div>
        </Panel>
      )}

      {/* STEP 3: Bed Capacity Management */}
      {step === 3 && (
        <Panel title="Register Bed Capacity by Category">
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "8px", padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#10b981" }}>
              <strong>Verified Formula:</strong> Available Beds = Total Beds - Occupied Beds - Reserved Beds - Out-of-Service Beds.
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--muted)" }}>
                    <th style={{ padding: "8px" }}>Bed Category</th>
                    <th style={{ padding: "8px" }}>Department</th>
                    <th style={{ padding: "8px", width: "90px" }}>Total Beds</th>
                    <th style={{ padding: "8px", width: "90px" }}>Occupied</th>
                    <th style={{ padding: "8px", width: "90px" }}>Out of Service</th>
                    <th style={{ padding: "8px", width: "90px" }}>Available</th>
                  </tr>
                </thead>
                <tbody>
                  {capacities.map((c, idx) => {
                    const avail = Math.max(0, c.total - c.occupied - (c.reserved || 0) - c.out_of_service);
                    return (
                      <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "8px", fontWeight: 600 }}>{c.kind}</td>
                        <td style={{ padding: "8px", color: "var(--muted)" }}>{c.department}</td>
                        <td style={{ padding: "8px" }}>
                          <input
                            type="number"
                            min="0"
                            value={c.total}
                            onChange={(e) => handleCapacityChange(idx, "total", parseInt(e.target.value) || 0)}
                            style={{ width: "70px", padding: "4px 6px" }}
                          />
                        </td>
                        <td style={{ padding: "8px" }}>
                          <input
                            type="number"
                            min="0"
                            value={c.occupied}
                            onChange={(e) => handleCapacityChange(idx, "occupied", parseInt(e.target.value) || 0)}
                            style={{ width: "70px", padding: "4px 6px" }}
                          />
                        </td>
                        <td style={{ padding: "8px" }}>
                          <input
                            type="number"
                            min="0"
                            value={c.out_of_service}
                            onChange={(e) => handleCapacityChange(idx, "out_of_service", parseInt(e.target.value) || 0)}
                            style={{ width: "70px", padding: "4px 6px" }}
                          />
                        </td>
                        <td style={{ padding: "8px", fontWeight: 700, color: avail > 0 ? "#10b981" : "#ef4444" }}>
                          {avail}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem" }}>
              <button type="button" className="secondary" onClick={() => setStep(2)}>
                ← Back
              </button>
              <button type="button" className="primary" onClick={() => setStep(4)}>
                Continue to Emergency Capabilities →
              </button>
            </div>
          </div>
        </Panel>
      )}

      {/* STEP 4: Emergency Capabilities */}
      {step === 4 && (
        <Panel title="Register Emergency Capabilities">
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--muted)" }}>
              The central dispatch algorithm matches incident types (e.g. burn trauma, cardiac arrest, stroke) only against confirmed hospital capabilities.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
              {STANDARD_CAPABILITIES.map((cap) => {
                const isSelected = capabilities.includes(cap);
                return (
                  <div
                    key={cap}
                    onClick={() => toggleCapability(cap)}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "0.85rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                      background: isSelected ? "rgba(16, 185, 129, 0.08)" : "var(--surface)",
                      borderColor: isSelected ? "#10b981" : "var(--border)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                    />
                    <strong style={{ fontSize: "0.85rem" }}>{cap}</strong>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem" }}>
              <button type="button" className="secondary" onClick={() => setStep(3)}>
                ← Back
              </button>
              <button type="button" className="primary" onClick={() => setStep(5)}>
                Review & Confirm Registration →
              </button>
            </div>
          </div>
        </Panel>
      )}

      {/* STEP 5: Review & Submit */}
      {step === 5 && (
        <Panel title="Review & Confirm Registration">
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ background: "var(--surface-muted, #f8fafc)", padding: "1.25rem", borderRadius: "10px", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.2rem" }}>{name}</h3>
                  <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                    {hospitalType} · {address}, {city}, {state} ({country})
                  </span>
                </div>
                <Badge value={operatingStatus} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", fontSize: "0.82rem", color: "var(--muted)" }}>
                <div>📍 GPS: {lat}, {lng}</div>
                <div>📞 24/7 Emergency: {emergencyPhone}</div>
                <div>👤 CMO: {contactPerson} ({contactDesignation})</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "1rem" }}>
                <strong style={{ fontSize: "0.9rem", display: "block", marginBottom: "0.5rem" }}>
                  Registered Departments ({selectedDepts.length})
                </strong>
                <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.82rem" }}>
                  {selectedDepts.map((d) => (
                    <li key={d.name}>{d.name} ({d.dept_type})</li>
                  ))}
                </ul>
              </div>

              <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "1rem" }}>
                <strong style={{ fontSize: "0.9rem", display: "block", marginBottom: "0.5rem" }}>
                  Confirmed Capabilities ({capabilities.length})
                </strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                  {capabilities.map((c) => (
                    <span key={c} style={{ fontSize: "0.72rem", padding: "2px 6px", borderRadius: "4px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                      ✓ {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "1rem" }}>
              <strong style={{ fontSize: "0.9rem", display: "block", marginBottom: "0.5rem" }}>
                Total Bed Capacity Breakdown
              </strong>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.5rem", marginTop: "0.5rem" }}>
                {capacities.map((c, i) => {
                  const avail = Math.max(0, c.total - c.occupied - c.out_of_service);
                  return (
                    <div key={i} style={{ background: "var(--surface-muted, #f8fafc)", padding: "0.5rem", borderRadius: "6px", fontSize: "0.8rem" }}>
                      <div style={{ fontWeight: 600 }}>{c.kind}</div>
                      <div>{avail} available / {c.total} total</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem" }}>
              <button type="button" className="secondary" onClick={() => setStep(4)}>
                ← Back
              </button>
              <button
                type="button"
                className="primary"
                disabled={onboardMutation.isPending}
                onClick={() => onboardMutation.mutate()}
                style={{ padding: "8px 20px", fontWeight: 700 }}
              >
                {onboardMutation.isPending ? "Registering Hospital…" : "Submit Official Hospital Registration"}
              </button>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

function HospitalOperationsDashboard({
  hospital,
  referrals,
  onEditProfile,
}: {
  hospital: any;
  referrals: any[];
  onEditProfile: () => void;
}) {
  const [tab, setTab] = useState<"overview" | "referrals" | "arrivals" | "beds" | "departments" | "capabilities" | "history">("overview");
  const [rejectingRefId, setRejectingRefId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [editingCapacity, setEditingCapacity] = useState<any | null>(null);
  const [capTotal, setCapTotal] = useState(0);
  const [capOccupied, setCapOccupied] = useState(0);
  const [capOos, setCapOos] = useState(0);
  const [capReason, setCapReason] = useState("");

  const capacities = hospital.capacities || [];
  const totalBeds = capacities.reduce((acc: number, c: any) => acc + (c.total || 0), 0);
  const occupiedBeds = capacities.reduce((acc: number, c: any) => acc + (c.occupied || 0), 0);
  const reservedBeds = capacities.reduce((acc: number, c: any) => acc + (c.reserved || 0), 0);
  const outOfServiceBeds = capacities.reduce((acc: number, c: any) => acc + (c.out_of_service || 0), 0);
  const availableBeds = capacities.reduce((acc: number, c: any) => acc + (c.available || 0), 0);

  const pendingReferrals = referrals.filter((r) => r.status === "pending");
  const activeArrivals = referrals.filter((r) => ["accepted", "arrived"].includes(r.status));

  const decisionMutation = useMutation({
    mutationFn: (data: { id: string; accept: boolean; reason?: string }) =>
      api(`/referrals/${data.id}/decision`, "POST", { accept: data.accept, reason: data.reason || (data.accept ? "Bed availability confirmed by hospital coordinator" : "Referral rejected") }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referrals"] });
      queryClient.invalidateQueries({ queryKey: ["hospital-profile"] });
      setRejectingRefId(null);
      setRejectReason("");
    },
  });

  const arrivalMutation = useMutation({
    mutationFn: (id: string) => api(`/referrals/${id}/arrival`, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referrals"] });
      queryClient.invalidateQueries({ queryKey: ["hospital-profile"] });
    },
  });

  const handoverMutation = useMutation({
    mutationFn: (id: string) => api(`/referrals/${id}/handover`, "POST"),
    onSuccess: (updated: any) => {
      queryClient.setQueryData<any[]>(["referrals"], current => current?.map(item => item.id === updated.id ? {...item, ...updated} : item));
      queryClient.invalidateQueries({ queryKey: ["referrals"] });
      queryClient.invalidateQueries({ queryKey: ["hospital-profile"] });
    },
  });

  const capacityMutation = useMutation({
    mutationFn: (data: { id: string; total: number; occupied: number; out_of_service: number; reason: string }) =>
      api(`/capacities/${data.id}`, "PATCH", {
        total: data.total,
        occupied: data.occupied,
        out_of_service: data.out_of_service,
        reason: data.reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospital-profile"] });
      queryClient.invalidateQueries({ queryKey: ["hospitals"] });
      setEditingCapacity(null);
    },
  });

  return (
    <>
      <ErrorBox error={decisionMutation.error || arrivalMutation.error || handoverMutation.error || capacityMutation.error} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <div className="eyebrow">TERA Hospital Coordination Center</div>
          <h1 style={{ margin: "0.25rem 0", fontSize: "1.8rem" }}>{hospital.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.85rem", color: "var(--muted)" }}>
            <span>{hospital.hospital_type || "General Hospital"}</span>
            <span>·</span>
            <span>📍 {hospital.address || hospital.city}</span>
            <span>·</span>
            <span>📞 24/7 Triage: {hospital.emergency_phone || hospital.phone}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Badge value={hospital.verification_status || "Approved"} />
          <Badge value={hospital.operating_status || "Operational"} />
          <button type="button" className="secondary" onClick={onEditProfile} style={{ fontSize: "0.8rem", padding: "6px 12px" }}>
            ⚙️ Reconfigure Hospital
          </button>
        </div>
      </div>

      {/* Capacity Overview Stats Cards */}
      <div className="hospital-stat-grid">
        <div className="hospital-stat-card available">
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Available Beds</span>
          <strong>{availableBeds}</strong>
          <span style={{ fontSize: "0.72rem", color: "#10b981" }}>Immediate Triage Ready</span>
        </div>
        <div className="hospital-stat-card occupied">
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Occupied Beds</span>
          <strong>{occupiedBeds}</strong>
          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Admitted Inpatients</span>
        </div>
        <div className="hospital-stat-card reserved">
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Reserved Beds</span>
          <strong>{reservedBeds}</strong>
          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>In-Transit Ambulances</span>
        </div>
        <div className="hospital-stat-card out-of-service">
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Out of Service</span>
          <strong>{outOfServiceBeds}</strong>
          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Sanitization / Repairs</span>
        </div>
        <div className="hospital-stat-card">
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Total Capacity</span>
          <strong>{totalBeds}</strong>
          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>All Department Cots</span>
        </div>
        <div className="hospital-stat-card">
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Active Departments</span>
          <strong>{(hospital.departments || []).length}</strong>
          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{(hospital.capabilities || []).length} Capabilities</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="hospital-tab-bar">
        <button
          type="button"
          className={`hospital-tab-btn ${tab === "overview" ? "active" : ""}`}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`hospital-tab-btn ${tab === "referrals" ? "active" : ""}`}
          onClick={() => setTab("referrals")}
        >
          Incoming Referrals {pendingReferrals.length > 0 && `(${pendingReferrals.length})`}
        </button>
        <button
          type="button"
          className={`hospital-tab-btn ${tab === "arrivals" ? "active" : ""}`}
          onClick={() => setTab("arrivals")}
        >
          Patient Arrivals & Handover {activeArrivals.length > 0 && `(${activeArrivals.length})`}
        </button>
        <button
          type="button"
          className={`hospital-tab-btn ${tab === "beds" ? "active" : ""}`}
          onClick={() => setTab("beds")}
        >
          Bed Management & Live Updater
        </button>
        <button
          type="button"
          className={`hospital-tab-btn ${tab === "departments" ? "active" : ""}`}
          onClick={() => setTab("departments")}
        >
          Departments & Facilities
        </button>
        <button
          type="button"
          className={`hospital-tab-btn ${tab === "capabilities" ? "active" : ""}`}
          onClick={() => setTab("capabilities")}
        >
          Emergency Capabilities
        </button>
        <button
          type="button"
          className={`hospital-tab-btn ${tab === "history" ? "active" : ""}`}
          onClick={() => setTab("history")}
        >
          Capacity Audit Log
        </button>
      </div>

      {/* TAB: OVERVIEW */}
      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {pendingReferrals.length > 0 && (
            <Panel title="🚨 Urgent Action Required: Incoming Emergency Referrals">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {pendingReferrals.map((r) => (
                  <div key={r.id} className="referral-card-v2" style={{ borderColor: "#f59e0b" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong style={{ fontSize: "1rem" }}>{r.patient_name || "Emergency Patient"}</strong>
                        <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                          {r.patient_triage || r.priority}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                        Incident: <Link to={`/app/incidents/${r.incident_id}`}>{r.incident_case_id || r.incident_id.slice(0, 8)}</Link>
                      </span>
                    </div>

                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                      <strong>Condition:</strong> {r.patient_condition}
                    </div>

                    <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.82rem" }}>
                      <span><strong>Requested Bed:</strong> {r.bed_kind} ({r.department_name})</span>
                      <span><strong>Ambulance ETA:</strong> ~{r.eta_minutes || 15} mins</span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setRejectingRefId(r.id)}
                        disabled={decisionMutation.isPending}
                        style={{ fontSize: "0.82rem", padding: "6px 12px" }}
                      >
                        Reject Referral
                      </button>
                      <button
                        type="button"
                        className="primary"
                        onClick={() => decisionMutation.mutate({ id: r.id, accept: true })}
                        disabled={decisionMutation.isPending}
                        style={{ fontSize: "0.82rem", padding: "6px 14px", fontWeight: 700 }}
                      >
                        ✓ Accept & Reserve Bed
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <Panel title="Real-Time Department Bed Status">
            <div className="capacity-grid">
              {capacities.map((c: any) => (
                <div className="capacity-card" key={c.id}>
                  <div className="eyebrow">{c.department} / {c.kind}</div>
                  <strong>
                    {c.available} <small>available</small>
                  </strong>
                  <p>
                    {c.occupied} occupied · {c.reserved} reserved · {c.out_of_service || 0} oos · {c.total} total
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Hospital Geographic Location">
            <Map points={[{ ...hospital, name: hospital.name, detail: hospital.address }]} />
          </Panel>
        </div>
      )}

      {/* TAB: INCOMING REFERRALS */}
      {tab === "referrals" && (
        <Panel title="Incoming Emergency Referrals">
          {!referrals.length ? (
            <Empty title="No incoming referrals">Dispatch operator referral requests will appear here in real time.</Empty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {referrals.map((r) => (
                <div key={r.id} className="referral-card-v2">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <strong style={{ fontSize: "1.05rem" }}>{r.patient_name || "Emergency Patient"}</strong>
                      <Badge value={r.status} />
                    </div>
                    <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                      Case: <Link to={`/app/incidents/${r.incident_id}`}>{r.incident_case_id || r.incident_id.slice(0, 8)}</Link> · {date(r.created_at)}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.85rem" }}>
                    <div><strong>Condition / Notes:</strong> {r.patient_condition || "Emergency trauma presentation"}</div>
                    <div><strong>Requested Resource:</strong> {r.bed_kind} in {r.department_name} (Current available: {r.available_in_category})</div>
                    <div><strong>Incident Location:</strong> {r.incident_location}</div>
                  </div>

                  {r.reason && (
                    <div style={{ fontSize: "0.82rem", color: r.status === "rejected" ? "var(--danger)" : "var(--muted)" }}>
                      <strong>Decision Note:</strong> {r.reason}
                    </div>
                  )}

                  {r.status === "pending" && (
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setRejectingRefId(r.id)}
                        disabled={decisionMutation.isPending}
                      >
                        Reject Referral
                      </button>
                      <button
                        type="button"
                        className="primary"
                        onClick={() => decisionMutation.mutate({ id: r.id, accept: true })}
                        disabled={decisionMutation.isPending}
                        style={{ fontWeight: 700 }}
                      >
                        ✓ Accept & Reserve Bed
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* TAB: PATIENT ARRIVALS & HANDOVER */}
      {tab === "arrivals" && (
        <Panel title="Patient Arrivals & Clinical Handover">
          {!activeArrivals.length ? (
            <Empty title="No active arrivals">
              Patients transported by emergency dispatch will appear here once referrals are accepted.
            </Empty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {activeArrivals.map((r) => (
                <div key={r.id} className="referral-card-v2" style={{ borderColor: r.status === "accepted" ? "#10b981" : "#3b82f6" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ fontSize: "1.05rem" }}>{r.patient_name}</strong>
                      <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", background: "rgba(16, 185, 129, 0.2)", color: "#10b981", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                        {r.status === "accepted" ? "Bed Reserved (In Transit)" : "Arrived at ER"}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                      Case: <Link to={`/app/incidents/${r.incident_id}`}>{r.incident_case_id || r.incident_id.slice(0, 8)}</Link>
                    </span>
                  </div>

                  <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                    <div><strong>Allocated Bed:</strong> {r.bed_kind} ({r.department_name})</div>
                    <div><strong>Transporting Status:</strong> {r.mission_status || "en_route"}</div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "0.5rem" }}>
                    {r.status === "accepted" && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => arrivalMutation.mutate(r.id)}
                        disabled={arrivalMutation.isPending}
                        style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                      >
                        <Clock3 size={14} /> Confirm Patient Arrival at ER
                      </button>
                    )}
                    <button
                      type="button"
                      className="primary"
                      onClick={() => handoverMutation.mutate(r.id)}
                      disabled={handoverMutation.isPending}
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontWeight: 700 }}
                    >
                      <CheckCircle2 size={14} /> Complete Bed Handover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* TAB: BED MANAGEMENT & LIVE UPDATER */}
      {tab === "beds" && (
        <Panel title="Live Bed Capacity Management">
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ background: "var(--surface-muted, #f8fafc)", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "0.85rem" }}>
              <strong>Real-Time Concurrency Formula:</strong> Available Beds = Total - Occupied - Reserved - Out of Service.
              <span style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)" }}>
                Every change is logged with an immutable audit timestamp and required clinical reason.
              </span>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--muted)" }}>
                  <th style={{ padding: "8px" }}>Department</th>
                  <th style={{ padding: "8px" }}>Bed Category</th>
                  <th style={{ padding: "8px" }}>Total</th>
                  <th style={{ padding: "8px" }}>Occupied</th>
                  <th style={{ padding: "8px" }}>Reserved</th>
                  <th style={{ padding: "8px" }}>Out of Service</th>
                  <th style={{ padding: "8px" }}>Available</th>
                  <th style={{ padding: "8px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {capacities.map((c: any) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px" }}>{c.department}</td>
                    <td style={{ padding: "8px", fontWeight: 600 }}>{c.kind}</td>
                    <td style={{ padding: "8px" }}>{c.total}</td>
                    <td style={{ padding: "8px" }}>{c.occupied}</td>
                    <td style={{ padding: "8px" }}>{c.reserved}</td>
                    <td style={{ padding: "8px" }}>{c.out_of_service || 0}</td>
                    <td style={{ padding: "8px", fontWeight: 700, color: c.available > 0 ? "#10b981" : "#ef4444" }}>
                      {c.available}
                    </td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <button
                        type="button"
                        className="secondary"
                        style={{ fontSize: "0.78rem", padding: "4px 8px" }}
                        onClick={() => {
                          setEditingCapacity(c);
                          setCapTotal(c.total);
                          setCapOccupied(c.occupied);
                          setCapOos(c.out_of_service || 0);
                          setCapReason("");
                        }}
                      >
                        Adjust Capacity
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* TAB: DEPARTMENTS & FACILITIES */}
      {tab === "departments" && (
        <Panel title="Registered Clinical Departments">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>
            {(hospital.departments || []).map((d: any) => (
              <div key={d.id || d.name} style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "1rem", background: "var(--surface)" }}>
                <strong style={{ fontSize: "0.95rem", display: "block" }}>{d.name}</strong>
                <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: "0.4rem" }}>
                  <div><strong>Type:</strong> {d.dept_type || "Clinical"}</div>
                  <div><strong>Status:</strong> {d.status || "Active"}</div>
                  <div><strong>Operating Hours:</strong> {d.operating_hours || "24/7"}</div>
                  <div><strong>In-charge / Head:</strong> {d.head_name || "Medical Officer"}</div>
                  <div><strong>Contact:</strong> {d.contact_number || hospital.emergency_phone || "—"}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* TAB: EMERGENCY CAPABILITIES */}
      {tab === "capabilities" && (
        <Panel title="Verified Emergency & Trauma Capabilities">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {(hospital.capabilities || []).map((c: string) => (
              <div
                key={c}
                style={{
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  color: "#10b981",
                  borderRadius: "6px",
                  padding: "0.5rem 0.85rem",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <Check size={16} /> {c}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* TAB: AUDIT HISTORY */}
      {tab === "history" && (
        <Panel title="Capacity Modification Audit History">
          {!hospital.capacity_history?.length ? (
            <Empty title="No capacity modifications recorded yet" />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--muted)" }}>
                  <th style={{ padding: "8px" }}>Timestamp</th>
                  <th style={{ padding: "8px" }}>Bed Kind</th>
                  <th style={{ padding: "8px" }}>Previous Total → New</th>
                  <th style={{ padding: "8px" }}>Previous Occ → New</th>
                  <th style={{ padding: "8px" }}>Clinical Reason</th>
                </tr>
              </thead>
              <tbody>
                {hospital.capacity_history.map((ch: any) => (
                  <tr key={ch.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px", color: "var(--muted)" }}>{date(ch.created_at)}</td>
                    <td style={{ padding: "8px", fontWeight: 600 }}>{ch.kind || "Bed Capacity"}</td>
                    <td style={{ padding: "8px" }}>{ch.previous_total} → <strong>{ch.new_total}</strong></td>
                    <td style={{ padding: "8px" }}>{ch.previous_occupied} → <strong>{ch.new_occupied}</strong></td>
                    <td style={{ padding: "8px" }}>{ch.reason || "Routine adjustment"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      {/* Reject Modal */}
      {rejectingRefId && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "1.5rem", maxWidth: "480px", width: "100%" }}>
            <h3 style={{ margin: "0 0 0.5rem 0" }}>Reject Emergency Referral</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0 0 1rem 0" }}>
              Please state the clinical or capacity reason for refusing this patient referral:
            </p>
            <textarea
              placeholder="e.g. All ICU beds currently committed to critical neuro post-op patients."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              style={{ width: "100%", padding: "8px", fontSize: "0.85rem", marginBottom: "1rem" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" className="secondary" onClick={() => setRejectingRefId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={!rejectReason.trim()}
                onClick={() => decisionMutation.mutate({ id: rejectingRefId, accept: false, reason: rejectReason })}
                style={{ background: "#ef4444" }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Capacity Modal */}
      {editingCapacity && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "1.5rem", maxWidth: "480px", width: "100%" }}>
            <h3 style={{ margin: "0 0 0.25rem 0" }}>Update Verified Capacity</h3>
            <span style={{ fontSize: "0.82rem", color: "var(--muted)", display: "block", marginBottom: "1rem" }}>
              {editingCapacity.department} · {editingCapacity.kind} (Reserved: {editingCapacity.reserved})
            </span>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.2rem" }}>
                  Total Beds:
                </label>
                <input
                  type="number"
                  min="0"
                  value={capTotal}
                  onChange={(e) => setCapTotal(parseInt(e.target.value) || 0)}
                  style={{ width: "100%", padding: "6px 10px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.2rem" }}>
                  Occupied Beds:
                </label>
                <input
                  type="number"
                  min="0"
                  value={capOccupied}
                  onChange={(e) => setCapOccupied(parseInt(e.target.value) || 0)}
                  style={{ width: "100%", padding: "6px 10px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.2rem" }}>
                  Out of Service Beds:
                </label>
                <input
                  type="number"
                  min="0"
                  value={capOos}
                  onChange={(e) => setCapOos(parseInt(e.target.value) || 0)}
                  style={{ width: "100%", padding: "6px 10px" }}
                />
              </div>

              <div style={{ padding: "6px 10px", background: "var(--surface-muted, #f8fafc)", borderRadius: "6px", fontSize: "0.85rem" }}>
                <strong>New Available Beds:</strong> {Math.max(0, capTotal - capOccupied - editingCapacity.reserved - capOos)}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.2rem" }}>
                  Reason for Adjustment (Audit Record) *:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Discharged 2 patients / Routine sanitization"
                  value={capReason}
                  onChange={(e) => setCapReason(e.target.value)}
                  style={{ width: "100%", padding: "6px 10px" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button type="button" className="secondary" onClick={() => setEditingCapacity(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={!capReason.trim() || capOccupied + editingCapacity.reserved + capOos > capTotal}
                onClick={() =>
                  capacityMutation.mutate({
                    id: editingCapacity.id,
                    total: capTotal,
                    occupied: capOccupied,
                    out_of_service: capOos,
                    reason: capReason,
                  })
                }
              >
                Save Capacity Update
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
