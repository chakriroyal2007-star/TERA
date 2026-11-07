import React, { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Play, RotateCcw, Lock } from "lucide-react";

export function AcidTransactionsSection() {
  const [currentStep, setCurrentStep] = useState(0);
  const [outcome, setOutcome] = useState<"pending" | "committed" | "rolled_back">("pending");

  const transactionSteps = [
    {
      title: "1. BEGIN TRANSACTION",
      sql: "BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;",
      detail: "Opens a transactional context with write locks and savepoint capabilities.",
      status: "Transaction initiated.",
    },
    {
      title: "2. PESSIMISTIC ROW LOCK",
      sql: "SELECT * FROM ambulances WHERE id = 'AP-03-EM-108' AND active = true FOR UPDATE;",
      detail: "Acquires an exclusive row lock on ambulance unit AP-03-EM-108, preventing concurrent dispatches.",
      status: "Exclusive row lock acquired (pg_locks).",
    },
    {
      title: "3. CREATE MISSION ASSIGNMENT",
      sql: "INSERT INTO missions (incident_id, ambulance_id, status) VALUES ('TERA-2026-894103', 'AP-03-EM-108', 'dispatched');",
      detail: "Creates the operational mission row linked by Foreign Keys to incident and fleet unit.",
      status: "Mission tuple staged in transaction buffer.",
    },
    {
      title: "4. UPDATE AMBULANCE STATE",
      sql: "UPDATE ambulances SET active = false WHERE id = 'AP-03-EM-108';",
      detail: "Sets the ambulance status to occupied so no other operator can double-book this emergency asset.",
      status: "Ambulance status updated in WAL buffer.",
    },
    {
      title: "5. RECORD IMMUTABLE AUDIT LOG",
      sql: "INSERT INTO audit_logs (actor, action, scope, target) VALUES ('operator@tera.org', 'ambulance.dispatch', 'incident', 'TERA-2026-894103');",
      detail: "Writes audit trail entry. Protected by database trigger against deletion or modification.",
      status: "Audit log recorded.",
    },
  ];

  const handleNextStep = () => {
    if (currentStep < transactionSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleCommit = () => {
    setOutcome("committed");
  };

  const handleRollback = () => {
    setOutcome("rolled_back");
  };

  const handleReset = () => {
    setCurrentStep(0);
    setOutcome("pending");
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
            Transactions, ACID & Concurrency Control
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.88rem" }}>
            Explore Atomicity, Consistency, Isolation, and Durability through an interactive live emergency dispatch transaction simulation.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          style={{
            background: "#081311",
            border: "1px solid #1a332d",
            color: "#f8fafc",
            padding: "6px 12px",
            borderRadius: "5px",
            fontSize: "0.8rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
          }}
        >
          <RotateCcw size={14} /> Reset Simulation
        </button>
      </div>

      {/* 4 Pillars of ACID */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        {[
          {
            letter: "A",
            title: "Atomicity",
            desc: "All or Nothing: If any step fails during ambulance dispatch (e.g., resource collision), the entire transaction rolls back cleanly.",
            color: "#38bdf8",
          },
          {
            letter: "C",
            title: "Consistency",
            desc: "Constraints Preserved: CHECK constraints, NOT NULL, and Foreign Keys are verified before write commit.",
            color: "#34d399",
          },
          {
            letter: "I",
            title: "Isolation",
            desc: "Concurrency Isolation: Row locks (SELECT FOR UPDATE) prevent two operators from dispatching the same ambulance simultaneously.",
            color: "#a855f7",
          },
          {
            letter: "D",
            title: "Durability",
            desc: "Persistence Guarantee: Once committed, state changes persist through Write-Ahead Logging (WAL) even across system restarts.",
            color: "#facc15",
          },
        ].map((item) => (
          <div
            key={item.letter}
            style={{
              background: "#0d1b18",
              border: "1px solid #1a332d",
              borderRadius: "8px",
              padding: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
              <span
                style={{
                  background: item.color,
                  color: "#0f172a",
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: "0.85rem",
                }}
              >
                {item.letter}
              </span>
              <strong style={{ color: "#f8fafc", fontSize: "0.95rem" }}>{item.title}</strong>
            </div>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.8rem", lineHeight: "1.4" }}>
              {item.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Interactive Emergency Allocation Transaction Simulator */}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: "0.78rem", color: "#34d399", fontWeight: 700 }}>
              LIVE SIMULATION LABORATORY
            </span>
            <h3 style={{ margin: "0.2rem 0", color: "#f8fafc", fontSize: "1.15rem" }}>
              Ambulance Resource Allocation Transaction
            </h3>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {outcome === "pending" ? (
              <>
                <button
                  type="button"
                  disabled={currentStep < transactionSteps.length - 1}
                  onClick={handleCommit}
                  style={{
                    background: currentStep === transactionSteps.length - 1 ? "#047857" : "#081311",
                    color: currentStep === transactionSteps.length - 1 ? "#fff" : "#64748b",
                    border: "1px solid #10b981",
                    padding: "6px 14px",
                    borderRadius: "5px",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    cursor: currentStep === transactionSteps.length - 1 ? "pointer" : "not-allowed",
                  }}
                >
                  COMMIT Transaction
                </button>
                <button
                  type="button"
                  onClick={handleRollback}
                  style={{
                    background: "rgba(239, 68, 68, 0.2)",
                    color: "#f87171",
                    border: "1px solid #ef4444",
                    padding: "6px 14px",
                    borderRadius: "5px",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  Simulate Failure (ROLLBACK)
                </button>
              </>
            ) : null}
          </div>
        </div>

        {/* Transaction Steps Progress */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {transactionSteps.map((s, idx) => {
            const isCompleted = idx <= currentStep && outcome !== "rolled_back";
            const isCurrent = idx === currentStep && outcome === "pending";

            return (
              <div
                key={idx}
                style={{
                  background: isCurrent ? "rgba(4, 120, 87, 0.15)" : "rgba(15, 23, 42, 0.4)",
                  border: "1px solid " + (isCurrent ? "#047857" : "#1e293b"),
                  borderRadius: "6px",
                  padding: "0.75rem 1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.3rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {isCompleted ? (
                      <CheckCircle2 size={16} color="#34d399" />
                    ) : (
                      <span style={{ width: "16px", height: "16px", borderRadius: "50%", border: "1px solid #64748b", display: "inline-block" }} />
                    )}
                    <strong style={{ color: isCurrent ? "#34d399" : "#e2e8f0", fontSize: "0.85rem" }}>
                      {s.title}
                    </strong>
                  </div>
                  <span style={{ fontSize: "0.72rem", color: isCompleted ? "#34d399" : "#64748b" }}>
                    {isCompleted ? s.status : "Waiting"}
                  </span>
                </div>
                <div style={{ fontFamily: "monospace", color: "#38bdf8", fontSize: "0.75rem", background: "#081311", padding: "4px 8px", borderRadius: "4px" }}>
                  {s.sql}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  {s.detail}
                </div>
              </div>
            );
          })}
        </div>

        {/* Step Forward Button if pending */}
        {outcome === "pending" && currentStep < transactionSteps.length - 1 && (
          <button
            type="button"
            onClick={handleNextStep}
            style={{
              background: "#0284c7",
              color: "#fff",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              alignSelf: "flex-start",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <span>Execute Next Step</span>
            <Play size={14} />
          </button>
        )}

        {/* Outcome Banners */}
        {outcome === "committed" && (
          <div
            style={{
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid #10b981",
              borderRadius: "8px",
              padding: "1rem",
              color: "#6ee7b7",
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <CheckCircle2 size={24} color="#10b981" />
            <div>
              <strong>Transaction Committed Successfully!</strong>
              <div style={{ fontSize: "0.8rem", color: "#a7f3d0", marginTop: "2px" }}>
                All 5 operations were atomically persisted to the Write-Ahead Log. Locks released.
              </div>
            </div>
          </div>
        )}

        {outcome === "rolled_back" && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid #ef4444",
              borderRadius: "8px",
              padding: "1rem",
              color: "#fca5a5",
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <XCircle size={24} color="#ef4444" />
            <div>
              <strong>Transaction Rolled Back (Atomicity Preserved)!</strong>
              <div style={{ fontSize: "0.8rem", color: "#fecdd3", marginTop: "2px" }}>
                All intermediate stage changes were reverted. The ambulance remains untouched and consistency is 100% maintained.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
