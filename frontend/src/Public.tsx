import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowUpRight,
  MapPin,
  ShieldCheck,
  Radio,
  Activity,
  HeartPulse,
  Truck,
  ChartNoAxesCombined,
  Users,
  LocateFixed,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { api, date, label } from "./api";
import {
  PageHead,
  ErrorBox,
  Badge,
  Panel,
  DataForm,
  Loading,
} from "./components";
import { Map } from "./Map";
import { VoiceReporter } from "./VoiceRecorder";

export function Brand() {
  return (
    <Link to="/" className="brand">
      <span className="brand-mark">
        <Activity size={22} />
      </span>
      <span>
        tera<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
export function PublicNav() {
  return (
    <nav className="public-nav" aria-label="Public navigation">
      <Brand />
      <div>
        <Link to="/track">Track a report</Link>
        <Link className="secondary" to="/login">
          Team sign in <ArrowUpRight size={16} />
        </Link>
      </div>
    </nav>
  );
}
export function Landing() {
  const roles = [
    {
      icon: Radio,
      name: "Control operators",
      text: "Verify reports. Coordinate resources. Follow every response.",
    },
    {
      icon: HeartPulse,
      name: "Hospital coordinators",
      text: "Keep capacity current and prepare for every arrival.",
    },
    {
      icon: Truck,
      name: "Field responders",
      text: "One mission, from dispatch through patient handover.",
    },
    {
      icon: ChartNoAxesCombined,
      name: "Operational analysts",
      text: "Understand response times and resource utilization.",
    },
    {
      icon: Users,
      name: "Administrators",
      text: "Manage the people and resources behind the network.",
    },
  ];
  return (
    <>
      <PublicNav />
      <main className="landing">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow light">
              <span className="tiny-line" /> Emergency coordination, connected
            </div>
            <h1>
              Every second
              <br />
              needs a <em>response.</em>
            </h1>
            <p>
              From the first report to the right care. TERA brings people,
              response teams and hospitals together in one coordinated workflow.
            </p>
            <div className="hero-actions">
              <Link className="primary bright" to="/report">
                Report an emergency <ArrowUpRight size={19} />
              </Link>
              <Link className="text-link" to="/track">
                Track your report <ArrowRight size={17} />
              </Link>
            </div>
            <div className="hero-note">
              <ShieldCheck size={17} /> No account needed to report.
            </div>
          </div>
          <div
            className="hero-visual"
            aria-label="Emergency coordination lifecycle"
          >
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="visual-core">
              <Activity size={42} />
              <span>TERA</span>
              <small>CONNECTED RESPONSE</small>
            </div>
            <div className="orbit-card card-report">
              <span>01</span>
              <MapPin />
              <div>
                Report<small>Share what happened</small>
              </div>
            </div>
            <div className="orbit-card card-dispatch">
              <span>02</span>
              <Radio />
              <div>
                Coordinate<small>Connect the right team</small>
              </div>
            </div>
            <div className="orbit-card card-care">
              <span>03</span>
              <HeartPulse />
              <div>
                Care<small>Complete the handover</small>
              </div>
            </div>
          </div>
        </section>
        <section className="how">
          <div>
            <div className="eyebrow">One connected journey</div>
            <h2>Clarity when it matters most.</h2>
          </div>
          <p>
            Each report has a unique tracking code. Each operational action is
            recorded. Every team works from the same information.
          </p>
        </section>
        <section className="role-grid">
          {roles.map((r) => (
            <Link to="/login" className="role-card" key={r.name}>
              <r.icon />
              <h3>{r.name}</h3>
              <p>{r.text}</p>
              <ArrowUpRight className="role-arrow" size={18} />
            </Link>
          ))}
        </section>
        <div className="deployment-note">
          TERA is a coordination platform. Reports require a staffed, configured
          operations team to receive a response.
        </div>
      </main>
      <footer>
        <Brand />
        <span>Temporal Emergency Resource Allocation & Coordination</span>
        <Link to="/report">
          Start a report <ArrowUpRight size={14} />
        </Link>
      </footer>
    </>
  );
}
const reportSchema = z
  .object({
    category: z.enum([
      "medical",
      "road_collision",
      "fire",
      "disaster",
      "other",
    ]),
    description: z
      .string()
      .min(10, "Describe the situation in at least 10 characters")
      .max(5000),
    address: z.string().min(3, "Enter a location or landmark").max(500),
    latitude: z.union([
      z.literal(""),
      z.coerce.number<string | number>().min(-90).max(90),
    ]),
    longitude: z.union([
      z.literal(""),
      z.coerce.number<string | number>().min(-180).max(180),
    ]),
  })
  .refine((v) => (v.latitude === "") === (v.longitude === ""), {
    message: "Enter both coordinates",
    path: ["longitude"],
  });
type ReportValues = z.infer<typeof reportSchema>;
export function ReportPage() {
  const nav = useNavigate();
  const [reportMode, setReportMode] = useState<"voice" | "text">("text");
  const [geoError, setGeoError] = useState("");
  const [geoBusy, setGeoBusy] = useState(false);
  const form = useForm<z.input<typeof reportSchema>, unknown, ReportValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: { category: "medical", latitude: "", longitude: "" },
  });
  const m = useMutation({
    mutationFn: (v: ReportValues) =>
      api("/public/incidents", "POST", {
        ...v,
        latitude: v.latitude === "" ? null : Number(v.latitude),
        longitude: v.longitude === "" ? null : Number(v.longitude),
      }),
    onSuccess: (r) => nav("/track/" + r.tracking_code),
  });
  const lat = form.watch("latitude"),
    lng = form.watch("longitude");
  function locate() {
    setGeoBusy(true);
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoBusy(false);
      setGeoError("Location is unavailable. Enter your location manually.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        form.setValue("latitude", p.coords.latitude);
        form.setValue("longitude", p.coords.longitude);
        setGeoBusy(false);
      },
      (e) => {
        setGeoError(e.message);
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }
  return (
    <>
      <PublicNav />
      <main className="public-content">
        <PageHead eyebrow="TERA Assist" title="Tell us what happened.">
          A clear location helps the response team find you. No account
          required.
        </PageHead>
        <div className="two-col">
          <Panel
            title="Emergency report"
            aside={
              <div className="report-mode-tabs">
                <button
                  type="button"
                  className={reportMode === "voice" ? "active" : ""}
                  onClick={() => setReportMode("voice")}
                >
                  🎙️ Voice Report
                </button>
                <button
                  type="button"
                  className={reportMode === "text" ? "active" : ""}
                  onClick={() => setReportMode("text")}
                >
                  📝 Manual Form
                </button>
              </div>
            }
          >
            {reportMode === "voice" ? (
              <VoiceReporter />
            ) : (
              <form
                className="data-form"
                onSubmit={form.handleSubmit((v) => m.mutate(v))}
              >
                <label>
                  Emergency category
                  <select {...form.register("category")}>
                    <option value="medical">Medical emergency</option>
                    <option value="road_collision">Road collision</option>
                    <option value="fire">Fire</option>
                    <option value="disaster">Disaster</option>
                    <option value="other">Other emergency</option>
                  </select>
                </label>
                <label>
                  What is happening?
                  <textarea
                    {...form.register("description")}
                    placeholder="Describe what you can see. Include only information you know."
                    rows={5}
                  />
                </label>
                <label>
                  Address or nearby landmark
                  <input
                    {...form.register("address")}
                    placeholder="Street, building, area or landmark"
                  />
                </label>
                <button
                  type="button"
                  className="secondary"
                  disabled={geoBusy}
                  onClick={locate}
                >
                  <LocateFixed size={16} />
                  {geoBusy ? "Locating…" : "Use my current location"}
                </button>
                <ErrorBox error={geoError} />
                <div className="two-fields">
                  <label>
                    Latitude (optional)
                    <input
                      type="number"
                      step="any"
                      {...form.register("latitude")}
                    />
                  </label>
                  <label>
                    Longitude (optional)
                    <input
                      type="number"
                      step="any"
                      {...form.register("longitude")}
                    />
                  </label>
                </div>
                <p className="muted">
                  Check the pin. You can correct coordinates manually.
                </p>
                {Object.values(form.formState.errors).map((e, i) => (
                  <ErrorBox key={i} error={e.message} />
                ))}
                <ErrorBox error={m.error} />
                <button className="primary" disabled={m.isPending}>
                  {m.isPending ? "Submitting…" : "Submit emergency report"}
                  <ArrowUpRight size={18} />
                </button>
              </form>
            )}
          </Panel>
          <div>
            <Panel title="Reported location">
              <Map
                points={
                  lat !== "" && lng !== ""
                    ? [
                        {
                          latitude: Number(lat),
                          longitude: Number(lng),
                          name: "Your report location",
                        },
                      ]
                    : []
                }
              />
            </Panel>
            <div className="info-card">
              <ShieldCheck />
              <h3>Your report stays traceable.</h3>
              <p>
                After submission, save your private tracking code. Use it to
                follow milestones, add details and upload photo or audio
                evidence.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
export function TrackPage() {
  const { code } = useParams();
  const nav = useNavigate();
  const [input, setInput] = useState("");
  const [uploadError, setUploadError] = useState<unknown>(null);
  const [uploaded, setUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const q = useQuery({
    queryKey: ["tracking", code],
    queryFn: () => api("/public/track/" + encodeURIComponent(code!)),
    enabled: !!code,
    refetchInterval: 10000,
  });
  return (
    <>
      <PublicNav />
      <main className="public-content narrow">
        <PageHead eyebrow="TERA Assist" title="Follow your report.">
          Milestones from the coordination team, as they are recorded.
        </PageHead>
        <Panel title="Private tracking code">
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              nav("/track/" + encodeURIComponent(input.trim()));
            }}
          >
            <label className="grow">
              <span className="sr-only">Tracking code</span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="TRK-…"
                required
              />
            </label>
            <button className="primary">
              Track <ArrowRight size={16} />
            </button>
          </form>
          {code && (
            <div className="tracking-code">
              <small>Save this code. It grants access to report updates.</small>
              <code>{code}</code>
            </div>
          )}
        </Panel>
        <ErrorBox error={q.error} />
        {q.isLoading && code && <Loading />}
        {q.data && (
          <>
            <Panel
              title="Report progress"
              aside={<Badge value={q.data.status} />}
            >
              <ol className="timeline">
                {q.data.timeline.map((e: any, i: number) => (
                  <li key={i}>
                    <span className="timeline-dot">
                      <CheckCircle2 size={15} />
                    </span>
                    <div>
                      <strong>{label(e.kind)}</strong>
                      <small>{date(e.at)}</small>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
            {!["closed", "duplicate"].includes(q.data.status) && (
              <>
                <Panel title="Add information">
                  <DataForm
                    path={"/public/track/" + code + "/notes"}
                    fields={[
                      {
                        name: "text",
                        label: "Additional details",
                        type: "textarea",
                      },
                    ]}
                    submit="Send update"
                  />
                </Panel>
                <Panel title="Photo or audio evidence">
                  <p className="muted">
                    JPEG, PNG, WebP, WAV or WebM. Maximum 10 MB. Evidence is
                    visible only to authorized teams.
                  </p>
                  <label className="upload">
                    {uploading ? "Uploading…" : "Choose evidence file"}
                    <input
                      disabled={uploading}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,audio/wav,audio/webm"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadError(null);
                        setUploaded(false);
                        setUploading(true);
                        const data = new FormData();
                        data.append("file", file);
                        try {
                          await api(
                            "/public/track/" + code + "/evidence",
                            "POST",
                            data,
                          );
                          setUploaded(true);
                        } catch (error) {
                          setUploadError(error);
                        } finally {
                          setUploading(false);
                        }
                      }}
                    />
                  </label>
                  <ErrorBox error={uploadError} />
                  {uploaded && (
                    <p role="status" className="success">
                      Evidence uploaded.
                    </p>
                  )}
                </Panel>
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
