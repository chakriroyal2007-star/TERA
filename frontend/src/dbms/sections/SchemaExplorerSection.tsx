import React, { useState } from "react";
import { TableMetadata } from "../types";
import {
  Table,
  Search,
  Key,
  ShieldAlert,
  Layers,
  ArrowRight,
  Database,
  Eye,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface SchemaExplorerProps {
  tables: TableMetadata[];
  selectedTableName: string;
  onSelectTable: (name: string) => void;
}

export function SchemaExplorerSection({
  tables,
  selectedTableName,
  onSelectTable,
}: SchemaExplorerProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"columns" | "constraints" | "indexes" | "references" | "sample">("columns");

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const currentTable =
    tables.find((t) => t.name === selectedTableName) || tables[0] || null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.25rem", minHeight: "650px" }}>
      {/* Left List Pane */}
      <div
        style={{
          background: "#0d1b18",
          border: "1px solid #1a332d",
          borderRadius: "10px",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <div style={{ position: "relative" }}>
          <Search size={15} color="#64748b" style={{ position: "absolute", left: "10px", top: "10px" }} />
          <input
            type="text"
            placeholder="Search tables..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 10px 7px 32px",
              background: "#081311",
              border: "1px solid #1a332d",
              borderRadius: "6px",
              color: "#f8fafc",
              fontSize: "0.82rem",
            }}
          />
        </div>

        <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
          {filteredTables.length} OF {tables.length} TABLES
        </div>

        <div
          style={{
            overflowY: "auto",
            maxHeight: "560px",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          {filteredTables.map((t) => {
            const isSelected = currentTable?.name === t.name;
            return (
              <button
                key={t.name}
                type="button"
                onClick={() => onSelectTable(t.name)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  background: isSelected ? "#047857" : "transparent",
                  color: isSelected ? "#ffffff" : "#cbd5e1",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "0.82rem",
                  transition: "background 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", overflow: "hidden" }}>
                  <Table size={14} color={isSelected ? "#fff" : "#34d399"} />
                  <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                    {t.name}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "0.7rem",
                    color: isSelected ? "#e2e8f0" : "#64748b",
                    fontWeight: 600,
                  }}
                >
                  {t.row_count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Details Pane */}
      {currentTable ? (
        <div
          style={{
            background: "#0d1b18",
            border: "1px solid #1a332d",
            borderRadius: "10px",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.78rem", color: "#34d399", fontWeight: 700, textTransform: "uppercase" }}>
                  TABLE INSPECTOR
                </span>
                <span style={{ color: "#64748b" }}>·</span>
                <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                  Estimated Rows: <strong style={{ color: "#38bdf8" }}>{currentTable.row_count}</strong>
                </span>
              </div>
              <h2 style={{ margin: "0.25rem 0", color: "#f8fafc", fontSize: "1.4rem" }}>
                {currentTable.name}
              </h2>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.88rem" }}>
                {currentTable.description}
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <span
                style={{
                  background: "rgba(14, 165, 233, 0.15)",
                  color: "#38bdf8",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
              >
                {currentTable.columns.length} Columns
              </span>
              <span
                style={{
                  background: "rgba(244, 63, 94, 0.15)",
                  color: "#f43f5e",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
              >
                {currentTable.foreign_keys.length} Foreign Keys
              </span>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid #1a332d", paddingBottom: "0.5rem" }}>
            {[
              { id: "columns", label: `Columns (${currentTable.columns.length})` },
              { id: "constraints", label: "Integrity Constraints" },
              { id: "indexes", label: `Indexes (${currentTable.indexes.length})` },
              { id: "references", label: `Dependents (${currentTable.referencing_tables.length})` },
              { id: "sample", label: "Live Sample Records" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  background: activeTab === tab.id ? "#047857" : "transparent",
                  color: activeTab === tab.id ? "#fff" : "#94a3b8",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  fontSize: "0.8rem",
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Columns Tab */}
          {activeTab === "columns" && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #1e293b", textAlign: "left", color: "#64748b" }}>
                    <th style={{ padding: "8px 6px" }}>COLUMN</th>
                    <th style={{ padding: "8px 6px" }}>DATA TYPE</th>
                    <th style={{ padding: "8px 6px" }}>KEY</th>
                    <th style={{ padding: "8px 6px" }}>NULLABLE</th>
                    <th style={{ padding: "8px 6px" }}>DEFAULT</th>
                    <th style={{ padding: "8px 6px" }}>FOREIGN KEY TARGET</th>
                  </tr>
                </thead>
                <tbody>
                  {currentTable.columns.map((col) => (
                    <tr key={col.name} style={{ borderBottom: "1px solid #12221e", color: "#e2e8f0" }}>
                      <td style={{ padding: "8px 6px", fontWeight: 600, color: col.is_primary_key ? "#facc15" : "#f8fafc" }}>
                        {col.name}
                      </td>
                      <td style={{ padding: "8px 6px", fontFamily: "monospace", color: "#38bdf8" }}>
                        {col.data_type}
                      </td>
                      <td style={{ padding: "8px 6px" }}>
                        {col.is_primary_key && (
                          <span style={{ background: "#854d0e", color: "#fef08a", padding: "2px 6px", borderRadius: "3px", fontSize: "0.7rem", fontWeight: 700 }}>
                            PK
                          </span>
                        )}
                        {col.is_foreign_key && (
                          <span style={{ background: "#9f1239", color: "#fecdd3", padding: "2px 6px", borderRadius: "3px", fontSize: "0.7rem", fontWeight: 700, marginLeft: "4px" }}>
                            FK
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "8px 6px" }}>
                        {col.nullable ? (
                          <span style={{ color: "#94a3b8" }}>YES</span>
                        ) : (
                          <span style={{ color: "#ef4444", fontWeight: 600 }}>NOT NULL</span>
                        )}
                      </td>
                      <td style={{ padding: "8px 6px", color: "#64748b", fontFamily: "monospace", fontSize: "0.75rem" }}>
                        {col.default || "—"}
                      </td>
                      <td style={{ padding: "8px 6px" }}>
                        {col.foreign_key_info ? (
                          <button
                            type="button"
                            onClick={() => onSelectTable(col.foreign_key_info!.referred_table)}
                            style={{
                              background: "rgba(15, 23, 42, 0.6)",
                              border: "1px solid #334155",
                              color: "#38bdf8",
                              borderRadius: "4px",
                              padding: "2px 6px",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.3rem",
                            }}
                          >
                            <span>{col.foreign_key_info.referred_table}.{col.foreign_key_info.referred_columns[0]}</span>
                            <ArrowRight size={11} />
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Constraints Tab */}
          {activeTab === "constraints" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <strong style={{ color: "#facc15", fontSize: "0.85rem" }}>Primary Key:</strong>
                <div style={{ marginTop: "0.25rem", color: "#e2e8f0", fontSize: "0.85rem" }}>
                  {currentTable.primary_key.columns.join(", ") || "No primary key declared"}
                </div>
              </div>

              <div>
                <strong style={{ color: "#f43f5e", fontSize: "0.85rem" }}>Foreign Keys ({currentTable.foreign_keys.length}):</strong>
                <div style={{ marginTop: "0.4rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {currentTable.foreign_keys.map((fk, idx) => (
                    <div key={idx} style={{ padding: "0.5rem 0.75rem", background: "rgba(15, 23, 42, 0.5)", borderRadius: "6px", border: "1px solid #1e293b", fontSize: "0.82rem" }}>
                      <span style={{ color: "#38bdf8" }}>{fk.constrained_columns.join(", ")}</span> →{" "}
                      <button
                        type="button"
                        onClick={() => onSelectTable(fk.referred_table)}
                        style={{ background: "none", border: "none", color: "#34d399", cursor: "pointer", fontWeight: 700, padding: 0 }}
                      >
                        {fk.referred_table} ({fk.referred_columns.join(", ")})
                      </button>
                      <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px" }}>
                        Constraint: {fk.name || "Anonymous"} | ON DELETE: {fk.options?.ondelete || "NO ACTION"}
                      </div>
                    </div>
                  ))}
                  {currentTable.foreign_keys.length === 0 && <span style={{ color: "#64748b", fontSize: "0.8rem" }}>No foreign keys defined.</span>}
                </div>
              </div>

              <div>
                <strong style={{ color: "#34d399", fontSize: "0.85rem" }}>Unique Constraints:</strong>
                <div style={{ marginTop: "0.4rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  {currentTable.unique_constraints.map((uc, idx) => (
                    <div key={idx} style={{ color: "#e2e8f0", fontSize: "0.82rem" }}>
                      • <strong>{uc.column_names.join(", ")}</strong> ({uc.name || "UNIQUE"})
                    </div>
                  ))}
                  {currentTable.unique_constraints.length === 0 && <span style={{ color: "#64748b", fontSize: "0.8rem" }}>No explicit unique constraints.</span>}
                </div>
              </div>

              <div>
                <strong style={{ color: "#a855f7", fontSize: "0.85rem" }}>Check Constraints:</strong>
                <div style={{ marginTop: "0.4rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  {currentTable.check_constraints.map((cc, idx) => (
                    <div key={idx} style={{ color: "#e2e8f0", fontSize: "0.8rem", fontFamily: "monospace" }}>
                      CHECK ({cc.sqltext})
                    </div>
                  ))}
                  {currentTable.check_constraints.length === 0 && <span style={{ color: "#64748b", fontSize: "0.8rem" }}>No check constraints.</span>}
                </div>
              </div>
            </div>
          )}

          {/* Indexes Tab */}
          {activeTab === "indexes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {currentTable.indexes.map((idx, i) => (
                <div key={i} style={{ padding: "0.6rem 0.8rem", background: "rgba(15, 23, 42, 0.4)", borderRadius: "6px", border: "1px solid #1e293b", fontSize: "0.82rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong style={{ color: "#38bdf8" }}>{idx.name}</strong>
                    {idx.unique && <span style={{ color: "#facc15", fontSize: "0.72rem", fontWeight: 700 }}>UNIQUE INDEX</span>}
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: "0.78rem", marginTop: "3px" }}>
                    Columns: <code>{idx.column_names.join(", ")}</code>
                  </div>
                </div>
              ))}
              {currentTable.indexes.length === 0 && <span style={{ color: "#64748b", fontSize: "0.8rem" }}>No auxiliary indexes.</span>}
            </div>
          )}

          {/* Referencing Tables Tab */}
          {activeTab === "references" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <p style={{ margin: "0 0 0.5rem", color: "#94a3b8", fontSize: "0.82rem" }}>
                Tables that maintain a Foreign Key relationship pointing to <code>{currentTable.name}</code>:
              </p>
              {currentTable.referencing_tables.map((ref, idx) => (
                <div key={idx} style={{ padding: "0.6rem 0.8rem", background: "rgba(15, 23, 42, 0.4)", borderRadius: "6px", border: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ color: "#34d399", fontSize: "0.85rem" }}>{ref.from_table}</strong>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      FK Column: <code>{ref.from_columns.join(", ")}</code> → Target: <code>{ref.to_columns.join(", ")}</code>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectTable(ref.from_table)}
                    style={{
                      background: "#047857",
                      color: "#fff",
                      border: "none",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                    }}
                  >
                    <span>Inspect</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              ))}
              {currentTable.referencing_tables.length === 0 && (
                <span style={{ color: "#64748b", fontSize: "0.8rem" }}>No dependent child tables referencing this relation.</span>
              )}
            </div>
          )}

          {/* Live Sample Records Tab */}
          {activeTab === "sample" && (
            <div style={{ overflowX: "auto" }}>
              {currentTable.sample_rows && currentTable.sample_rows.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1e293b", textAlign: "left", color: "#64748b" }}>
                      {Object.keys(currentTable.sample_rows[0]).map((k) => (
                        <th key={k} style={{ padding: "6px 8px" }}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentTable.sample_rows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #12221e", color: "#e2e8f0" }}>
                        {Object.values(row).map((v, cIdx) => (
                          <td key={cIdx} style={{ padding: "6px 8px", fontFamily: "monospace", maxWidth: "200px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {v !== null ? String(v) : <span style={{ color: "#475569" }}>NULL</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: "1.5rem", textAlign: "center", color: "#64748b" }}>
                  No sample records currently present in relation <code>{currentTable.name}</code>.
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

