import React, { useState } from "react";
import { Zap, ShieldCheck, Database, ArrowRight, Layers } from "lucide-react";

interface IndexingProps {
  indexes: Array<{
    table_name: string;
    index_name: string;
    column_names: string[];
    is_unique: boolean;
  }>;
}

export function IndexingSection({ indexes }: IndexingProps) {
  const [filter, setFilter] = useState("");

  const indexTypes = [
    {
      name: "B-Tree (Default)",
      desc: "Balanced search tree optimized for equality (=) and range queries (<, <=, >, >=, BETWEEN). Default index structure for all TERA primary keys and foreign keys.",
      teraUse: "users.email, incidents.case_id, missions.incident_id",
      cost: "O(log N) lookup, insertion, and deletion overhead.",
    },
    {
      name: "Partial Index",
      desc: "An index built over a subset of a table defined by a conditional WHERE clause, minimizing index size and write overhead.",
      teraUse: "Missions index on active non-completed missions only.",
      cost: "Zero index maintenance for historical completed missions.",
    },
    {
      name: "Composite Index",
      desc: "An index defined across two or more columns together. Effective when queries filter or sort by the leading columns.",
      teraUse: "capacities: (department_id, kind)",
      cost: "Supports queries filtering on (department_id) or (department_id, kind).",
    },
    {
      name: "GIN (Generalized Inverted Index)",
      desc: "Designed for values that contain multiple elements (JSONB, full-text search tsvector, arrays).",
      teraUse: "incident_extractions.extracted_json (JSONB extraction facts).",
      cost: "Slightly higher write overhead; ultra-fast key-value searching.",
    },
  ];

  const filtered = indexes.filter(
    (idx) =>
      idx.table_name.toLowerCase().includes(filter.toLowerCase()) ||
      idx.index_name.toLowerCase().includes(filter.toLowerCase()),
  );

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
            Indexing & Query Performance Optimization
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.88rem" }}>
            B-Tree, Partial, Composite, and GIN indexes deployed across TERA relations to guarantee low-latency emergency triage queries.
          </p>
        </div>
        <input
          type="text"
          placeholder="Filter indexes..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: "6px 10px",
            background: "#081311",
            border: "1px solid #1a332d",
            borderRadius: "5px",
            color: "#f8fafc",
            fontSize: "0.8rem",
            width: "180px",
          }}
        />
      </div>

      {/* Index Archetypes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>
        {indexTypes.map((it) => (
          <div
            key={it.name}
            style={{
              background: "#0d1b18",
              border: "1px solid #1a332d",
              borderRadius: "8px",
              padding: "1.1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <strong style={{ color: "#38bdf8", fontSize: "0.95rem" }}>{it.name}</strong>
            <p style={{ margin: 0, color: "#cbd5e1", fontSize: "0.8rem", lineHeight: "1.4" }}>
              {it.desc}
            </p>
            <div style={{ background: "#081311", padding: "4px 8px", borderRadius: "4px", fontSize: "0.74rem", color: "#34d399" }}>
              TERA: <code>{it.teraUse}</code>
            </div>
            <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
              Cost Profile: {it.cost}
            </div>
          </div>
        ))}
      </div>

      {/* Real Indexes Catalog */}
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
          <strong style={{ color: "#f8fafc", fontSize: "0.95rem" }}>
            Active Database Indexes ({filtered.length})
          </strong>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
            Inspected from PostgreSQL pg_indexes
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "0.75rem" }}>
          {filtered.map((idx, i) => (
            <div
              key={i}
              style={{
                background: "rgba(15, 23, 42, 0.4)",
                border: "1px solid #1e293b",
                borderRadius: "6px",
                padding: "0.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.3rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#38bdf8", fontWeight: 700, fontSize: "0.82rem" }}>
                  {idx.index_name}
                </span>
                {idx.is_unique && (
                  <span style={{ background: "#854d0e", color: "#fef08a", padding: "1px 5px", borderRadius: "3px", fontSize: "0.68rem", fontWeight: 700 }}>
                    UNIQUE
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.78rem", color: "#cbd5e1" }}>
                Table: <code>{idx.table_name}</code>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                Indexed Columns: <code>{idx.column_names.join(", ")}</code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
