import React, { useState } from "react";
import { api } from "../../api";
import { SqlExecutionResult } from "../types";
import { Play, Clock, Database, FileText, AlertCircle, CheckCircle2 } from "lucide-react";

interface SqlLabSectionProps {
  initialQuery?: string;
}

export function SqlLabSection({ initialQuery }: SqlLabSectionProps = {}) {
  const [query, setQuery] = useState(
    initialQuery ||
    "SELECT id, case_id, category, priority, status, created_at FROM incidents ORDER BY created_at DESC LIMIT 10;",
  );

  React.useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);
  const [limit, setLimit] = useState(50);
  const [result, setResult] = useState<SqlExecutionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExplain, setShowExplain] = useState(false);

  const sampleQueries = [
    {
      category: "DQL: Emergency Queue",
      title: "Active high priority incidents with case IDs",
      sql: "SELECT id, case_id, category, priority, status, address FROM incidents WHERE status IN ('reported', 'verified') ORDER BY created_at DESC LIMIT 10;",
    },
    {
      category: "Joins: Incident & Voice Transcripts",
      title: "Left join incidents with transcribed voice statements",
      sql: `SELECT i.case_id, i.category, v.duration, t.detected_language, t.original_transcript
FROM incidents i
LEFT JOIN voice_recordings v ON v.incident_id = i.id
LEFT JOIN transcripts t ON t.recording_id = v.id
LIMIT 10;`,
    },
    {
      category: "Joins: INNER JOIN (Equi-Join)",
      title: "Inner join active incidents with dispatched missions",
      sql: `SELECT i.case_id, i.category, i.priority, m.status AS mission_status, m.created_at AS dispatched_at
FROM incidents i
INNER JOIN missions m ON m.incident_id = i.id
ORDER BY m.created_at DESC
LIMIT 10;`,
    },
    {
      category: "Joins: RIGHT OUTER JOIN",
      title: "Right join all fleet ambulances whether on mission or idle",
      sql: `SELECT a.registration, a.active AS ambulance_active, m.id AS mission_id, m.status AS mission_status
FROM missions m
RIGHT OUTER JOIN ambulances a ON m.ambulance_id = a.id
ORDER BY a.registration
LIMIT 10;`,
    },
    {
      category: "Joins: FULL OUTER JOIN",
      title: "Full outer join incidents and ambulances by agency",
      sql: `SELECT i.case_id, i.category, a.registration, a.active AS ambulance_active
FROM incidents i
FULL OUTER JOIN ambulances a ON i.organization_id = a.organization_id
LIMIT 15;`,
    },
    {
      category: "Joins: CROSS JOIN (Cartesian Product)",
      title: "Cartesian product of all hospitals paired with incident categories",
      sql: `SELECT h.name AS hospital_name, cat.category AS emergency_category
FROM hospitals h
CROSS JOIN (SELECT DISTINCT category FROM incidents LIMIT 5) cat
ORDER BY h.name
LIMIT 15;`,
    },
    {
      category: "Joins: SELF JOIN (Duplicate Discovery)",
      title: "Self join incidents on same category for cluster detection",
      sql: `SELECT i1.case_id AS incident_alpha, i2.case_id AS incident_beta, i1.category, i1.status AS status_alpha
FROM incidents i1
JOIN incidents i2 ON i1.category = i2.category AND i1.id <> i2.id
LIMIT 10;`,
    },
    {
      category: "Joins: 4-Way Multi-Table Dispatch Manifest",
      title: "Incidents ⋈ Missions ⋈ Ambulances ⋈ Responders",
      sql: `SELECT i.case_id, i.category, m.status AS mission_status, a.registration AS ambulance_plate, u.name AS responder_name
FROM incidents i
JOIN missions m ON m.incident_id = i.id
JOIN ambulances a ON a.id = m.ambulance_id
JOIN users u ON u.id = m.responder_id
ORDER BY m.created_at DESC
LIMIT 10;`,
    },
    {
      category: "Joins: ANTI-JOIN (Available Resources)",
      title: "Ambulances with NO active dispatch missions (NOT EXISTS)",
      sql: `SELECT a.id, a.registration, a.active
FROM ambulances a
WHERE NOT EXISTS (
  SELECT 1 FROM missions m WHERE m.ambulance_id = a.id AND m.status != 'completed'
)
LIMIT 10;`,
    },
    {
      category: "Joins: SEMI-JOIN (Correlated Membership)",
      title: "Incidents that have voice audio attached (EXISTS)",
      sql: `SELECT i.case_id, i.category, i.priority, i.address
FROM incidents i
WHERE EXISTS (
  SELECT 1 FROM voice_recordings v WHERE v.incident_id = i.id
)
LIMIT 10;`,
    },
    {
      category: "Aggregates: Category Breakdown",
      title: "Count of incidents and average casualties grouped by category",
      sql: `SELECT category, count(*) AS total_incidents, avg(coalesce(casualties_count, 0)) AS avg_casualties
FROM incidents
GROUP BY category
ORDER BY total_incidents DESC;`,
    },
    {
      category: "Hospital: Department Bed Capacities",
      title: "Hospitals joined with ICU & Emergency bed availability",
      sql: `SELECT h.name AS hospital_name, d.name AS department, c.kind, c.total, c.occupied, c.reserved, (c.total - c.occupied - c.reserved) AS available_beds
FROM hospitals h
JOIN departments d ON d.hospital_id = h.id
JOIN capacities c ON c.department_id = d.id
ORDER BY available_beds DESC;`,
    },
    {
      category: "Advanced: Window Functions",
      title: "Rank incidents within each category by priority",
      sql: `SELECT case_id, category, priority, created_at,
       ROW_NUMBER() OVER (PARTITION BY category ORDER BY created_at DESC) AS recency_rank
FROM incidents
LIMIT 20;`,
    },
    {
      category: "Advanced: CTE (Common Table Expression)",
      title: "CTE analyzing field mission dispatch times",
      sql: `WITH mission_summary AS (
  SELECT m.id, m.incident_id, m.status, a.registration, m.created_at
  FROM missions m
  JOIN ambulances a ON a.id = m.ambulance_id
)
SELECT * FROM mission_summary LIMIT 10;`,
    },
  ];

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<SqlExecutionResult>("/dbms/sql/execute", "POST", {
        query,
        limit,
      });
      setResult(res);
    } catch (err: any) {
      setError(err?.message || "SQL Execution failed.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header */}
      <div
        style={{
          background: "#0d1b18",
          border: "1px solid #1a332d",
          borderRadius: "10px",
          padding: "1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 0.25rem 0", color: "#f8fafc", fontSize: "1.3rem" }}>
            Interactive SQL Laboratory & Query Engine
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.88rem" }}>
            Execute safe read-only SQL queries, inspect query plans (EXPLAIN), and evaluate joins across live emergency records.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>LIMIT:</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{
              padding: "5px 8px",
              background: "#081311",
              border: "1px solid #1a332d",
              borderRadius: "4px",
              color: "#f8fafc",
              fontSize: "0.8rem",
            }}
          >
            <option value={10}>10 rows</option>
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>
        </div>
      </div>

      {/* Editor & Sample Queries Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.25rem" }}>
        {/* Editor Box */}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "#38bdf8", fontWeight: 700 }}>
              SQL QUERY EDITOR (Read-Only Mode)
            </span>
            <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
              Strictly parameterized execution
            </span>
          </div>

          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={8}
            style={{
              width: "100%",
              padding: "10px",
              background: "#081311",
              border: "1px solid #1a332d",
              borderRadius: "6px",
              color: "#f8fafc",
              fontFamily: "monospace",
              fontSize: "0.88rem",
              lineHeight: "1.5",
              resize: "vertical",
            }}
          />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
              Destructive operations (DROP, ALTER, DELETE, INSERT, TRUNCATE) are automatically rejected.
            </span>
            <button
              type="button"
              disabled={loading}
              onClick={handleExecute}
              style={{
                background: "#047857",
                color: "#fff",
                border: "none",
                padding: "8px 18px",
                borderRadius: "6px",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Play size={15} />
              <span>{loading ? "Executing…" : "Execute SQL"}</span>
            </button>
          </div>
        </div>

        {/* Sample Queries Sidebar */}
        <div
          style={{
            background: "#0d1b18",
            border: "1px solid #1a332d",
            borderRadius: "10px",
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            maxHeight: "330px",
            overflowY: "auto",
          }}
        >
          <span style={{ fontSize: "0.78rem", color: "#34d399", fontWeight: 700 }}>
            Curated Query Templates:
          </span>
          {sampleQueries.map((sq, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setQuery(sq.sql)}
              style={{
                background: "rgba(15, 23, 42, 0.5)",
                border: "1px solid #1e293b",
                borderRadius: "6px",
                padding: "8px",
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <span style={{ fontSize: "0.7rem", color: "#38bdf8", fontWeight: 700 }}>{sq.category}</span>
              <span style={{ fontSize: "0.78rem", color: "#e2e8f0" }}>{sq.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid #ef4444",
            borderRadius: "8px",
            padding: "1rem",
            color: "#fca5a5",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <AlertCircle size={18} color="#ef4444" />
          <span>{error}</span>
        </div>
      )}

      {/* Execution Results View */}
      {result && (
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ color: "#34d399", fontSize: "0.85rem", fontWeight: 700 }}>
                Query Succeeded
              </span>
              <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                Rows returned: <strong style={{ color: "#38bdf8" }}>{result.row_count}</strong>
              </span>
              <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                Execution Time: <strong style={{ color: "#facc15" }}>{result.duration_ms} ms</strong>
              </span>
            </div>
            {result.explain_plan && (
              <button
                type="button"
                onClick={() => setShowExplain(!showExplain)}
                style={{
                  background: showExplain ? "#047857" : "#081311",
                  border: "1px solid #1a332d",
                  color: "#e2e8f0",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                {showExplain ? "Hide EXPLAIN Plan" : "View EXPLAIN Plan"}
              </button>
            )}
          </div>

          {/* Explain Plan */}
          {showExplain && result.explain_plan && (
            <div
              style={{
                background: "#081311",
                border: "1px solid #142823",
                borderRadius: "6px",
                padding: "0.75rem",
                fontFamily: "monospace",
                fontSize: "0.78rem",
                color: "#94a3b8",
                whiteSpace: "pre-wrap",
              }}
            >
              {result.explain_plan}
            </div>
          )}

          {/* Table Results */}
          <div style={{ overflowX: "auto", maxHeight: "400px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e293b", textAlign: "left", color: "#64748b" }}>
                  {result.columns.map((col) => (
                    <th key={col} style={{ padding: "8px 10px", background: "rgba(15, 23, 42, 0.4)" }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, rIdx) => (
                  <tr key={rIdx} style={{ borderBottom: "1px solid #12221e", color: "#e2e8f0" }}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} style={{ padding: "6px 10px", fontFamily: "monospace", maxWidth: "250px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                        {cell !== "NULL" ? cell : <span style={{ color: "#475569" }}>NULL</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

