import React, { useState } from "react";
import { TableNormalizationItem } from "../types";
import { CheckCircle2, AlertTriangle, ArrowRight, BookOpen, Layers } from "lucide-react";

interface NormalizationProps {
  normalizationTables: TableNormalizationItem[];
}

export function NormalizationSection({ normalizationTables }: NormalizationProps) {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [viewMode, setViewMode] = useState<"tutorial" | "tera_audit">("tutorial");

  const steps = [
    {
      nf: "UNF (Unnormalized Form)",
      title: "Unnormalized Table with Repeating Groups & Multivalued Attributes",
      description: "Data contains non-atomic attributes, composite structures, or varying sets of items per entity row.",
      relation: "STUDENT_REGISTRATION(student_id, student_name, {courses_taken: [course_id, course_name, instructor_id, instructor_name, grade]})",
      anomalies: [
        "Insertion Anomaly: Cannot register a new course unless at least one student enrolls.",
        "Deletion Anomaly: If student S1 is the only student in Course C1, deleting S1 destroys all knowledge of course C1.",
        "Update Anomaly: If an instructor changes their name, multiple records across the relation must be updated.",
      ],
      decomposition: "Identify non-atomic arrays; flatten rows so each cell holds exactly one atomic value.",
    },
    {
      nf: "1NF (First Normal Form)",
      title: "Eliminate Repeating Groups — All Attributes Must Be Atomic",
      description: "Each column contains only atomic (indivisible) values. There are no repeating groups, arrays, or nested records. A unique primary key exists.",
      relation: "STUDENT_COURSE(student_id, course_id, student_name, course_name, instructor_id, instructor_name, grade)\nPrimary Key: {student_id, course_id}",
      anomalies: [
        "Partial Dependency Exists: student_id → student_name (non-prime attribute depends on part of composite key!).",
        "Partial Dependency Exists: course_id → {course_name, instructor_id, instructor_name}.",
      ],
      decomposition: "Decompose by separating attributes that depend on proper subsets of the composite primary key into dedicated relations.",
    },
    {
      nf: "2NF (Second Normal Form)",
      title: "Eliminate Partial Functional Dependencies",
      description: "Relation is in 1NF and every non-prime attribute is fully functionally dependent on the entire primary key (no non-prime attribute depends on a proper subset of any candidate key).",
      relation: "STUDENT(student_id [PK], student_name)\nCOURSE(course_id [PK], course_name, instructor_id, instructor_name)\nENROLLMENT(student_id [PK], course_id [PK], grade)",
      anomalies: [
        "Transitive Dependency in COURSE: course_id → instructor_id AND instructor_id → instructor_name.",
        "If instructor I1 changes name, every course taught by I1 must be updated.",
      ],
      decomposition: "Isolate transitive dependencies into separate relations where the determinant becomes the primary key.",
    },
    {
      nf: "3NF (Third Normal Form)",
      title: "Eliminate Transitive Dependencies",
      description: "Relation is in 2NF and whenever a non-trivial functional dependency X → Y holds, either X is a superkey OR Y is a prime attribute.",
      relation: "STUDENT(student_id [PK], student_name)\nCOURSE(course_id [PK], course_name, instructor_id [FK])\nINSTRUCTOR(instructor_id [PK], instructor_name)\nENROLLMENT(student_id [PK], course_id [PK], grade)",
      anomalies: [
        "Insertion Anomaly Resolved: Can add an instructor before they teach any course.",
        "Deletion Anomaly Resolved: Deleting a course does not delete the instructor record.",
        "Update Anomaly Resolved: Instructor name exists in exactly one place.",
      ],
      decomposition: "Decomposed into 4 clean relations. Ensures lossless join and preserves all functional dependencies.",
    },
    {
      nf: "BCNF (Boyce-Codd Normal Form)",
      title: "Strict Normal Form — Every Determinant Must Be a Superkey",
      description: "For every non-trivial functional dependency X → Y, X must be a superkey. Eliminates subtle anomalies where a candidate key attribute depends on a non-key determinant.",
      relation: "All 4 relations satisfy BCNF. In TERA, all operational entities (incidents, users, missions, capacities) satisfy BCNF with synthetic UUID candidate keys.",
      anomalies: ["All functional dependencies in BCNF relations are direct key lookups. Zero redundancy."],
      decomposition: "Fully normalized relational model.",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header & Mode Switch */}
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
            Normalization & Dependency Analyzer
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.88rem" }}>
            Step-by-step reduction from UNF to BCNF, anomaly resolution, lossless join verification, and live normalization audit of TERA relations.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => setViewMode("tutorial")}
            style={{
              background: viewMode === "tutorial" ? "#047857" : "#081311",
              color: "#fff",
              border: "1px solid #1a332d",
              padding: "6px 12px",
              borderRadius: "5px",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Step-by-Step Laboratory
          </button>
          <button
            type="button"
            onClick={() => setViewMode("tera_audit")}
            style={{
              background: viewMode === "tera_audit" ? "#047857" : "#081311",
              color: "#fff",
              border: "1px solid #1a332d",
              padding: "6px 12px",
              borderRadius: "5px",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            TERA Live Relations Audit ({normalizationTables.length})
          </button>
        </div>
      </div>

      {viewMode === "tutorial" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Stepper Buttons */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {steps.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveStep(idx)}
                style={{
                  background: activeStep === idx ? "#047857" : "#0d1b18",
                  color: activeStep === idx ? "#ffffff" : "#94a3b8",
                  border: "1px solid " + (activeStep === idx ? "#10b981" : "#1a332d"),
                  padding: "8px 14px",
                  borderRadius: "6px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <span>Step {idx + 1}:</span>
                <span>{s.nf}</span>
              </button>
            ))}
          </div>

          {/* Active Step Card */}
          <div
            style={{
              background: "#0d1b18",
              border: "1px solid #1a332d",
              borderRadius: "10px",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ background: "#065f46", color: "#6ee7b7", padding: "3px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 700 }}>
                {steps[activeStep].nf}
              </span>
              <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "1.2rem" }}>
                {steps[activeStep].title}
              </h3>
            </div>

            <p style={{ margin: 0, color: "#cbd5e1", fontSize: "0.9rem", lineHeight: "1.5" }}>
              {steps[activeStep].description}
            </p>

            {/* Relation signature box */}
            <div style={{ background: "#081311", border: "1px solid #142823", borderRadius: "6px", padding: "1rem" }}>
              <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, marginBottom: "0.4rem" }}>
                RELATION SCHEMA STATE:
              </div>
              <pre style={{ margin: 0, color: "#38bdf8", fontFamily: "monospace", fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>
                {steps[activeStep].relation}
              </pre>
            </div>

            {/* Anomalies Box */}
            <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: "6px", padding: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#fca5a5", fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.4rem" }}>
                <AlertTriangle size={15} />
                <span>Anomalies & Functional Dependencies:</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#e2e8f0", fontSize: "0.82rem", lineHeight: "1.6" }}>
                {steps[activeStep].anomalies.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>

            {/* Decomposition Principle */}
            <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "6px", padding: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#6ee7b7", fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.4rem" }}>
                <CheckCircle2 size={15} />
                <span>Decomposition Strategy (Lossless & Dependency Preserving):</span>
              </div>
              <p style={{ margin: 0, color: "#cbd5e1", fontSize: "0.85rem" }}>
                {steps[activeStep].decomposition}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* TERA Live Relations Audit View */
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {normalizationTables.map((t) => (
            <div
              key={t.table_name}
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <strong style={{ color: "#38bdf8", fontSize: "1rem" }}>
                    {t.table_name}
                  </strong>
                  <span style={{ background: "#065f46", color: "#34d399", padding: "2px 6px", borderRadius: "3px", fontSize: "0.72rem", fontWeight: 700 }}>
                    {t.highest_normal_form}
                  </span>
                </div>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  Primary Key: <code>{t.primary_key.join(", ") || "None"}</code>
                </span>
              </div>

              <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                <strong>Functional Dependencies Established:</strong>
                <ul style={{ margin: "4px 0 0", paddingLeft: "1.25rem", color: "#cbd5e1" }}>
                  {t.functional_dependencies.map((fd, i) => (
                    <li key={i}>
                      <code>{"{" + fd.lhs.join(", ") + "} → {" + fd.rhs.slice(0, 4).join(", ") + (fd.rhs.length > 4 ? "…" : "") + "}"}</code>
                      <span style={{ color: "#64748b", marginLeft: "6px" }}>({fd.basis})</span>
                    </li>
                  ))}
                  {t.functional_dependencies.length === 0 && <li>No functional dependencies detected.</li>}
                </ul>
              </div>

              <div style={{ fontSize: "0.78rem", color: "#34d399", background: "rgba(15, 23, 42, 0.4)", padding: "0.5rem", borderRadius: "4px" }}>
                <strong>Audit Finding:</strong> {t.justification}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
