import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, ArrowUpRight, ShieldCheck } from "lucide-react";
import { api, apiUrl, queryClient } from "./api";
import { Brand } from "./Public";
import { ErrorBox } from "./components";
export function Login() {
  const [params] = useSearchParams();
  const invitation = params.get("invitation") || "";
  const [mode, setMode] = useState(invitation ? "register" : "password");
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mfa, setMfa] = useState("");
  const [message, setMessage] = useState("");
  const nav = useNavigate();
  const providers = useQuery({
    queryKey: ["providers"],
    queryFn: () => api("/auth/providers"),
  });
  const m = useMutation({
    mutationFn: async () => {
      if (mode === "password")
        return api("/auth/login", "POST", {
          email,
          password,
          mfa_code: mfa || null,
        });
      if (mode === "register")
        return api("/auth/register", "POST", {
          email,
          password,
          name,
          invitation: invitation || null,
        });
      const purpose =
        mode === "otp" ? "login" : mode === "reset" ? "reset" : "verify";
      return sent
        ? api("/auth/otp/verify", "POST", {
            email,
            purpose,
            code,
            password: mode === "reset" ? password : null,
            mfa_code: mfa || null,
          })
        : api("/auth/otp/request", "POST", { email, purpose });
    },
    onSuccess: (data) => {
      if (
        mode === "password" ||
        (mode === "otp" && sent) ||
        (mode === "verify" && sent)
      ) {
        queryClient.invalidateQueries({ queryKey: ["me"] });
        nav("/app");
        return;
      }
      setMessage(data.message);
      if (mode === "register") {
        setMode("verify");
        setSent(true);
      } else if (!sent) {
        setSent(true);
      } else {
        setMode("password");
        setSent(false);
      }
    },
  });
  const title =
    mode === "register"
      ? "Join the response."
      : mode === "reset"
        ? "Recover your account."
        : mode === "verify"
          ? "Verify your email."
          : "Welcome back.";
  const [directRole, setDirectRole] = useState<string | null>(null);
  const [directError, setDirectError] = useState<unknown>(null);

  const handleDirectLogin = async (accEmail: string, roleName: string) => {
    setDirectRole(roleName);
    setDirectError(null);
    setEmail(accEmail);
    setPassword("Emergency@2025!");
    try {
      await api("/auth/login", "POST", {
        email: accEmail,
        password: "Emergency@2025!",
        mfa_code: null,
      });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      nav("/app");
    } catch (err) {
      setDirectError(err);
      setDirectRole(null);
    }
  };

  function change(next: string) {
    setMode(next);
    setSent(false);
    setMessage("");
    m.reset();
  }

  const DEMO_ROLES = [
    { role: "Operator", email: "operator@tera.org", desc: "Triage Desk", badge: "Live Queue", icon: "🛡️" },
    { role: "Admin", email: "admin@tera.org", desc: "System Config", badge: "Admin", icon: "⚡" },
    { role: "Responder", email: "responder@tera.org", desc: "Field Fleet", badge: "Ambulance", icon: "🚑" },
    { role: "Hospital", email: "hospital@tera.org", desc: "Trauma Care", badge: "ICU / Bed", icon: "🏥" },
    { role: "Analyst", email: "analyst@tera.org", desc: "Crisis Intel", badge: "Analytics", icon: "📊" },
    { role: "Citizen", email: "citizen@tera.org", desc: "Reporter", badge: "Citizen", icon: "👤" },
  ];
  return (
    <main className="auth-layout">
      <aside className="auth-story">
        <Brand />
        <div>
          <div className="eyebrow light">
            A shared picture. A coordinated response.
          </div>
          <h1>
            Connected teams.
            <br />
            <em>Better prepared.</em>
          </h1>
          <p>
            One place for the people who report, coordinate, respond and care.
          </p>
          <div className="auth-line">
            <Activity size={60} />
            <span>
              Every second matters.
              <br />
              Every action is recorded.
            </span>
          </div>
        </div>
        <small>TERA · Emergency coordination platform</small>
      </aside>
      <section className="auth-main">
        <Link to="/" className="back-link">
          ← Back to TERA
        </Link>
        <div className="auth-form">
          <div
            style={{
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.35)",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              marginBottom: "1.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
            }}
          >
            <div>
              <strong style={{ color: "#34d399", fontSize: "0.9rem", display: "block" }}>
                🗄️ DBMS Project Evaluation
              </strong>
              <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                Inspect live schema, Chen ER diagram & SQL Lab directly.
              </span>
            </div>
            <Link
              to="/dbms"
              style={{
                padding: "0.35rem 0.75rem",
                background: "#10b981",
                color: "#0b1916",
                borderRadius: "6px",
                fontWeight: 700,
                fontSize: "0.8rem",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Open Studio →
            </Link>
          </div>
          <div className="eyebrow">Secure team access</div>
          <h2>{title}</h2>
          <p>Use your verified account to continue.</p>
          {mode === "password" && (
            <>
              <a
                className={
                  "google-button " + (!providers.data?.google ? "disabled" : "")
                }
                href={
                  providers.data?.google ? apiUrl("/auth/google") : undefined
                }
                aria-disabled={!providers.data?.google}
              >
                <strong>G</strong> Continue with Google
              </a>
              {providers.data && !providers.data.google && (
                <small className="muted">
                  Google Sign-In is not configured for this deployment.
                </small>
              )}
              <div className="divider">or use your email</div>
              <div className="tabs">
                <button className="active" onClick={() => change("password")}>
                  Password
                </button>
                <button onClick={() => change("otp")}>Email code</button>
              </div>
            </>
          )}
          <form
            className="data-form"
            onSubmit={(e) => {
              e.preventDefault();
              m.mutate();
            }}
          >
            {mode === "register" && (
              <label>
                Full name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                readOnly={sent}
              />
            </label>
            {["password", "register"].includes(mode) ||
            (mode === "reset" && sent) ? (
              <label>
                {mode === "reset" ? "New password" : "Password"}
                <input
                  type="password"
                  minLength={mode === "password" ? 1 : 12}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    mode === "password" ? "current-password" : "new-password"
                  }
                  required
                />
              </label>
            ) : null}
            {sent && (
              <label>
                Six-digit email code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </label>
            )}
            {mode === "password" || sent ? (
              <details>
                <summary>Use an authenticator code</summary>
                <label>
                  Authenticator code
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    value={mfa}
                    onChange={(e) => setMfa(e.target.value)}
                  />
                </label>
              </details>
            ) : null}
            <ErrorBox error={m.error} />
            {message && (
              <div className="notice success" role="status">
                {message}
              </div>
            )}
            <button className="primary" disabled={m.isPending}>
              {m.isPending
                ? "Please wait…"
                : mode === "password"
                  ? "Sign in"
                  : mode === "register"
                    ? "Create account"
                    : sent
                      ? "Verify code"
                      : "Send email code"}
              <ArrowUpRight size={17} />
            </button>
          </form>

          {directError ? <ErrorBox error={directError} /> : null}

          <div
            style={{
              marginTop: "1.25rem",
              padding: "1rem",
              background: "rgba(16, 40, 36, 0.75)",
              borderRadius: "10px",
              border: "1px solid #1a3c36",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.6rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.82rem",
                  color: "#34d399",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                ⚡ 1-Click Instant Role Access
              </span>
              <span
                style={{
                  fontSize: "0.68rem",
                  color: "#94a3b8",
                  background: "rgba(255, 255, 255, 0.06)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                }}
              >
                Direct Login
              </span>
            </div>
            <p
              style={{
                fontSize: "0.74rem",
                color: "#94a3b8",
                margin: "0 0 0.75rem 0",
                lineHeight: "1.4",
              }}
            >
              Click any role to immediately sign in and launch that authorized portal:
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "0.5rem",
              }}
            >
              {DEMO_ROLES.map((acc) => {
                const isLoggingIn = directRole === acc.role;
                return (
                  <button
                    key={acc.email}
                    type="button"
                    disabled={directRole !== null || m.isPending}
                    onClick={() => handleDirectLogin(acc.email, acc.role)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      textAlign: "left",
                      background: isLoggingIn ? "#047857" : "#0a1f1b",
                      color: "#f8fafc",
                      border: "1px solid " + (isLoggingIn ? "#10b981" : "#1a3c36"),
                      padding: "8px 10px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    title={`Click to directly sign in as ${acc.role} (${acc.email})`}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        color: isLoggingIn ? "#fff" : "#34d399",
                        width: "100%",
                      }}
                    >
                      <span>{acc.icon}</span>
                      <span>{acc.role}</span>
                    </div>
                    <small
                      style={{
                        fontSize: "0.68rem",
                        color: isLoggingIn ? "#e2e8f0" : "#94a3b8",
                        marginTop: "2px",
                      }}
                    >
                      {isLoggingIn ? "Logging in…" : acc.desc}
                    </small>
                  </button>
                );
              })}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "0.6rem",
                fontSize: "0.7rem",
                color: "#64748b",
              }}
            >
              <span>
                Standard password: <code>Emergency@2025!</code>
              </span>
              <span style={{ color: "#10b981" }}>✓ All 6 Roles Active</span>
            </div>
          </div>
          <div className="auth-links">
            {mode === "password" ? (
              <>
                <button onClick={() => change("reset")}>
                  Forgot password?
                </button>
                <button onClick={() => change("verify")}>Verify email</button>
              </>
            ) : (
              <button onClick={() => change("password")}>
                Back to password sign in
              </button>
            )}
            {sent && (
              <button
                onClick={() => {
                  setSent(false);
                  setMessage(
                    "You can request a new code after the 60-second cooldown.",
                  );
                }}
              >
                Request another code
              </button>
            )}
          </div>
          <div className="auth-bottom">
            {mode === "register" ? "Already have an account?" : "New to TERA?"}{" "}
            <button
              onClick={() =>
                change(mode === "register" ? "password" : "register")
              }
            >
              {mode === "register" ? "Sign in" : "Create an account"}
            </button>
          </div>
          <div className="privacy-note">
            <ShieldCheck size={16} />
            Operational access is granted by administrator invitation.
          </div>
          <Link className="report-link" to="/report">
            Reporting an emergency? Continue without an account →
          </Link>
        </div>
      </section>
    </main>
  );
}
