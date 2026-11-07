import React, { useState } from "react";
import { TableMetadata } from "../types";
import { Network, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";

interface RelationshipsProps {
  tables: TableMetadata[];
  onSelectTable: (tableName: string) => void;
}

export function RelationshipsSection({ tables, onSelectTable }: RelationshipsProps) {
  const [filterAction, setFilterAction] = useState("all");

  const actionRules = [
    {
      action: "CASCADE",
      desc: "Automatically deletes or updates referencing child rows when the parent row is deleted or modified.",
      teraExample: "voice_recordings → transcripts, incidents → reports",
    },
    {
      action: "RESTRICT",
      desc: "Prevents deletion or modification of a parent row if any referencing child row exists.",
      teraExample: "ambulances → missions (active fleet units cannot be deleted while assigned)",
    },
    {
      action: "SET NULL",
      desc: "Sets foreign key columns in referencing child rows to NULL when the referenced row is deleted.",
      teraExample: "incidents.duplicate_of (clears duplicate pointer if target is purged)",
    },
    {
      action: "NO ACTION",
      desc: "Default SQL standard check: raises an error if referenced row is deleted at transaction commit.",
      teraExample: "roles → memberships",
    },
  ];

  // Flatten all foreign keys across tables
  const allRelationships: Array<{
    sourceTable: string;
    targetTable: string;
    sourceColumns: string[];
    targetColumns: string[];
    constraintName: string;
    onDelete: string;
  }> = [];

  tables.forEach((t) => {
    t.foreign_keys.forEach((fk) => {
      allRelationships.push({
        sourceTable: t.name,
        targetTable: fk.referred_table,
        sourceColumns: fk.constrained_columns,
        targetColumns: fk.referred_columns,
        constraintName: fk.name || "Anonymous",
        onDelete: fk.options?.ondelete?.toUpperCase() || "NO ACTION",
      });
    });
  });

  const filtered = allRelationships.filter((r) =>
    filterAction === "all" ? true : r.onDelete.includes(filterAction),
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
            Database Relationships & Referential Integrity
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.88rem" }}>
            Foreign key constraints, parent-child hierarchies, and cascading deletion semantics.
          </p>
        </div>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          style={{
            padding: "6px 10px",
            background: "#081311",
            border: "1px solid #1a332d",
            borderRadius: "5px",
            color: "#f8fafc",
            fontSize: "0.8rem",
          }}
        >
          <option value="all">All Referential Actions</option>
          <option value="CASCADE">CASCADE</option>
          <option value="RESTRICT">RESTRICT</option>
          <option value="SET NULL">SET NULL</option>
          <option value="NO ACTION">NO ACTION</option>
        </select>
      </div>

      {/* Rules Explanations */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
        {actionRules.map((r) => (
          <div
            key={r.action}
            style={{
              background: "#0d1b18",
              border: "1px solid #1a332d",
              borderRadius: "8px",
              padding: "1rem",
            }}
          >
            <strong style={{ color: "#34d399", fontSize: "0.95rem" }}>ON DELETE {r.action}</strong>
            <p style={{ margin: "0.4rem 0", color: "#cbd5e1", fontSize: "0.8rem", lineHeight: "1.4" }}>
              {r.desc}
            </p>
            <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
              Usage: <code>{r.teraExample}</code>
            </div>
          </div>
        ))}
      </div>

      {/* Relationships Table */}
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
        <strong style={{ color: "#f8fafc", fontSize: "0.95rem" }}>
          Active Foreign Key Links ({filtered.length})
        </strong>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e293b", textAlign: "left", color: "#64748b" }}>
                <th style={{ padding: "8px 6px" }}>REFERENCING TABLE (CHILD)</th>
                <th style={{ padding: "8px 6px" }}>FK COLUMN</th>
                <th style={{ padding: "8px 6px" }}>TARGET TABLE (PARENT)</th>
                <th style={{ padding: "8px 6px" }}>PK COLUMN</th>
                <th style={{ padding: "8px 6px" }}>ON DELETE ACTION</th>
                <th style={{ padding: "8px 6px" }}>CONSTRAINT NAME</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rel, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #12221e", color: "#e2e8f0" }}>
                  <td style={{ padding: "8px 6px", fontWeight: 600 }}>
                    <button
                      type="button"
                      onClick={() => onSelectTable(rel.sourceTable)}
                      style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", padding: 0, fontWeight: 600 }}
                    >
                      {rel.sourceTable}
                    </button>
                  </td>
                  <td style={{ padding: "8px 6px", fontFamily: "monospace", color: "#facc15" }}>
                    {rel.sourceColumns.join(", ")}
                  </td>
                  <td style={{ padding: "8px 6px", fontWeight: 600 }}>
                    <button
                      type="button"
                      onClick={() => onSelectTable(rel.targetTable)}
                      style={{ background: "none", border: "none", color: "#34d399", cursor: "pointer", padding: 0, fontWeight: 600 }}
                    >
                      {rel.targetTable}
                    </button>
                  </td>
                  <td style={{ padding: "8px 6px", fontFamily: "monospace", color: "#94a3b8" }}>
                    {rel.targetColumns.join(", ")}
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    <span
                      style={{
                        background: rel.onDelete === "CASCADE" ? "rgba(239, 68, 68, 0.2)" : "rgba(15, 23, 42, 0.6)",
                        color: rel.onDelete === "CASCADE" ? "#f87171" : "#e2e8f0",
                        padding: "2px 6px",
                        borderRadius: "3px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                      }}
                    >
                      {rel.onDelete}
                    </span>
                  </td>
                  <td style={{ padding: "8px 6px", color: "#64748b", fontSize: "0.74rem" }}>
                    {rel.constraintName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

