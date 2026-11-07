import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, User, date } from "../api";
import {
  DbmsOverview,
  TableMetadata,
  ChenErModel,
  RelationalSchemaItem,
  TableNormalizationItem,
  DbmsActivity,
} from "./types";
import { OverviewSection } from "./sections/OverviewSection";
import { SchemaExplorerSection } from "./sections/SchemaExplorerSection";
import { ChenErDiagramSection } from "./sections/ChenErDiagramSection";
import { RelationalSchemaSection } from "./sections/RelationalSchemaSection";
import { NormalizationSection } from "./sections/NormalizationSection";
import { FunctionalDependencySection } from "./sections/FunctionalDependencySection";
import { KeysConstraintsSection } from "./sections/KeysConstraintsSection";
import { SqlLabSection } from "./sections/SqlLabSection";
import { AcidTransactionsSection } from "./sections/AcidTransactionsSection";
import { IndexingSection } from "./sections/IndexingSection";
import { RelationshipsSection } from "./sections/RelationshipsSection";
import { ActivityAuditSection } from "./sections/ActivityAuditSection";
import { DocumentationSection } from "./sections/DocumentationSection";
import {
  Database,
  Table,
  Network,
  Layers,
  CheckCircle2,
  FileCode,
  Terminal,
  Key,
  Lock,
  Zap,
  GitBranch,
  Activity,
  FileText,
  RefreshCw,
  Server,
} from "lucide-react";

interface DbmsStudioProps {
  user: User;
}

export function DbmsStudio({ user }: DbmsStudioProps) {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState("overview");
  const [selectedTableName, setSelectedTableName] = useState("incidents");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Queries for live DBMS data
  const overviewQuery = useQuery({
    queryKey: ["dbms-overview"],
    queryFn: () => api<DbmsOverview>("/dbms/overview"),
    refetchInterval: 15000,
  });

  const tablesQuery = useQuery({
    queryKey: ["dbms-tables"],
    queryFn: () => api<TableMetadata[]>("/dbms/tables"),
    refetchInterval: 15000,
  });

  const erModelQuery = useQuery({
    queryKey: ["dbms-er-model"],
    queryFn: () => api<ChenErModel>("/dbms/er-model"),
    staleTime: 60000,
  });

  const relationalSchemaQuery = useQuery({
    queryKey: ["dbms-relational-schema"],
    queryFn: () => api<RelationalSchemaItem[]>("/dbms/relational-schema"),
    staleTime: 60000,
  });

  const normalizationQuery = useQuery({
    queryKey: ["dbms-normalization"],
    queryFn: () => api<TableNormalizationItem[]>("/dbms/normalization/tables"),
    staleTime: 60000,
  });

  const indexesQuery = useQuery({
    queryKey: ["dbms-indexes"],
    queryFn: () => api<any[]>("/dbms/indexes"),
    staleTime: 60000,
  });

  const activityQuery = useQuery({
    queryKey: ["dbms-activity"],
    queryFn: () => api<DbmsActivity>("/dbms/activity"),
    refetchInterval: 10000,
  });

  const docQuery = useQuery({
    queryKey: ["dbms-documentation"],
    queryFn: () => api<any>("/dbms/documentation"),
    staleTime: 60000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]).startsWith("dbms"),
    });
    setLastRefreshed(new Date());
    setIsRefreshing(false);
  };

  const navItems = [
    { id: "overview", label: "Overview", icon: Database },
    { id: "schema", label: "Live Schema Explorer", icon: Table },
    { id: "er", label: "Chen ER Diagram", icon: Network },
    { id: "relational", label: "Relational Schema", icon: Layers },
    { id: "normalization", label: "Normalization Analyzer", icon: CheckCircle2 },
    { id: "fd", label: "Functional Dependencies", icon: FileCode },
    { id: "sqllab", label: "SQL Laboratory", icon: Terminal },
    { id: "keys", label: "Keys & Constraints", icon: Key },
    { id: "acid", label: "ACID Transactions", icon: Lock },
    { id: "indexing", label: "Indexing & Performance", icon: Zap },
    { id: "relationships", label: "Referential Integrity", icon: GitBranch },
    { id: "activity", label: "Database Activity", icon: Activity },
    { id: "docs", label: "Technical Documentation", icon: FileText },
  ];

  const handleSelectTableFromAnywhere = (tableName: string) => {
    setSelectedTableName(tableName);
    setActiveSection("schema");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", color: "#f8fafc" }}>
      {/* Top Bar */}
      <div
        style={{
          background: "#081311",
          border: "1px solid #1a332d",
          borderRadius: "10px",
          padding: "0.85rem 1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              background: "#047857",
              color: "#fff",
              width: "34px",
              height: "34px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Server size={18} />
          </div>
          <div>
            <div style={{ fontSize: "0.72rem", color: "#34d399", fontWeight: 700, letterSpacing: "0.06em" }}>
              TERA RELATIONAL LABORATORY
            </div>
            <strong style={{ fontSize: "1.05rem", color: "#f8fafc" }}>
              DBMS Studio
            </strong>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: overviewQuery.data ? "#10b981" : "#ef4444",
                boxShadow: overviewQuery.data ? "0 0 8px #10b981" : "none",
              }}
            />
            <span style={{ color: "#94a3b8" }}>
              {overviewQuery.data ? "Live Connected" : "Connecting…"}
            </span>
            {overviewQuery.data && (
              <span style={{ color: "#38bdf8", fontWeight: 600 }}>
                ({overviewQuery.data.dialect.toUpperCase()})
              </span>
            )}
          </div>

          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
            Synced: {lastRefreshed.toLocaleTimeString()}
          </div>

          <button
            type="button"
            disabled={isRefreshing}
            onClick={handleRefresh}
            style={{
              background: "#0d1b18",
              border: "1px solid #1a332d",
              color: "#34d399",
              padding: "5px 10px",
              borderRadius: "5px",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
            <span>{isRefreshing ? "Syncing…" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Main Studio Workspace Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "1.25rem", minHeight: "720px" }}>
        {/* Left Studio Navigation */}
        <aside
          style={{
            background: "#081311",
            border: "1px solid #1a332d",
            borderRadius: "10px",
            padding: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
            alignSelf: "start",
          }}
        >
          <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 700, padding: "4px 8px", textTransform: "uppercase" }}>
            DBMS MODULES
          </div>
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  background: isActive ? "#047857" : "transparent",
                  color: isActive ? "#ffffff" : "#94a3b8",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  fontWeight: isActive ? 700 : 500,
                  textAlign: "left",
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
              >
                <item.icon size={16} color={isActive ? "#fff" : "#34d399"} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Right Active Module Viewport */}
        <main style={{ minWidth: 0 }}>
          {activeSection === "overview" && (
            <OverviewSection
              overview={overviewQuery.data || null}
              tables={tablesQuery.data || []}
              onSelectTable={handleSelectTableFromAnywhere}
              onNavigateSection={setActiveSection}
            />
          )}

          {activeSection === "schema" && (
            <SchemaExplorerSection
              tables={tablesQuery.data || []}
              selectedTableName={selectedTableName}
              onSelectTable={setSelectedTableName}
            />
          )}

          {activeSection === "er" && (
            <ChenErDiagramSection
              erModel={erModelQuery.data || null}
              onSelectEntity={handleSelectTableFromAnywhere}
            />
          )}

          {activeSection === "relational" && (
            <RelationalSchemaSection
              relationalSchema={relationalSchemaQuery.data || []}
              onSelectTable={handleSelectTableFromAnywhere}
            />
          )}

          {activeSection === "normalization" && (
            <NormalizationSection
              normalizationTables={normalizationQuery.data || []}
            />
          )}

          {activeSection === "fd" && <FunctionalDependencySection />}

          {activeSection === "sqllab" && <SqlLabSection />}

          {activeSection === "keys" && (
            <KeysConstraintsSection
              tables={tablesQuery.data || []}
              onSelectTable={handleSelectTableFromAnywhere}
            />
          )}

          {activeSection === "acid" && <AcidTransactionsSection />}

          {activeSection === "indexing" && (
            <IndexingSection indexes={indexesQuery.data || []} />
          )}

          {activeSection === "relationships" && (
            <RelationshipsSection
              tables={tablesQuery.data || []}
              onSelectTable={handleSelectTableFromAnywhere}
            />
          )}

          {activeSection === "activity" && (
            <ActivityAuditSection activity={activityQuery.data || null} />
          )}

          {activeSection === "docs" && (
            <DocumentationSection documentation={docQuery.data || null} />
          )}
        </main>
      </div>
    </div>
  );
}
