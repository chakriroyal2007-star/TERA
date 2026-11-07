import React, { useState } from "react";
import { RelationalSchemaItem } from "../types";
import { Copy, Check, FileCode, Search, Database } from "lucide-react";

interface RelationalSchemaProps {
  relationalSchema: RelationalSchemaItem[];
  onSelectTable: (tableName: string) => void;
}

export function RelationalSchemaSection({
  relationalSchema,
  onSelectTable,
}: RelationalSchemaProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const filtered = relationalSchema.filter((r) =>
    r.table_name.toLowerCase().includes(search.toLowerCase()),
  );

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAll = () => {
    const fullText = relationalSchema.map((r) => r.formal_notation).join("\n\n");
    navigator.clipboard.writeText(fullText);
    setCopiedIndex(-1);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header & Actions */}
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
            Relational Schema Signatures
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.88rem" }}>
            Formal relational model definitions, attribute designations, candidate keys, and referential join constraints.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search relations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
          <button
            type="button"
            onClick={copyAll}
            style={{
              background: "#047857",
              color: "#fff",
              border: "none",
              padding: "6px 12px",
              borderRadius: "5px",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            {copiedIndex === -1 ? <Check size={14} /> : <Copy size={14} />}
            <span>Copy All Relations</span>
          </button>
        </div>
      </div>

      {/* Relations Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {filtered.map((rel, idx) => (
          <div
            key={rel.table_name}
            style={{
              background: "#0d1b18",
              border: "1px solid #1a332d",
              borderRadius: "8px",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <strong style={{ color: "#38bdf8", fontSize: "1rem" }}>
                  {rel.table_name.toUpperCase()}
                </strong>
                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                  ({rel.attributes.length} attributes)
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => copyToClipboard(rel.formal_notation, idx)}
                  style={{
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid #334155",
                    color: "#94a3b8",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  {copiedIndex === idx ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                  <span>Copy</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTable(rel.table_name)}
                  style={{
                    background: "rgba(4, 120, 87, 0.2)",
                    border: "1px solid #047857",
                    color: "#34d399",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  Inspect Relation
                </button>
              </div>
            </div>

            {/* Formal notation codeblock */}
            <div
              style={{
                background: "#081311",
                border: "1px solid #142823",
                borderRadius: "6px",
                padding: "0.75rem",
                fontFamily: "monospace",
                fontSize: "0.82rem",
                color: "#e2e8f0",
                wordBreak: "break-all",
                lineHeight: "1.6",
              }}
            >
              <span style={{ color: "#38bdf8", fontWeight: 700 }}>{rel.table_name.toUpperCase()}</span>(
              {rel.attributes.map((a, aIdx) => (
                <span key={a.name}>
                  <span
                    style={{
                      color: a.is_pk ? "#facc15" : a.is_fk ? "#f43f5e" : "#cbd5e1",
                      fontWeight: a.is_pk ? 700 : 500,
                      textDecoration: a.is_pk ? "underline" : "none",
                    }}
                  >
                    {a.name}
                  </span>
                  {a.markers.length > 0 && (
                    <span style={{ color: "#64748b", fontSize: "0.75rem" }}>
                      {" "}[{a.markers.join(" ")}]
                    </span>
                  )}
                  {aIdx < rel.attributes.length - 1 && ", "}
                </span>
              ))}
              )
            </div>

            {/* Foreign Key SQL Join Conditions */}
            {rel.foreign_keys.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.75rem" }}>
                <span style={{ color: "#94a3b8", fontWeight: 600 }}>SQL Relational Join Predicates:</span>
                {rel.foreign_keys.map((fk, fIdx) => (
                  <div
                    key={fIdx}
                    style={{
                      fontFamily: "monospace",
                      color: "#34d399",
                      background: "rgba(15, 23, 42, 0.4)",
                      padding: "3px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    JOIN {fk.target_table} ON {fk.sql_join_condition}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
