import React, { useState } from "react";
import { TableMetadata } from "../types";
import { Key, ShieldCheck, CheckCircle2, Lock, ArrowRight, Layers } from "lucide-react";

interface KeysConstraintsProps {
  tables: TableMetadata[];
  onSelectTable: (tableName: string) => void;
}

export function KeysConstraintsSection({ tables, onSelectTable }: KeysConstraintsProps) {
  const [activeTab, setActiveTab] = useState<"keys" | "constraints" | "referential_map">("keys");

  const keysCatalog = [
    {
      title: "Primary Key (PK)",
      definition: "A minimal candidate key chosen to uniquely identify every tuple in a relation. Enforces entity integrity, strictly prohibits NULL values, and automatically creates a unique B-tree index.",
      teraExample: "incidents.id, users.id, hospitals.id (UUIDv4 surrogate primary keys).",
      sqlSyntax: "ALTER TABLE incidents ADD PRIMARY KEY (id);",
      benefit: "Provides immutable, O(1) row access and uniform foreign key target references across all 40+ relations.",
    },
    {
      title: "Candidate Key",
      definition: "A minimal superkey (no proper subset is a superkey) that has the uniqueness property. A relation may possess multiple candidate keys, from which one is designated the primary key.",
      teraExample: "users.email (Alternate candidate key alongside users.id), incidents.case_id (Format: TERA-2026-XXXXXX).",
      sqlSyntax: "ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);",
      benefit: "Guarantees domain uniqueness without exposing internal database surrogate identifiers to end users.",
    },
    {
      title: "Foreign Key (FK)",
      definition: "An attribute or set of attributes in a referencing relation whose values must match the primary key or candidate key of a referenced relation, enforcing referential integrity.",
      teraExample: "missions.ambulance_id → ambulances.id, missions.incident_id → incidents.id.",
      sqlSyntax: "ALTER TABLE missions ADD FOREIGN KEY (ambulance_id) REFERENCES ambulances (id) ON DELETE RESTRICT;",
      benefit: "Prevents orphaned records and enforces strict lifecycle dependency between operational dispatch and fleet units.",
    },
    {
      title: "Composite Key",
      definition: "A primary key or candidate key consisting of two or more attributes together to establish uniqueness.",
      teraExample: "capacities: {department_id, kind} (department ID combined with bed kind 'icu' or 'emergency').",
      sqlSyntax: "ALTER TABLE capacities ADD CONSTRAINT capacities_dept_kind_key UNIQUE (department_id, kind);",
      benefit: "Prevents duplicate capacity counters for the same department while avoiding unneeded synthetic surrogate keys.",
    },
    {
      title: "Surrogate Key vs Natural Key",
      definition: "A surrogate key is an artificial, system-generated identifier with no business meaning. A natural key has real-world semantic meaning (e.g., citizen national ID, vehicle registration).",
      teraExample: "Surrogate: incidents.id (UUID). Natural: ambulances.registration (e.g. AP-03-EM-108).",
      sqlSyntax: "registration VARCHAR(32) UNIQUE NOT NULL",
      benefit: "Surrogate keys isolate relational structures from real-world renumbering; natural keys allow human-auditable fleet coordination.",
    },
  ];

  const constraintsCatalog = [
    {
      name: "NOT NULL",
      purpose: "Ensures an attribute cannot contain a missing or undefined value.",
      teraExample: "incidents.category NOT NULL, users.password_hash NOT NULL",
      rule: "Rejects any INSERT or UPDATE attempting to leave critical fields blank.",
    },
    {
      name: "UNIQUE",
      purpose: "Enforces distinctness across all non-null values in one or more columns.",
      teraExample: "incidents.case_id UNIQUE, ambulances.registration UNIQUE",
      rule: "Prevents double-booking or duplicate case generation.",
    },
    {
      name: "CHECK Constraint",
      purpose: "Specifies a boolean predicate that every row must satisfy before commit.",
      teraExample: "capacities: CHECK (total >= 0 AND occupied >= 0 AND reserved >= 0 AND occupied + reserved <= total)",
      rule: "Mathematically enforces hospital bed occupancy bounds directly in the database engine.",
    },
    {
      name: "Referential Action (ON DELETE CASCADE / RESTRICT)",
      purpose: "Defines engine behavior when a parent row referenced by foreign keys is deleted.",
      teraExample: "transcripts ON DELETE CASCADE (deleting voice recording purges transcript); missions ON DELETE RESTRICT (active ambulance cannot be deleted).",
      rule: "Guarantees database consistency without orphaned records or accidental resource destruction.",
    },
  ];

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
            Keys, Constraints & Referential Integrity
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.88rem" }}>
            Superkeys, candidate keys, surrogate vs natural keys, integrity constraints, and referential dependencies.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {[
            { id: "keys", label: "Relational Keys" },
            { id: "constraints", label: "Integrity Constraints" },
            { id: "referential_map", label: "Referential Matrix" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: activeTab === tab.id ? "#047857" : "#081311",
                color: activeTab === tab.id ? "#fff" : "#94a3b8",
                border: "1px solid #1a332d",
                padding: "6px 12px",
                borderRadius: "5px",
                fontSize: "0.8rem",
                fontWeight: activeTab === tab.id ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Keys Tab */}
      {activeTab === "keys" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1rem" }}>
          {keysCatalog.map((k, idx) => (
            <div
              key={idx}
              style={{
                background: "#0d1b18",
                border: "1px solid #1a332d",
                borderRadius: "8px",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Key size={16} color="#facc15" />
                <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "1.05rem" }}>{k.title}</h3>
              </div>
              <p style={{ margin: 0, color: "#cbd5e1", fontSize: "0.85rem", lineHeight: "1.5" }}>
                {k.definition}
              </p>
              <div style={{ background: "#081311", border: "1px solid #142823", borderRadius: "5px", padding: "0.6rem" }}>
                <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700 }}>TERA APPLICATION USAGE:</div>
                <div style={{ color: "#34d399", fontSize: "0.8rem", fontWeight: 600 }}>{k.teraExample}</div>
              </div>
              <div style={{ background: "rgba(15, 23, 42, 0.4)", borderRadius: "4px", padding: "0.4rem 0.6rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#38bdf8" }}>
                {k.sqlSyntax}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Constraints Tab */}
      {activeTab === "constraints" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1rem" }}>
          {constraintsCatalog.map((c, idx) => (
            <div
              key={idx}
              style={{
                background: "#0d1b18",
                border: "1px solid #1a332d",
                borderRadius: "8px",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ShieldCheck size={16} color="#34d399" />
                <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "1.05rem" }}>{c.name}</h3>
              </div>
              <p style={{ margin: 0, color: "#cbd5e1", fontSize: "0.85rem", lineHeight: "1.5" }}>
                {c.purpose}
              </p>
              <div style={{ background: "#081311", border: "1px solid #142823", borderRadius: "5px", padding: "0.6rem" }}>
                <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700 }}>TERA SCHEMA RULE:</div>
                <div style={{ color: "#facc15", fontSize: "0.8rem", fontFamily: "monospace" }}>{c.teraExample}</div>
              </div>
              <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                {c.rule}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Referential Matrix Tab */}
      {activeTab === "referential_map" && (
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
          <p style={{ margin: "0 0 0.5rem", color: "#94a3b8", fontSize: "0.85rem" }}>
            Foreign key relational dependencies across primary emergency relations:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "0.75rem" }}>
            {tables
              .filter((t) => t.foreign_keys.length > 0)
              .map((t) => (
                <div
                  key={t.name}
                  style={{
                    background: "rgba(15, 23, 42, 0.4)",
                    border: "1px solid #1e293b",
                    borderRadius: "6px",
                    padding: "0.75rem",
                  }}
                >
                  <strong style={{ color: "#38bdf8", fontSize: "0.88rem" }}>{t.name}</strong>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginTop: "0.4rem" }}>
                    {t.foreign_keys.map((fk, idx) => (
                      <div key={idx} style={{ fontSize: "0.78rem", color: "#cbd5e1", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <code style={{ color: "#facc15" }}>{fk.constrained_columns.join(", ")}</code>
                        <ArrowRight size={12} color="#64748b" />
                        <button
                          type="button"
                          onClick={() => onSelectTable(fk.referred_table)}
                          style={{ background: "none", border: "none", color: "#34d399", padding: 0, cursor: "pointer", fontWeight: 700 }}
                        >
                          {fk.referred_table}.{fk.referred_columns.join(", ")}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

