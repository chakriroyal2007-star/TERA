import React, { useState } from "react";
import { api } from "../../api";
import { Play, RotateCcw, Plus, Trash2, CheckCircle2, ArrowRight } from "lucide-react";

export function FunctionalDependencySection() {
  const [attributesStr, setAttributesStr] = useState("A, B, C, D");
  const [fds, setFds] = useState<Array<{ lhs: string; rhs: string }>>([
    { lhs: "A", rhs: "B" },
    { lhs: "B", rhs: "C" },
    { lhs: "A, C", rhs: "D" },
  ]);

  const [testClosureAttrs, setTestClosureAttrs] = useState("A");
  const [closureResult, setClosureResult] = useState<any | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFd = () => setFds([...fds, { lhs: "", rhs: "" }]);
  const removeFd = (index: number) => setFds(fds.filter((_, i) => i !== index));
  const updateFd = (index: number, field: "lhs" | "rhs", value: string) => {
    const updated = [...fds];
    updated[index][field] = value;
    setFds(updated);
  };

  const parseAttrs = (str: string) =>
    str.split(",").map((s) => s.trim()).filter(Boolean);

  const handleComputeClosure = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        attributes: parseAttrs(testClosureAttrs),
        fds: fds.map((f) => ({
          lhs: parseAttrs(f.lhs),
          rhs: parseAttrs(f.rhs),
        })),
      };
      const res = await api<any>("/dbms/fd/closure", "POST", payload);
      setClosureResult(res);
    } catch (err: any) {
      setError(err?.message || "Failed to calculate attribute closure");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeFds = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        attributes: parseAttrs(attributesStr),
        fds: fds.map((f) => ({
          lhs: parseAttrs(f.lhs),
          rhs: parseAttrs(f.rhs),
        })),
      };
      const res = await api<any>("/dbms/fd/analyze", "POST", payload);
      setAnalysisResult(res);
    } catch (err: any) {
      setError(err?.message || "Failed to analyze dependencies");
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (presetName: string) => {
    if (presetName === "classic") {
      setAttributesStr("A, B, C, D");
      setFds([
        { lhs: "A", rhs: "B" },
        { lhs: "B", rhs: "C" },
        { lhs: "A, C", rhs: "D" },
      ]);
      setTestClosureAttrs("A");
    } else if (presetName === "incident") {
      setAttributesStr("id, case_id, category, priority, status, address");
      setFds([
        { lhs: "id", rhs: "case_id, category, priority, status, address" },
        { lhs: "case_id", rhs: "id, category, priority, status, address" },
      ]);
      setTestClosureAttrs("case_id");
    } else if (presetName === "capacity") {
      setAttributesStr("dept_id, kind, total, occupied, reserved");
      setFds([
        { lhs: "dept_id, kind", rhs: "total, occupied, reserved" },
      ]);
      setTestClosureAttrs("dept_id, kind");
    }
    setClosureResult(null);
    setAnalysisResult(null);
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
            Functional Dependency & Closure Laboratory
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.88rem" }}>
            Compute attribute closure X⁺, candidate key lattice search, and minimal cover generation using sound relational algorithms.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>PRESETS:</span>
          <button
            type="button"
            onClick={() => applyPreset("classic")}
            style={{ background: "#081311", border: "1px solid #1a332d", color: "#38bdf8", padding: "4px 8px", borderRadius: "4px", fontSize: "0.75rem", cursor: "pointer" }}
          >
            Classic R(A,B,C,D)
          </button>
          <button
            type="button"
            onClick={() => applyPreset("incident")}
            style={{ background: "#081311", border: "1px solid #1a332d", color: "#34d399", padding: "4px 8px", borderRadius: "4px", fontSize: "0.75rem", cursor: "pointer" }}
          >
            TERA Incident
          </button>
          <button
            type="button"
            onClick={() => applyPreset("capacity")}
            style={{ background: "#081311", border: "1px solid #1a332d", color: "#facc15", padding: "4px 8px", borderRadius: "4px", fontSize: "0.75rem", cursor: "pointer" }}
          >
            Hospital Capacity
          </button>
        </div>
      </div>

      {/* Editor Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        {/* Left: Input Relation & FDs */}
        <div
          style={{
            background: "#0d1b18",
            border: "1px solid #1a332d",
            borderRadius: "10px",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div>
            <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", fontWeight: 600, marginBottom: "0.4rem" }}>
              Relation Attributes (Comma-separated)
            </label>
            <input
              type="text"
              value={attributesStr}
              onChange={(e) => setAttributesStr(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                background: "#081311",
                border: "1px solid #1a332d",
                borderRadius: "6px",
                color: "#f8fafc",
                fontSize: "0.85rem",
                fontFamily: "monospace",
              }}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <label style={{ fontSize: "0.82rem", color: "#cbd5e1", fontWeight: 600 }}>
                Functional Dependencies (F)
              </label>
              <button
                type="button"
                onClick={addFd}
                style={{
                  background: "#047857",
                  border: "none",
                  color: "#fff",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  fontSize: "0.72rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.2rem",
                }}
              >
                <Plus size={12} /> Add FD
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {fds.map((fd, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="text"
                    placeholder="LHS (e.g. A)"
                    value={fd.lhs}
                    onChange={(e) => updateFd(i, "lhs", e.target.value)}
                    style={{ flex: 1, padding: "6px 8px", background: "#081311", border: "1px solid #1a332d", borderRadius: "4px", color: "#f8fafc", fontSize: "0.8rem", fontFamily: "monospace" }}
                  />
                  <span style={{ color: "#38bdf8", fontWeight: 700 }}>→</span>
                  <input
                    type="text"
                    placeholder="RHS (e.g. B)"
                    value={fd.rhs}
                    onChange={(e) => updateFd(i, "rhs", e.target.value)}
                    style={{ flex: 1, padding: "6px 8px", background: "#081311", border: "1px solid #1a332d", borderRadius: "4px", color: "#f8fafc", fontSize: "0.8rem", fontFamily: "monospace" }}
                  />
                  <button
                    type="button"
                    onClick={() => removeFd(i)}
                    style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px" }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              disabled={loading}
              onClick={handleAnalyzeFds}
              style={{
                flex: 1,
                background: "#047857",
                color: "#fff",
                border: "none",
                padding: "8px",
                borderRadius: "6px",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Play size={14} /> Full Dependency Analysis
            </button>
          </div>
        </div>

        {/* Right: Attribute Closure Tester */}
        <div
          style={{
            background: "#0d1b18",
            border: "1px solid #1a332d",
            borderRadius: "10px",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div>
            <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", fontWeight: 600, marginBottom: "0.4rem" }}>
              Calculate Attribute Closure (X⁺)
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                placeholder="Attributes to test (e.g. A, B)"
                value={testClosureAttrs}
                onChange={(e) => setTestClosureAttrs(e.target.value)}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  background: "#081311",
                  border: "1px solid #1a332d",
                  borderRadius: "6px",
                  color: "#f8fafc",
                  fontSize: "0.85rem",
                  fontFamily: "monospace",
                }}
              />
              <button
                type="button"
                disabled={loading}
                onClick={handleComputeClosure}
                style={{
                  background: "#0284c7",
                  color: "#fff",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                Compute X⁺
              </button>
            </div>
          </div>

          {/* Closure Result */}
          {closureResult && (
            <div style={{ background: "#081311", border: "1px solid #142823", borderRadius: "6px", padding: "1rem" }}>
              <div style={{ fontSize: "0.75rem", color: "#38bdf8", fontWeight: 700, marginBottom: "0.3rem" }}>
                RESULTING ATTRIBUTE CLOSURE:
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#34d399", fontFamily: "monospace" }}>
                {"{" + closureResult.initial_attributes.join(", ") + "}"}⁺ = {"{" + closureResult.attribute_closure.join(", ") + "}"}
              </div>

              <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "#94a3b8" }}>
                <strong>Derivation Steps:</strong>
                <ol style={{ margin: "4px 0 0", paddingLeft: "1.25rem", color: "#cbd5e1" }}>
                  {closureResult.steps.map((st: any, idx: number) => (
                    <li key={idx}>
                      {st.applied_fd ? (
                        <span>Apply {st.applied_fd} → Add {st.added_attributes.join(", ")} (Closure: {"{" + st.closure.join(", ") + "}"})</span>
                      ) : (
                        <span>{st.rule}: {"{" + st.closure.join(", ") + "}"}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Analysis Results View */}
      {analysisResult && (
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
          <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "1.1rem" }}>
            Relational Analysis Findings
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
            {/* Candidate Keys */}
            <div style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid #1e293b", borderRadius: "8px", padding: "1rem" }}>
              <div style={{ color: "#facc15", fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.4rem" }}>
                MINIMAL CANDIDATE KEYS:
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {analysisResult.candidate_keys.map((ck: string[], i: number) => (
                  <span key={i} style={{ background: "#854d0e", color: "#fef08a", padding: "3px 8px", borderRadius: "4px", fontSize: "0.82rem", fontWeight: 700, fontFamily: "monospace" }}>
                    {"{" + ck.join(", ") + "}"}
                  </span>
                ))}
              </div>
            </div>

            {/* Normal Form */}
            <div style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid #1e293b", borderRadius: "8px", padding: "1rem" }}>
              <div style={{ color: "#34d399", fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.4rem" }}>
                HIGHEST SATISFIED NORMAL FORM:
              </div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#34d399" }}>
                {analysisResult.normalization.highest_normal_form}
              </div>
            </div>

            {/* Minimal Cover */}
            <div style={{ background: "rgba(15, 23, 42, 0.5)", border: "1px solid #1e293b", borderRadius: "8px", padding: "1rem" }}>
              <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.4rem" }}>
                MINIMAL (CANONICAL) COVER:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontFamily: "monospace", fontSize: "0.8rem", color: "#e2e8f0" }}>
                {analysisResult.minimal_cover.map((mc: any, i: number) => (
                  <div key={i}>{"{" + mc.lhs.join(", ") + "} → {" + mc.rhs.join(", ") + "}"}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
