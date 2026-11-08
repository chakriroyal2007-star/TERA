import React from "react";
import { DbmsOverview, TableMetadata } from "../types";
import {
  Database,
  Table,
  Network,
  Key,
  ShieldCheck,
  Cpu,
  Layers,
  Activity,
  CheckCircle2,
  FileCode,
  Zap,
  GitMerge,
} from "lucide-react";

interface OverviewProps {
  overview: DbmsOverview | null;
  tables: TableMetadata[];
  onSelectTable: (tableName: string) => void;
  onNavigateSection: (section: string) => void;
}

export function OverviewSection({
  overview,
  tables,
  onSelectTable,
  onNavigateSection,
}: OverviewProps) {
  if (!overview) return null;

  const cards = [
    { label: "Database Tables", value: overview.total_tables, icon: Table, color: "#38bdf8", section: "schema" },
    { label: "Identified Entities", value: overview.total_entities, icon: Database, color: "#34d399", section: "er" },
    { label: "SQL Relational Joins", value: "10 Types", icon: GitMerge, color: "#10b981", section: "joins" },
    { label: "Relational Links", value: overview.total_relationships, icon: Network, color: "#a855f7", section: "relationships" },
    { label: "Total Attributes", value: overview.total_attributes, icon: Layers, color: "#facc15", section: "schema" },
    { label: "Primary Keys", value: overview.total_primary_keys, icon: Key, color: "#fb923c", section: "keys" },
    { label: "Foreign Keys", value: overview.total_foreign_keys, icon: Key, color: "#f43f5e", section: "keys" },
    { label: "Active Indexes", value: overview.total_indexes, icon: Zap, color: "#60a5fa", section: "indexing" },
    { label: "Integrity Constraints", value: overview.total_constraints, icon: ShieldCheck, color: "#10b981", section: "keys" },
    { label: "Database Views", value: overview.total_views, icon: FileCode, color: "#c084fc", section: "schema" },
    { label: "System Triggers", value: overview.total_triggers, icon: Activity, color: "#fb7185", section: "activity" },
    { label: "Database Functions", value: overview.total_functions, icon: Cpu, color: "#2dd4bf", section: "schema" },
  ];

  // Group tables by domain
  const domains: Record<string, TableMetadata[]> = {
    "Identity & Access": [],
    "Incident Operations": [],
    "Voice & AI Processing": [],
    "Healthcare & Fleet": [],
    "AI First-Aid Protocols": [],
    "Audit & Platform": [],
  };

  tables.forEach((t) => {
    const name = t.name;
    if (["users", "roles", "memberships", "permissions", "role_permissions", "sessions", "challenges", "invitations"].includes(name)) {
      domains["Identity & Access"].push(t);
    } else if (["incidents", "incident_status_histories", "reports", "evidence"].includes(name)) {
      domains["Incident Operations"].push(t);
    } else if (["voice_recordings", "transcription_jobs", "transcripts", "incident_extractions"].includes(name)) {
      domains["Voice & AI Processing"].push(t);
    } else if (["hospitals", "departments", "capacities", "ambulances", "missions", "referrals", "reservations"].includes(name)) {
      domains["Healthcare & Fleet"].push(t);
    } else if (["emergency_protocols", "emergency_protocol_versions", "emergency_protocol_steps", "emergency_protocol_translations", "emergency_assistance_sessions", "emergency_conversation_messages"].includes(name)) {
      domains["AI First-Aid Protocols"].push(t);
    } else {
      domains["Audit & Platform"].push(t);
    }
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(16, 40, 36, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)",
          border: "1px solid #1e3a34",
          borderRadius: "12px",
          padding: "1.75rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ color: "#34d399", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Real-Time PostgreSQL Database Architecture
          </div>
          <h2 style={{ margin: "0.35rem 0", color: "#f8fafc", fontSize: "1.6rem" }}>
            TERA DBMS Studio
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.95rem", maxWidth: "620px" }}>
            Inspect live schema metadata, Chen ER models, relational normalization, functional dependencies, ACID transactions, and execute read-only queries against live emergency operational relations.
          </p>
        </div>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ background: "rgba(15, 23, 42, 0.7)", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #334155" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", display: "block" }}>ENGINE / DIALECT</span>
            <strong style={{ color: "#38bdf8", fontSize: "1rem" }}>{overview.database_version}</strong>
          </div>
          <div style={{ background: "rgba(15, 23, 42, 0.7)", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #334155" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", display: "block" }}>SCHEMA</span>
            <strong style={{ color: "#34d399", fontSize: "1rem" }}>{overview.schema_name}</strong>
          </div>
        </div>
      </div>

      {/* 11 Metric Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
          gap: "1rem",
        }}
      >
        {cards.map((c, idx) => (
          <div
            key={idx}
            onClick={() => onNavigateSection(c.section)}
            style={{
              background: "#0d1b18",
              border: "1px solid #1a332d",
              borderRadius: "10px",
              padding: "1.1rem",
              cursor: "pointer",
              transition: "transform 0.15s ease, border-color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = c.color;
              (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#1a332d";
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{c.label}</span>
              <c.icon size={18} color={c.color} />
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "#f8fafc" }}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {/* Domain Breakdown Table */}
      <div style={{ background: "#0d1b18", border: "1px solid #1a332d", borderRadius: "10px", padding: "1.5rem" }}>
        <h3 style={{ margin: "0 0 1rem 0", color: "#f8fafc", fontSize: "1.1rem" }}>
          Relational Domain Architecture
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
          {Object.entries(domains).map(([domain, tableList]) => (
            <div
              key={domain}
              style={{
                background: "rgba(15, 23, 42, 0.4)",
                border: "1px solid #1e293b",
                borderRadius: "8px",
                padding: "1rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <strong style={{ color: "#38bdf8", fontSize: "0.9rem" }}>{domain}</strong>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{tableList.length} relations</span>
              </div>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                {tableList.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => {
                      onSelectTable(t.name);
                      onNavigateSection("schema");
                    }}
                    style={{
                      background: "rgba(30, 41, 59, 0.6)",
                      border: "1px solid #334155",
                      color: "#e2e8f0",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                    }}
                  >
                    <span>{t.name}</span>
                    <span style={{ fontSize: "0.68rem", color: "#34d399", fontWeight: 700 }}>
                      ({t.row_count})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

