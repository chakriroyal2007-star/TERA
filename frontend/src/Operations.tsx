import { apiList, apiCollection } from "./api";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
    queryFn: async () => {
      let serverData = { items: [] as Incident[], total: 0 };
      try {
        serverData = await api<{ items: Incident[]; total: number }>(
          `/incidents?offset=${offset}&limit=20${status ? "&status=" + status : ""}`,
        );
      } catch (err) {
        console.warn("Server incidents fetch error, checking local emergency records", err);
      }

      // Merge client-side reported incidents so operator desk reflects all reports in real time
      try {
        const stored = JSON.parse(localStorage.getItem("tera_local_incidents") || "{}");
        const localList = Object.values(stored) as Incident[];
        const seenIds = new Set(serverData.items.map((i) => i.id).concat(serverData.items.map((i) => i.case_id || "")));
        const extraLocal = localList.filter((li) => li && li.id && !seenIds.has(li.id) && !seenIds.has(li.case_id || ""));
        if (extraLocal.length > 0) {
          const merged = [...extraLocal, ...serverData.items];
          return {
            items: status ? merged.filter((m) => m.status === status) : merged,
            total: serverData.total + extraLocal.length,
          };
        }
      } catch (_) {}

      return serverData;
    },
    refetchInterval: 4000,
  });
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
                  {q.data.items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <Link
                          className="table-link"
                          to={"/app/incidents/" + i.id}
                        >
                          {label(i.category)}
                          <small style={{ color: "#38bdf8", fontWeight: 600 }}>
                            {i.case_id || i.id.slice(0, 8).toUpperCase()}
                          </small>
                        </Link>
                      </td>
                      <td className="truncate">{i.address}</td>
                      <td>
                        <Badge value={i.priority} />
                      </td>
                      <td>
                        <Badge value={i.status} />
                      </td>
                      <td className="muted">{date(i.created_at)}</td>
                      <td>
                        <Link
                          aria-label={"Open incident " + i.id}
                          to={"/app/incidents/" + i.id}
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
    queryFn: async () => {
      try {
        return await api<Incident>("/incidents/" + id);
      } catch (err) {
        try {
          const stored = JSON.parse(localStorage.getItem("tera_local_incidents") || "{}");
          if (id && stored[id]) return stored[id] as Incident;
        } catch (_) {}
        throw err;
      }
    },
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
    queryFn: () => api("/incidents/" + id + "/suggestions"),
    enabled: ops,
  });
  const evidence = useQuery({
    queryKey: ["evidence", id],
    queryFn: () => api<any[]>("/incidents/" + id + "/evidence"),
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
              download
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
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                    Spoken Audio Statement
                  </label>
                  <audio
                    controls
                    src={apiUrl("/incidents/" + id + "/audio")}
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
                    <span>Duration: {voice.data.recording?.duration.toFixed(1)}s</span>
                    <span>Format: {voice.data.recording?.mime_type}</span>
                    <span>
                      Size: {Math.ceil((voice.data.recording?.file_size || 0) / 1024)} KB
                    </span>
                    <span
                      title={voice.data.recording?.checksum}
                      style={{ fontFamily: "monospace" }}
                    >
                      SHA-256: {voice.data.recording?.checksum.slice(0, 16)}…
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
                            Affected People
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
                    <code style={{ fontSize: "11px" }}>{companion.data.session_id.slice(0, 8)}…</code>
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
                {["dispatched", "active"].includes(i.status) && (
                  <DataForm
                    path={base + "/referrals"}
                    submit="Request hospital referral"
                    fields={[
                      {
                        name: "capacity_id",
                        label: "Hospital / department / bed type",
                        options: (hospitals.data || []).flatMap((h) =>
                          h.capacities.map((c: any) => ({
                            value: c.id,
                            label: `${h.name} / ${c.department} / ${c.kind} (${c.available} available)`,
                          })),
                        ),
                      },
                    ]}
                  />
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
export function Hospitals({ user }: { user: User }) {
  const q = useQuery({
    queryKey: ["hospitals"],
    queryFn: () => apiList<any>("/hospitals"),
  });
  const referrals = useQuery({
    queryKey: ["referrals"],
    queryFn: () => apiList<any>("/referrals"),
    enabled: user.role !== "responder",
  });
  const canEdit = ["hospital", "admin"].includes(user.role);
  return (
    <>
      <PageHead
        eyebrow="TERA Network / Hospital coordination"
        title="Capacity, ready for care."
      >
        Maintain verified availability and coordinate patient arrivals.
      </PageHead>
      <ErrorBox error={q.error || referrals.error} />
      <Panel title="Incoming referrals">
        {referrals.isLoading ? (
          <Loading />
        ) : !referrals.data?.length ? (
          <Empty title="No hospital referrals">
            Operator referral requests will appear here.
          </Empty>
        ) : (
          referrals.data.map((r) => (
            <div className="referral-card" key={r.id}>
              <div className="row-between">
                <Link to={"/app/incidents/" + r.incident_id}>
                  Incident {r.incident_id.slice(0, 8)}{" "}
                  <ArrowUpRight size={14} />
                </Link>
                <Badge value={r.status} />
              </div>
              <small>{date(r.created_at)}</small>
              {r.reason && <p>{r.reason}</p>}
              {canEdit && r.status === "pending" && (
                <DataForm
                  path={"/referrals/" + r.id + "/decision"}
                  submit="Submit decision"
                  fields={[
                    {
                      name: "accept",
                      label: "Referral decision",
                      options: [
                        { value: "true", label: "Accept and reserve a bed" },
                        { value: "false", label: "Reject referral" },
                      ],
                    },
                    { name: "reason", label: "Reason" },
                  ]}
                  transform={(d) => ({ ...d, accept: d.accept === "true" })}
                />
              )}{" "}
              {canEdit && r.status === "accepted" && (
                <Action path={"/referrals/" + r.id + "/handover"}>
                  Confirm patient handover
                </Action>
              )}
            </div>
          ))
        )}
      </Panel>
      {q.isLoading ? (
        <Loading />
      ) : (
        q.data?.map((h) => (
          <Panel
            title={h.name}
            key={h.id}
            aside={
              <span className="muted">
                {h.facilities.join(" · ") || "Facilities not recorded"}
              </span>
            }
          >
            <div className="capacity-grid">
              {h.capacities.map((c: any) => (
                <div className="capacity-card" key={c.id}>
                  <div className="eyebrow">
                    {c.department} / {c.kind}
                  </div>
                  <strong>
                    {c.available}
                    <small> available</small>
                  </strong>
                  <p>
                    {c.occupied} occupied · {c.reserved} reserved · {c.total}{" "}
                    total
                  </p>
                  {canEdit && (
                    <details>
                      <summary>Update verified capacity</summary>
                      <DataForm
                        path={"/capacities/" + c.id}
                        method="PATCH"
                        fields={[
                          {
                            name: "total",
                            label: "Total beds",
                            type: "number",
                            value: c.total,
                            min: 0,
                          },
                          {
                            name: "occupied",
                            label: "Occupied beds",
                            type: "number",
                            value: c.occupied,
                            min: 0,
                          },
                        ]}
                      />
                    </details>
                  )}
                </div>
              ))}
            </div>
            {!h.capacities.length && (
              <Empty title="No bed capacity registered" />
            )}
            {canEdit && (
              <details className="spaced">
                <summary>Edit hospital facilities and location</summary>
                <DataForm
                  path={"/hospitals/" + h.id}
                  method="PATCH"
                  fields={[
                    { name: "name", label: "Hospital name", value: h.name },
                    {
                      name: "facilities",
                      label: "Facilities (comma separated)",
                      value: h.facilities.join(", "),
                      required: false,
                    },
                    {
                      name: "latitude",
                      label: "Latitude",
                      type: "number",
                      value: h.latitude ?? "",
                      required: false,
                    },
                    {
                      name: "longitude",
                      label: "Longitude",
                      type: "number",
                      value: h.longitude ?? "",
                      required: false,
                    },
                  ]}
                  transform={(d) => ({
                    ...d,
                    organization_id: h.organization_id,
                    facilities: d.facilities
                      .split(",")
                      .map((s: string) => s.trim())
                      .filter(Boolean),
                  })}
                />
              </details>
            )}
          </Panel>
        ))
      )}
      {canEdit && <HospitalSetup />}
      <Panel title="Hospital locations">
        <Map points={(q.data || []).map((h) => ({ ...h, name: h.name }))} />
      </Panel>
    </>
  );
}
export function HospitalSetup() {
  const h = useQuery({
    queryKey: ["hospitals"],
    queryFn: () => apiList<any>("/hospitals"),
  });
  const d = useQuery({
    queryKey: ["departments"],
    queryFn: () => apiList<any>("/departments"),
  });
  return (
    <Panel title="Department and bed registration">
      <div className="two-col">
        <DataForm
          path="/departments"
          submit="Add department"
          fields={[
            {
              name: "hospital_id",
              label: "Hospital",
              options: (h.data || []).map((x) => ({
                value: x.id,
                label: x.name,
              })),
            },
            { name: "name", label: "Department name" },
          ]}
        />
        <DataForm
          path="/capacities"
          submit="Register bed capacity"
          fields={[
            {
              name: "department_id",
              label: "Department",
              options: (d.data || []).map((x) => ({
                value: x.id,
                label: x.name,
              })),
            },
            {
              name: "kind",
              label: "Bed type",
              options: ["icu", "emergency", "general"].map((value) => ({
                value,
                label: value,
              })),
            },
            { name: "total", label: "Total beds", type: "number", min: 0 },
          ]}
        />
      </div>
      <ErrorBox error={h.error || d.error} />
    </Panel>
  );
}
