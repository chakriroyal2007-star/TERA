import React, { useState } from "react";
import { api } from "../../api";
import { SqlExecutionResult } from "../types";
import {
  Play,
  Copy,
  Check,
  Clock,
  Terminal,
  Database,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";

export interface JoinDefinition {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  algebra: string;
  tagline: string;
  sql: string;
  vennType: "inner" | "left" | "right" | "full" | "cross" | "self" | "anti" | "semi" | "multi";
  academicPurpose: string;
  teraWorkflow: string;
  optimizerStrategy: string;
}

export const ALL_TERA_JOINS: JoinDefinition[] = [
  {
    id: "inner",
    name: "INNER JOIN (Equi-Join)",
    badge: "Equi-Join",
    badgeColor: "#10b981",
    algebra: "incidents ⋈_{incidents.id = missions.incident_id} missions",
    tagline: "Returns only records where the join key matches in BOTH relations.",
    sql: `SELECT 
  i.case_id, 
  i.category, 
  i.priority, 
  i.status AS incident_status, 
  m.id AS mission_id, 
  m.status AS mission_status, 
  m.created_at AS dispatched_at
FROM incidents i
INNER JOIN missions m ON m.incident_id = i.id
ORDER BY m.created_at DESC
LIMIT 10;`,
    vennType: "inner",
    academicPurpose:
      "Eliminates unassigned incidents and phantom missions. Only paired keys present in both R and S appear in the result relation.",
    teraWorkflow:
      "Operator Dispatch Console: Displays active emergency cases that have an authorized response mission in progress.",
    optimizerStrategy:
      "Hash Join with sequential scan on build table, or Nested Loop when indexed by foreign key (idx_missions_incident_id).",
  },
  {
    id: "left",
    name: "LEFT OUTER JOIN",
    badge: "Left Outer",
    badgeColor: "#38bdf8",
    algebra: "incidents ⟕_{incidents.id = voice_recordings.incident_id} (voice_recordings ⟕ transcripts)",
    tagline: "Preserves ALL rows from the Left table, populating Right columns with NULL when no match exists.",
    sql: `SELECT 
  i.case_id, 
  i.category, 
  i.status, 
  v.original_filename, 
  v.mime_type, 
  t.detected_language, 
  t.original_transcript
FROM incidents i
LEFT JOIN voice_recordings v ON v.incident_id = i.id
LEFT JOIN transcripts t ON t.recording_id = v.id
ORDER BY i.created_at DESC
LIMIT 10;`,
    vennType: "left",
    academicPurpose:
      "Preserves non-matching left tuples. Essential when the child entity (voice recording) is optional (e.g. text/manual reports).",
    teraWorkflow:
      "Citizen Reporting Intake: Lists all filed incidents, showing transcripts where citizen used AI Voice, and NULLs for manual forms.",
    optimizerStrategy:
      "Hash Left Join preserving left tuple order; inner table rows missing produce synthesized NULL attributes.",
  },
  {
    id: "right",
    name: "RIGHT OUTER JOIN",
    badge: "Right Outer",
    badgeColor: "#f59e0b",
    algebra: "missions ⟖_{missions.ambulance_id = ambulances.id} ambulances",
    tagline: "Preserves ALL rows from the Right table, ensuring every fleet unit appears even if unassigned.",
    sql: `SELECT 
  a.registration, 
  a.active AS ambulance_active, 
  m.id AS mission_id, 
  m.status AS mission_status, 
  m.created_at AS mission_dispatched_at
FROM missions m
RIGHT OUTER JOIN ambulances a ON m.ambulance_id = a.id
ORDER BY a.registration
LIMIT 10;`,
    vennType: "right",
    academicPurpose:
      "Guarantees complete coverage of the referenced dimension table (Ambulances) even when no transaction facts exist in Missions.",
    teraWorkflow:
      "Fleet Readiness Audit: Surfaces all registered ambulances across stations, revealing which vehicles are currently on dispatch vs idle.",
    optimizerStrategy:
      "PostgreSQL typically commutes R RIGHT JOIN S into S LEFT JOIN R internally for optimized hash table generation.",
  },
  {
    id: "full",
    name: "FULL OUTER JOIN",
    badge: "Full Outer",
    badgeColor: "#a855f7",
    algebra: "incidents ⟗_{incidents.organization_id = ambulances.organization_id} ambulances",
    tagline: "Bi-directional outer join preserving all rows from both tables, filling mismatches with NULL.",
    sql: `SELECT 
  i.case_id, 
  i.category, 
  i.status AS incident_status, 
  a.registration, 
  a.active AS ambulance_active
FROM incidents i
FULL OUTER JOIN ambulances a ON i.organization_id = a.organization_id
LIMIT 15;`,
    vennType: "full",
    academicPurpose:
      "Union of Left Outer Join and Right Outer Join: (R ⟕ S) ∪ (R ⟖ S). Surfaces orphans on both sides of the relation.",
    teraWorkflow:
      "Jurisdiction Cross-Audit: Identifies incidents logged in districts with no ambulances, and ambulances stationed where no incidents exist.",
    optimizerStrategy:
      "Hash Full Join requiring full materialization of hash tables on both relations.",
  },
  {
    id: "cross",
    name: "CROSS JOIN (Cartesian Product)",
    badge: "Cartesian R × S",
    badgeColor: "#ec4899",
    algebra: "hospitals × (π_{category}(incidents))",
    tagline: "Calculates the Cartesian Product R × S producing |R| × |S| all possible attribute combinations.",
    sql: `SELECT 
  h.name AS hospital_name, 
  cat.category AS emergency_category
FROM hospitals h
CROSS JOIN (
  SELECT DISTINCT category FROM incidents LIMIT 5
) cat
ORDER BY h.name, cat.category
LIMIT 15;`,
    vennType: "cross",
    academicPurpose:
      "Foundational relational algebra operator. Multiplying relations without a theta-predicate produces every hypothetical combination.",
    teraWorkflow:
      "Disaster Preparedness Matrix: Generates an exhaustive triage preparedness matrix pairing every facility against every emergency threat.",
    optimizerStrategy:
      "Nested Loop join without join condition, iterating over the full Cartesian product.",
  },
  {
    id: "self",
    name: "SELF JOIN (Table Joined to Itself)",
    badge: "Self Join",
    badgeColor: "#ef4444",
    algebra: "incidents_{1} ⋈_{i1.category = i2.category ∧ i1.id ≠ i2.id} incidents_{2}",
    tagline: "Joins a relation to an aliased instance of itself to correlate rows within the same entity.",
    sql: `SELECT 
  i1.case_id AS incident_alpha, 
  i2.case_id AS incident_beta, 
  i1.category, 
  i1.status AS status_alpha, 
  i2.status AS status_beta
FROM incidents i1
JOIN incidents i2 ON i1.category = i2.category AND i1.id <> i2.id
LIMIT 10;`,
    vennType: "self",
    academicPurpose:
      "Compares different records in the same relation using unique tuple aliases. Essential for hierarchies, sequences, and duplicate detection.",
    teraWorkflow:
      "Duplicate & Escalation Detection: Identifies co-occurring emergencies in the same category that might represent multi-caller duplicates.",
    optimizerStrategy:
      "Hash Join on self-table alias, applying inequality filter (i1.id <> i2.id) during join probe.",
  },
  {
    id: "multi4",
    name: "MULTI-TABLE 4-WAY JOIN",
    badge: "4-Way Join",
    badgeColor: "#14b8a6",
    algebra: "incidents ⋈ missions ⋈ ambulances ⋈ users",
    tagline: "Chains 4 relations across foreign keys to assemble complete dispatch manifests from 3NF tables.",
    sql: `SELECT 
  i.case_id, 
  i.category, 
  i.priority, 
  m.status AS mission_status, 
  a.registration AS ambulance_plate, 
  u.name AS responder_name, 
  u.email AS responder_email
FROM incidents i
JOIN missions m ON m.incident_id = i.id
JOIN ambulances a ON a.id = m.ambulance_id
JOIN users u ON u.id = m.responder_id
ORDER BY m.created_at DESC
LIMIT 10;`,
    vennType: "multi",
    academicPurpose:
      "Demonstrates lossless join property of normalized relational models. Normalized tables are recombined without loss of operational context.",
    teraWorkflow:
      "Emergency Operations Center Manifest: Generates the real-time mission dispatch manifest linking Patient, Dispatch, Vehicle, and Paramedic.",
    optimizerStrategy:
      "Multi-level join tree with left-deep or bushy plan chosen by dynamic programming optimizer using table statistics.",
  },
  {
    id: "hospitals3",
    name: "MULTI-TABLE 3-WAY HOSPITAL CAPACITIES JOIN",
    badge: "3-Way Join",
    badgeColor: "#6366f1",
    algebra: "hospitals ⋈ departments ⋈ capacities",
    tagline: "Navigates 1:N:M hierarchical entity paths: Hospital → Departments → Real-Time Bed Capacities.",
    sql: `SELECT 
  h.name AS hospital_name, 
  d.name AS department_name, 
  c.kind AS bed_type, 
  c.total AS total_beds, 
  c.occupied AS occupied_beds, 
  c.reserved AS reserved_beds, 
  (c.total - c.occupied - c.reserved) AS available_beds
FROM hospitals h
JOIN departments d ON d.hospital_id = h.id
JOIN capacities c ON c.department_id = d.id
ORDER BY available_beds DESC
LIMIT 15;`,
    vennType: "multi",
    academicPurpose:
      "Demonstrates transitive referential integrity across 2 foreign keys: capacities.department_id → departments.id, departments.hospital_id → hospitals.id.",
    teraWorkflow:
      "Intelligent Hospital Handover: Calculates exact live ICU and Trauma bed availability before dispatching ambulances to receiving centers.",
    optimizerStrategy:
      "Index Scan on primary keys cascaded into hash aggregate for bed surplus calculations.",
  },
  {
    id: "anti",
    name: "ANTI-JOIN (Set Difference R ▷ S)",
    badge: "Anti-Join",
    badgeColor: "#f97316",
    algebra: "ambulances ▷_{ambulances.id = missions.ambulance_id} missions",
    tagline: "Returns rows from R that have NO matching rows in S. Discovers idle resources and orphan records.",
    sql: `SELECT 
  a.id AS ambulance_id, 
  a.registration, 
  a.active, 
  a.created_at
FROM ambulances a
WHERE NOT EXISTS (
  SELECT 1 FROM missions m 
  WHERE m.ambulance_id = a.id AND m.status != 'completed'
)
ORDER BY a.registration
LIMIT 10;`,
    vennType: "anti",
    academicPurpose:
      "Implements Relational Set Difference: R - (R ⋉ S). More declarative and performant than outer joins with NULL checks.",
    teraWorkflow:
      "Resource Dispatch Allocator: Directly locates available ambulances ready for instant dispatch assignment.",
    optimizerStrategy:
      "Hash Anti-Join: stops searching the right table as soon as a single match is found, discarding matching left tuples.",
  },
  {
    id: "semi",
    name: "SEMI-JOIN (Correlated Membership R ⋉ S)",
    badge: "Semi-Join",
    badgeColor: "#06b6d4",
    algebra: "incidents ⋉_{incidents.id = voice_recordings.incident_id} voice_recordings",
    tagline: "Returns rows from R that have at least one match in S without duplicating R rows or copying S columns.",
    sql: `SELECT 
  i.case_id, 
  i.category, 
  i.priority, 
  i.address, 
  i.status
FROM incidents i
WHERE EXISTS (
  SELECT 1 FROM voice_recordings v 
  WHERE v.incident_id = i.id
)
ORDER BY i.created_at DESC
LIMIT 10;`,
    vennType: "semi",
    academicPurpose:
      "Left Semi-Join: π_R(R ⋈ S). Returns only attributes of R, short-circuiting on the first matching tuple in S.",
    teraWorkflow:
      "AI Speech Audio Audit: Filters cases that contain authentic citizen voice recordings for forensic playback and AI quality reviews.",
    optimizerStrategy:
      "Hash Semi-Join: builds a hash set of matching foreign keys; left tuples are emitted once upon first match.",
  },
  {
    id: "aggregate",
    name: "AGGREGATE JOIN (GROUP BY + HAVING)",
    badge: "Aggregate Join",
    badgeColor: "#84cc16",
    algebra: "γ_{hospital, COUNT(dept), SUM(beds)}(hospitals ⋈ departments ⋈ capacities)",
    tagline: "Joins multiple relations and aggregates measures with conditional HAVING filtering.",
    sql: `SELECT 
  h.name AS hospital_name, 
  COUNT(DISTINCT d.id) AS active_departments, 
  SUM(c.total) AS total_capacity, 
  SUM(c.occupied) AS occupied_capacity, 
  SUM(c.total - c.occupied - c.reserved) AS total_available_beds
FROM hospitals h
JOIN departments d ON d.hospital_id = h.id
JOIN capacities c ON c.department_id = d.id
GROUP BY h.id, h.name
HAVING SUM(c.total) > 0
ORDER BY total_available_beds DESC;`,
    vennType: "multi",
    academicPurpose:
      "Combines relational product, selection, projection, grouping, and post-aggregation filtering (HAVING predicate).",
    teraWorkflow:
      "Regional Healthcare Directorate: High-level dashboard summarizing critical care readiness per medical center.",
    optimizerStrategy:
      "Hash Join followed by Hash Aggregate; groups with total capacity = 0 pruned by HAVING clause.",
  },
];

interface JoinsSectionProps {
  onOpenInSqlLab?: (sql: string) => void;
}

export function JoinsSection({ onOpenInSqlLab }: JoinsSectionProps = {}) {
  const [selectedJoinId, setSelectedJoinId] = useState("inner");
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<SqlExecutionResult | null>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showExplain, setShowExplain] = useState(false);

  const selectedJoin =
    ALL_TERA_JOINS.find((j) => j.id === selectedJoinId) || ALL_TERA_JOINS[0];

  const handleRunJoin = async (explain: boolean = false) => {
    setExecuting(true);
    setExecError(null);
    setShowExplain(explain);
    try {
      const sqlToRun = explain
        ? `EXPLAIN (FORMAT JSON) ${selectedJoin.sql}`
        : selectedJoin.sql;
      const res = await api<SqlExecutionResult>("/dbms/sql/execute", "POST", {
        query: sqlToRun,
        limit: 50,
      });
      setExecResult(res);
    } catch (err: any) {
      setExecError(err?.message || "Execution failed.");
      setExecResult(null);
    } finally {
      setExecuting(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(selectedJoin.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #0d1b18 0%, #061814 100%)",
          border: "1px solid #1a332d",
          borderRadius: "10px",
          padding: "1.25rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span
              style={{
                fontSize: "0.72rem",
                textTransform: "uppercase",
                background: "#047857",
                color: "#d1fae5",
                padding: "2px 8px",
                borderRadius: "4px",
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}
            >
              All 10 Relational Joins Verified
            </span>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>DBMS Mini Project Rubric</span>
          </div>
          <h2 style={{ margin: "0 0 0.25rem 0", color: "#f8fafc", fontSize: "1.35rem" }}>
            Relational Joins Laboratory
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.88rem" }}>
            Interactive exploration of all SQL join types: Inner, Left, Right, Full, Cross, Self, Multi-Table, Anti-Join, Semi-Join, and Aggregates.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => handleRunJoin(false)}
            disabled={executing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "#047857",
              color: "#fff",
              border: "none",
              padding: "8px 14px",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: executing ? "not-allowed" : "pointer",
            }}
          >
            <Play size={15} fill="#fff" />
            {executing ? "Executing Live Query…" : "Run Selected Join Live"}
          </button>
        </div>
      </div>

      {/* Join Types Horizontal Navigation Bar */}
      <div
        style={{
          display: "flex",
          gap: "0.4rem",
          overflowX: "auto",
          padding: "0.5rem 0",
          borderBottom: "1px solid #1e293b",
        }}
      >
        {ALL_TERA_JOINS.map((j) => {
          const isSelected = j.id === selectedJoinId;
          return (
            <button
              key={j.id}
              type="button"
              onClick={() => {
                setSelectedJoinId(j.id);
                setExecResult(null);
                setExecError(null);
              }}
              style={{
                background: isSelected ? "#1e293b" : "rgba(15, 23, 42, 0.4)",
                color: isSelected ? "#f8fafc" : "#94a3b8",
                border: isSelected ? `1px solid ${j.badgeColor}` : "1px solid #334155",
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "0.8rem",
                fontWeight: isSelected ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                transition: "all 0.15s ease",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: j.badgeColor,
                  display: "inline-block",
                }}
              />
              <span>{j.badge}</span>
            </button>
          );
        })}
      </div>

      {/* Main Join Exploration Card */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: "1.25rem",
        }}
      >
        {/* Left Column: SQL & Relational Algebra */}
        <div
          style={{
            background: "#081311",
            border: "1px solid #1a332d",
            borderRadius: "10px",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  style={{
                    background: `${selectedJoin.badgeColor}25`,
                    color: selectedJoin.badgeColor,
                    border: `1px solid ${selectedJoin.badgeColor}50`,
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}
                >
                  {selectedJoin.badge}
                </span>
                <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "1.15rem" }}>
                  {selectedJoin.name}
                </h3>
              </div>
              <p style={{ margin: "0.4rem 0 0 0", color: "#94a3b8", fontSize: "0.85rem" }}>
                {selectedJoin.tagline}
              </p>
            </div>

            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button
                type="button"
                onClick={handleCopySql}
                title="Copy SQL Query"
                style={{
                  background: "rgba(30, 41, 59, 0.6)",
                  border: "1px solid #334155",
                  color: "#94a3b8",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                }}
              >
                {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                <span>{copied ? "Copied!" : "Copy SQL"}</span>
              </button>

              {onOpenInSqlLab && (
                <button
                  type="button"
                  onClick={() => onOpenInSqlLab(selectedJoin.sql)}
                  title="Open Query in SQL Laboratory"
                  style={{
                    background: "rgba(30, 41, 59, 0.6)",
                    border: "1px solid #334155",
                    color: "#38bdf8",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                  }}
                >
                  <Terminal size={14} />
                  <span>SQL Lab</span>
                </button>
              )}
            </div>
          </div>

          {/* Relational Algebra Box */}
          <div
            style={{
              background: "#030c0a",
              border: "1px dashed #1a332d",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
              Relational Algebra:
            </span>
            <code style={{ fontSize: "0.95rem", color: "#34d399", fontFamily: "monospace", fontWeight: 600 }}>
              {selectedJoin.algebra}
            </code>
          </div>

          {/* SQL Query Box */}
          <div style={{ position: "relative" }}>
            <pre
              style={{
                margin: 0,
                background: "#030c0a",
                border: "1px solid #1a332d",
                borderRadius: "8px",
                padding: "1rem",
                color: "#e2e8f0",
                fontSize: "0.83rem",
                fontFamily: "monospace",
                lineHeight: 1.5,
                overflowX: "auto",
              }}
            >
              {selectedJoin.sql}
            </pre>
          </div>

          {/* Action Row */}
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => handleRunJoin(false)}
              disabled={executing}
              style={{
                background: "#047857",
                color: "#fff",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: executing ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Play size={15} fill="#fff" />
              {executing ? "Running Query…" : "Execute on PostgreSQL"}
            </button>

            <button
              type="button"
              onClick={() => handleRunJoin(true)}
              disabled={executing}
              style={{
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid #334155",
                color: "#94a3b8",
                padding: "8px 14px",
                borderRadius: "6px",
                fontSize: "0.85rem",
                fontWeight: 500,
                cursor: executing ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Sparkles size={14} color="#facc15" />
              <span>EXPLAIN Query Plan</span>
            </button>
          </div>
        </div>

        {/* Right Column: Visual Venn Diagram & Academic Context */}
        <div
          style={{
            background: "#081311",
            border: "1px solid #1a332d",
            borderRadius: "10px",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          {/* Visual Venn / Concept Card */}
          <div
            style={{
              background: "#030c0a",
              border: "1px solid #1a332d",
              borderRadius: "8px",
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, marginBottom: "0.75rem" }}>
              SET-THEORETIC VENN REPRESENTATION
            </div>
            <VennDiagramDisplay type={selectedJoin.vennType} color={selectedJoin.badgeColor} />
          </div>

          {/* Academic & Viva Explanation */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                DBMS Viva Principle:
              </span>
              <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.82rem", color: "#cbd5e1", lineHeight: 1.45 }}>
                {selectedJoin.academicPurpose}
              </p>
            </div>

            <div>
              <span style={{ fontSize: "0.72rem", color: "#34d399", textTransform: "uppercase", fontWeight: 700 }}>
                TERA Operational Application:
              </span>
              <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.82rem", color: "#cbd5e1", lineHeight: 1.45 }}>
                {selectedJoin.teraWorkflow}
              </p>
            </div>

            <div style={{ background: "rgba(30, 41, 59, 0.4)", borderRadius: "6px", padding: "0.6rem 0.8rem" }}>
              <span style={{ fontSize: "0.72rem", color: "#facc15", textTransform: "uppercase", fontWeight: 700 }}>
                PostgreSQL Optimizer Execution:
              </span>
              <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.78rem", color: "#94a3b8", fontFamily: "monospace" }}>
                {selectedJoin.optimizerStrategy}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Live Query Execution Results Viewport */}
      {execError && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "8px",
            padding: "1rem",
            color: "#f87171",
            fontSize: "0.88rem",
          }}
        >
          <strong>Execution Error:</strong> {execError}
        </div>
      )}

      {execResult && (
        <div
          style={{
            background: "#081311",
            border: "1px solid #1a332d",
            borderRadius: "10px",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ fontWeight: 600, color: "#f8fafc", fontSize: "0.95rem" }}>
                {showExplain ? "PostgreSQL Query Execution Plan (EXPLAIN)" : "Live Query Output Table"}
              </span>
              <span
                style={{
                  background: "#1e293b",
                  color: "#38bdf8",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontSize: "0.75rem",
                }}
              >
                {execResult.row_count} row{execResult.row_count === 1 ? "" : "s"} returned
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: "#94a3b8" }}>
              <Clock size={13} />
              <span>Execution Time: {execResult.duration_ms.toFixed(2)} ms</span>
            </div>
          </div>

          {execResult.columns && execResult.columns.length > 0 && (
            <div style={{ overflowX: "auto", border: "1px solid #1a332d", borderRadius: "8px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#030c0a", borderBottom: "1px solid #1a332d" }}>
                    {execResult.columns.map((col, idx) => (
                      <th
                        key={idx}
                        style={{
                          padding: "10px 12px",
                          color: "#34d399",
                          fontWeight: 600,
                          fontFamily: "monospace",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {execResult.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      style={{
                        borderBottom: "1px solid #10241f",
                        background: rIdx % 2 === 0 ? "transparent" : "rgba(3, 12, 10, 0.4)",
                      }}
                    >
                      {row.map((cell: any, cIdx: number) => (
                        <td
                          key={cIdx}
                          style={{
                            padding: "8px 12px",
                            color: cell === null ? "#64748b" : "#e2e8f0",
                            fontStyle: cell === null ? "italic" : "normal",
                            fontFamily: "monospace",
                            whiteSpace: "nowrap",
                            maxWidth: "280px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {cell === null ? "NULL" : typeof cell === "boolean" ? (cell ? "TRUE" : "FALSE") : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {execResult.rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={execResult.columns.length}
                        style={{
                          padding: "1.5rem",
                          textAlign: "center",
                          color: "#64748b",
                          fontStyle: "italic",
                        }}
                      >
                        Query executed successfully. 0 matching rows currently in database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VennDiagramDisplay({ type, color }: { type: string; color: string }) {
  const width = 200;
  const height = 120;

  switch (type) {
    case "inner":
      return (
        <svg width={width} height={height} viewBox="0 0 200 120">
          <circle cx="75" cy="60" r="45" fill="#1e293b" stroke="#475569" strokeWidth="2" opacity="0.6" />
          <circle cx="125" cy="60" r="45" fill="#1e293b" stroke="#475569" strokeWidth="2" opacity="0.6" />
          {/* Shaded intersection */}
          <path
            d="M 100 22 A 45 45 0 0 1 100 98 A 45 45 0 0 1 100 22 Z"
            fill={color}
            opacity="0.9"
          />
          <text x="50" y="65" fill="#94a3b8" fontSize="11" fontWeight="bold">R</text>
          <text x="145" y="65" fill="#94a3b8" fontSize="11" fontWeight="bold">S</text>
          <text x="92" y="65" fill="#ffffff" fontSize="10" fontWeight="bold">R ⋈ S</text>
        </svg>
      );

    case "left":
      return (
        <svg width={width} height={height} viewBox="0 0 200 120">
          <circle cx="75" cy="60" r="45" fill={color} opacity="0.8" stroke="#475569" strokeWidth="2" />
          <circle cx="125" cy="60" r="45" fill="#1e293b" stroke="#475569" strokeWidth="2" opacity="0.6" />
          <path
            d="M 100 22 A 45 45 0 0 1 100 98 A 45 45 0 0 1 100 22 Z"
            fill={color}
            opacity="0.95"
          />
          <text x="50" y="65" fill="#ffffff" fontSize="11" fontWeight="bold">R (ALL)</text>
          <text x="145" y="65" fill="#94a3b8" fontSize="11" fontWeight="bold">S</text>
        </svg>
      );

    case "right":
      return (
        <svg width={width} height={height} viewBox="0 0 200 120">
          <circle cx="75" cy="60" r="45" fill="#1e293b" stroke="#475569" strokeWidth="2" opacity="0.6" />
          <circle cx="125" cy="60" r="45" fill={color} opacity="0.8" stroke="#475569" strokeWidth="2" />
          <path
            d="M 100 22 A 45 45 0 0 1 100 98 A 45 45 0 0 1 100 22 Z"
            fill={color}
            opacity="0.95"
          />
          <text x="50" y="65" fill="#94a3b8" fontSize="11" fontWeight="bold">R</text>
          <text x="135" y="65" fill="#ffffff" fontSize="11" fontWeight="bold">S (ALL)</text>
        </svg>
      );

    case "full":
      return (
        <svg width={width} height={height} viewBox="0 0 200 120">
          <circle cx="75" cy="60" r="45" fill={color} opacity="0.75" stroke="#475569" strokeWidth="2" />
          <circle cx="125" cy="60" r="45" fill={color} opacity="0.75" stroke="#475569" strokeWidth="2" />
          <text x="45" y="65" fill="#ffffff" fontSize="10" fontWeight="bold">R (ALL)</text>
          <text x="130" y="65" fill="#ffffff" fontSize="10" fontWeight="bold">S (ALL)</text>
          <text x="90" y="65" fill="#ffffff" fontSize="9" fontWeight="bold">R ⟗ S</text>
        </svg>
      );

    case "anti":
      return (
        <svg width={width} height={height} viewBox="0 0 200 120">
          {/* Shaded Left Only */}
          <circle cx="75" cy="60" r="45" fill={color} opacity="0.85" stroke="#475569" strokeWidth="2" />
          <circle cx="125" cy="60" r="45" fill="#030c0a" stroke="#475569" strokeWidth="2" />
          <text x="45" y="65" fill="#ffffff" fontSize="10" fontWeight="bold">R ONLY</text>
          <text x="145" y="65" fill="#64748b" fontSize="11" fontWeight="bold">S</text>
          <text x="88" y="65" fill="#ef4444" fontSize="11" fontWeight="bold">∅</text>
        </svg>
      );

    case "semi":
      return (
        <svg width={width} height={height} viewBox="0 0 200 120">
          <circle cx="75" cy="60" r="45" fill="#1e293b" stroke="#475569" strokeWidth="2" opacity="0.6" />
          <circle cx="125" cy="60" r="45" fill="#1e293b" stroke="#475569" strokeWidth="2" opacity="0.6" />
          <path
            d="M 100 22 A 45 45 0 0 1 100 98 A 45 45 0 0 1 100 22 Z"
            fill={color}
            opacity="0.9"
          />
          <text x="45" y="65" fill="#38bdf8" fontSize="10" fontWeight="bold">R (kept)</text>
          <text x="145" y="65" fill="#64748b" fontSize="10" fontWeight="bold">S (tested)</text>
        </svg>
      );

    case "self":
      return (
        <svg width={width} height={height} viewBox="0 0 200 120">
          <circle cx="100" cy="60" r="45" fill="#1e293b" stroke={color} strokeWidth="2.5" opacity="0.8" />
          <path
            d="M 70 30 C 50 5 150 5 130 30"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeDasharray="4 3"
          />
          <polygon points="130,30 135,22 125,24" fill={color} />
          <text x="80" y="65" fill="#ffffff" fontSize="11" fontWeight="bold">R ⋈ R (alias)</text>
        </svg>
      );

    default:
      return (
        <svg width={width} height={height} viewBox="0 0 200 120">
          <circle cx="60" cy="60" r="35" fill={color} opacity="0.7" />
          <circle cx="100" cy="60" r="35" fill="#14b8a6" opacity="0.7" />
          <circle cx="140" cy="60" r="35" fill="#38bdf8" opacity="0.7" />
          <text x="80" y="110" fill="#94a3b8" fontSize="10" fontWeight="bold">R ⋈ S ⋈ T ⋈ U</text>
        </svg>
      );
  }
}
