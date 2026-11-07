import React from "react";
import { DbmsActivity } from "../types";
import { Activity, Clock, ShieldCheck, GitBranch, ArrowUpRight } from "lucide-react";
import { date } from "../../api";

interface ActivityProps {
  activity: DbmsActivity | null;
}

export function ActivityAuditSection({ activity }: ActivityProps) {
  if (!activity) {
    return <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>Loading live activity stream…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header */}
      <div
        style={{
          background: "#0d1b18",
          border: "1px solid #1a332d",
          borderRadius: "10px",
          padding: "1.25rem",
        }}
      >
        <h2 style={{ margin: "0 0 0.25rem 0", color: "#f8fafc", fontSize: "1.3rem" }}>
          Database Activity, Audit & Migration History
        </h2>
        <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.88rem" }}>
          Immutable PostgreSQL security audit logs, event stream records, and schema migration revisions.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        {/* Left: Security Audit Log Stream */}
        <div
          style={{
            background: "#0d1b18",
            border: "1px solid #1a332d",
            borderRadius: "10px",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <ShieldCheck size={16} color="#34d399" />
            <strong style={{ color: "#f8fafc", fontSize: "0.95rem" }}>
              Immutable Audit Log Stream
            </strong>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "420px", overflowY: "auto" }}>
            {activity.recent_audits.map((a) => (
              <div
                key={a.id}
                style={{
                  background: "rgba(15, 23, 42, 0.4)",
                  border: "1px solid #1e293b",
                  borderRadius: "6px",
                  padding: "0.6rem 0.8rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#38bdf8", fontWeight: 700, fontSize: "0.8rem" }}>
                    {a.action}
                  </span>
                  <span style={{ color: "#64748b", fontSize: "0.7rem" }}>
                    {date(a.created_at)}
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#cbd5e1" }}>
                  Actor: <code style={{ color: "#34d399" }}>{a.actor}</code> · Scope: <code>{a.scope}</code>
                </div>
                <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                  Target: <code>{a.target}</code>
                </div>
              </div>
            ))}
            {activity.recent_audits.length === 0 && (
              <div style={{ padding: "1.5rem", textAlign: "center", color: "#64748b", fontSize: "0.82rem" }}>
                No audit entries recorded in this session.
              </div>
            )}
          </div>
        </div>

        {/* Right: Alembic Migrations & Recent Incidents */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Alembic Migrations */}
          <div
            style={{
              background: "#0d1b18",
              border: "1px solid #1a332d",
              borderRadius: "10px",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <GitBranch size={16} color="#a855f7" />
              <strong style={{ color: "#f8fafc", fontSize: "0.95rem" }}>
                Active Alembic Migration Revisions
              </strong>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {activity.migration_history.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "rgba(15, 23, 42, 0.4)",
                    border: "1px solid #1e293b",
                    borderRadius: "4px",
                    padding: "6px 10px",
                    fontSize: "0.8rem",
                    color: "#f8fafc",
                    fontFamily: "monospace",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ color: "#a855f7" }}>Revision: {m.version_num}</span>
                  <span style={{ color: "#34d399", fontWeight: 700 }}>APPLIED</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Live Incidents */}
          <div
            style={{
              background: "#0d1b18",
              border: "1px solid #1a332d",
              borderRadius: "10px",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Activity size={16} color="#38bdf8" />
              <strong style={{ color: "#f8fafc", fontSize: "0.95rem" }}>
                Recent Operational Incidents
              </strong>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {activity.recent_incidents.map((inc) => (
                <div
                  key={inc.id}
                  style={{
                    background: "rgba(15, 23, 42, 0.4)",
                    border: "1px solid #1e293b",
                    borderRadius: "4px",
                    padding: "6px 10px",
                    fontSize: "0.78rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ color: "#38bdf8" }}>{inc.case_id}</strong>
                    <span style={{ color: "#94a3b8", marginLeft: "6px" }}>{inc.category}</span>
                  </div>
                  <span style={{ color: "#facc15", fontWeight: 600 }}>{inc.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
