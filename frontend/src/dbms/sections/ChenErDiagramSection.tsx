import React, { useState, useRef, useEffect } from "react";
import { ChenErModel, ChenEntity, ChenRelationship } from "../types";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Download,
  Filter,
  Search,
  Eye,
  EyeOff,
  Layers,
  X,
} from "lucide-react";

interface ChenErProps {
  erModel: ChenErModel | null;
  onSelectEntity: (tableName: string) => void;
}

export function ChenErDiagramSection({ erModel, onSelectEntity }: ChenErProps) {
  const [scale, setScale] = useState(0.85);
  const [pan, setPan] = useState({ x: 60, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  const [selectedEntity, setSelectedEntity] = useState<ChenEntity | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<ChenRelationship | null>(null);
  const [selectedAttribute, setSelectedAttribute] = useState<any | null>(null);

  const [showAttributes, setShowAttributes] = useState(true);
  const [showCardinalities, setShowCardinalities] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");

  const svgRef = useRef<SVGSVGElement | null>(null);

  if (!erModel) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
        Loading Chen Notation ER Diagram metadata...
      </div>
    );
  }

  // Filter entities
  const filteredEntities = erModel.entities.filter((e) => {
    const matchCategory = categoryFilter === "all" || e.category === categoryFilter;
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.table_name.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  const entitySet = new Set(filteredEntities.map((e) => e.table_name));

  const filteredRelationships = erModel.relationships.filter(
    (r) => entitySet.has(r.source_entity) && entitySet.has(r.target_entity),
  );

  // Dynamic layout positioning for Chen nodes in an orderly grid layout
  const nodePositions: Record<string, { x: number; y: number }> = {};
  const cols = 4;
  filteredEntities.forEach((e, idx) => {
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    nodePositions[e.table_name] = {
      x: 180 + col * 360,
      y: 120 + row * 260,
    };
  });

  // Pan event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "svg" || (e.target as HTMLElement).id === "canvas-bg") {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
    }
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleZoom = (delta: number) => {
    setScale((prev) => Math.max(0.3, Math.min(2.5, prev + delta)));
  };

  const handleReset = () => {
    setScale(0.85);
    setPan({ x: 60, y: 40 });
    setSelectedEntity(null);
    setSelectedRelationship(null);
    setSelectedAttribute(null);
  };

  const exportSvg = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tera_chen_er_diagram_${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const categories = ["all", ...Array.from(new Set(erModel.entities.map((e) => e.category)))];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Control Toolbar */}
      <div
        style={{
          background: "#0d1b18",
          border: "1px solid #1a332d",
          borderRadius: "10px",
          padding: "0.75rem 1rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} color="#64748b" style={{ position: "absolute", left: "8px", top: "9px" }} />
            <input
              type="text"
              placeholder="Search entities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "5px 8px 5px 28px",
                background: "#081311",
                border: "1px solid #1a332d",
                borderRadius: "5px",
                color: "#f8fafc",
                fontSize: "0.8rem",
                width: "160px",
              }}
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: "5px 8px",
              background: "#081311",
              border: "1px solid #1a332d",
              borderRadius: "5px",
              color: "#f8fafc",
              fontSize: "0.8rem",
            }}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All Domains" : c}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowAttributes(!showAttributes)}
            style={{
              background: showAttributes ? "#047857" : "#081311",
              border: "1px solid #1a332d",
              color: "#f8fafc",
              padding: "5px 10px",
              borderRadius: "5px",
              fontSize: "0.78rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            {showAttributes ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>Attributes</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCardinalities(!showCardinalities)}
            style={{
              background: showCardinalities ? "#047857" : "#081311",
              border: "1px solid #1a332d",
              color: "#f8fafc",
              padding: "5px 10px",
              borderRadius: "5px",
              fontSize: "0.78rem",
              cursor: "pointer",
            }}
          >
            <span>Cardinalities ({showCardinalities ? "1:N" : "Off"})</span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => handleZoom(0.15)}
            title="Zoom In"
            style={{ background: "#081311", border: "1px solid #1a332d", color: "#f8fafc", padding: "6px", borderRadius: "5px", cursor: "pointer" }}
          >
            <ZoomIn size={15} />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(-0.15)}
            title="Zoom Out"
            style={{ background: "#081311", border: "1px solid #1a332d", color: "#f8fafc", padding: "6px", borderRadius: "5px", cursor: "pointer" }}
          >
            <ZoomOut size={15} />
          </button>
          <button
            type="button"
            onClick={handleReset}
            title="Reset Diagram"
            style={{ background: "#081311", border: "1px solid #1a332d", color: "#f8fafc", padding: "6px", borderRadius: "5px", cursor: "pointer" }}
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            onClick={exportSvg}
            style={{
              background: "#0284c7",
              border: "none",
              color: "#fff",
              padding: "5px 12px",
              borderRadius: "5px",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            <Download size={13} />
            <span>Export SVG</span>
          </button>
        </div>
      </div>

      {/* Chen Legend */}
      <div
        style={{
          background: "rgba(13, 27, 24, 0.7)",
          border: "1px solid #1a332d",
          borderRadius: "8px",
          padding: "0.5rem 1rem",
          display: "flex",
          gap: "1.25rem",
          fontSize: "0.74rem",
          color: "#94a3b8",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span style={{ fontWeight: 700, color: "#34d399" }}>CHEN NOTATION:</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <div style={{ width: "16px", height: "10px", border: "1.5px solid #38bdf8", background: "#0f2320" }} />
          <span>Entity (Rectangle)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <div style={{ width: "16px", height: "10px", border: "2px double #f43f5e", background: "#0f2320" }} />
          <span>Weak Entity (Double Rectangle)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <div style={{ width: "10px", height: "10px", border: "1.5px solid #a855f7", transform: "rotate(45deg)" }} />
          <span>Relationship (Diamond)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <div style={{ width: "16px", height: "10px", borderRadius: "50%", border: "1.5px solid #facc15" }} />
          <span>Attribute (Oval)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ textDecoration: "underline", color: "#facc15", fontWeight: 700 }}>PK</span>
          <span>Primary Key (Underlined)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <div style={{ width: "20px", height: "3px", borderTop: "2px double #34d399" }} />
          <span>Total Participation (Double Line)</span>
        </div>
      </div>

      {/* Main Interactive Diagram Canvas */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "640px",
          background: "#081311",
          border: "1px solid #1a332d",
          borderRadius: "10px",
          overflow: "hidden",
          cursor: isPanning ? "grabbing" : "grab",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ width: "100%", height: "100%" }}
        >
          <rect id="canvas-bg" width="100%" height="100%" fill="#081311" />
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
            {/* Draw Relationship Diamonds & Connecting Lines */}
            {filteredRelationships.map((rel) => {
              const srcPos = nodePositions[rel.source_entity];
              const tgtPos = nodePositions[rel.target_entity];
              if (!srcPos || !tgtPos) return null;

              const midX = (srcPos.x + tgtPos.x) / 2;
              const midY = (srcPos.y + tgtPos.y) / 2;
              const isSelected = selectedRelationship?.id === rel.id;

              return (
                <g key={rel.id}>
                  {/* Line from Source to Relationship Diamond */}
                  <line
                    x1={srcPos.x}
                    y1={srcPos.y}
                    x2={midX}
                    y2={midY}
                    stroke={isSelected ? "#38bdf8" : rel.source_participation === "total" ? "#34d399" : "#475569"}
                    strokeWidth={rel.source_participation === "total" ? 3 : 1.5}
                    strokeDasharray={rel.source_participation === "total" ? "none" : "none"}
                  />
                  {rel.source_participation === "total" && (
                    <line
                      x1={srcPos.x + 3}
                      y1={srcPos.y + 3}
                      x2={midX + 3}
                      y2={midY + 3}
                      stroke="#34d399"
                      strokeWidth={1.5}
                    />
                  )}

                  {/* Line from Relationship Diamond to Target */}
                  <line
                    x1={midX}
                    y1={midY}
                    x2={tgtPos.x}
                    y2={tgtPos.y}
                    stroke={isSelected ? "#38bdf8" : "#475569"}
                    strokeWidth={1.5}
                  />

                  {/* Cardinality Labels */}
                  {showCardinalities && (
                    <>
                      <text
                        x={(srcPos.x + midX) / 2}
                        y={(srcPos.y + midY) / 2 - 8}
                        fill="#38bdf8"
                        fontSize="12"
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        {rel.cardinality === "1:N" ? "N" : "1"}
                      </text>
                      <text
                        x={(tgtPos.x + midX) / 2}
                        y={(tgtPos.y + midY) / 2 - 8}
                        fill="#34d399"
                        fontSize="12"
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        1
                      </text>
                    </>
                  )}

                  {/* Relationship Diamond */}
                  <g
                    transform={`translate(${midX}, ${midY})`}
                    style={{ cursor: "pointer" }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSelectedRelationship(rel);
                      setSelectedEntity(null);
                      setSelectedAttribute(null);
                    }}
                  >
                    <polygon
                      points="0,-24 34,0 0,24 -34,0"
                      fill={isSelected ? "#1e1b4b" : "#0d1b18"}
                      stroke={isSelected ? "#38bdf8" : rel.is_identifying ? "#f43f5e" : "#a855f7"}
                      strokeWidth={rel.is_identifying ? 3 : 2}
                    />
                    {rel.is_identifying && (
                      <polygon
                        points="0,-18 26,0 0,18 -26,0"
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth={1.5}
                      />
                    )}
                    <text
                      y="4"
                      textAnchor="middle"
                      fill={isSelected ? "#38bdf8" : "#e2e8f0"}
                      fontSize="10"
                      fontWeight="600"
                    >
                      {rel.name.length > 14 ? rel.name.slice(0, 12) + "…" : rel.name}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Draw Entities and Attributes */}
            {filteredEntities.map((ent) => {
              const pos = nodePositions[ent.table_name];
              if (!pos) return null;
              const isSelected = selectedEntity?.id === ent.id;

              return (
                <g key={ent.id} transform={`translate(${pos.x}, ${pos.y})`}>
                  {/* Attributes as Ovals around Entity */}
                  {showAttributes &&
                    ent.attributes.slice(0, 8).map((attr, aIdx) => {
                      const totalAttrs = Math.min(ent.attributes.length, 8);
                      const angle = (aIdx / totalAttrs) * 2 * Math.PI - Math.PI / 2;
                      const attrDist = 95;
                      const ax = Math.cos(angle) * attrDist;
                      const ay = Math.sin(angle) * attrDist;

                      return (
                        <g
                          key={attr.id}
                          style={{ cursor: "pointer" }}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setSelectedAttribute({ ...attr, entityName: ent.name });
                          }}
                        >
                          {/* Attribute connecting line */}
                          <line x1="0" y1="0" x2={ax} y2={ay} stroke="#334155" strokeWidth="1" />
                          {/* Attribute Oval */}
                          <ellipse
                            cx={ax}
                            cy={ay}
                            rx="38"
                            ry="16"
                            fill={attr.is_primary_key ? "rgba(234, 179, 8, 0.15)" : "#0d1b18"}
                            stroke={
                              attr.is_primary_key
                                ? "#facc15"
                                : attr.is_foreign_key
                                  ? "#f43f5e"
                                  : attr.is_multivalued
                                    ? "#34d399"
                                    : "#64748b"
                            }
                            strokeWidth={attr.is_primary_key ? 2 : 1.5}
                            strokeDasharray={attr.is_derived ? "4,3" : "none"}
                          />
                          {attr.is_multivalued && (
                            <ellipse
                              cx={ax}
                              cy={ay}
                              rx="34"
                              ry="13"
                              fill="none"
                              stroke="#34d399"
                              strokeWidth="1"
                            />
                          )}
                          <text
                            x={ax}
                            y={ay + 3}
                            textAnchor="middle"
                            fill={attr.is_primary_key ? "#fef08a" : "#cbd5e1"}
                            fontSize="9"
                            fontWeight={attr.is_primary_key ? 700 : 500}
                            style={{
                              textDecoration: attr.is_primary_key ? "underline" : "none",
                            }}
                          >
                            {attr.name.length > 10 ? attr.name.slice(0, 9) + "…" : attr.name}
                          </text>
                        </g>
                      );
                    })}

                  {/* Entity Rectangle */}
                  <g
                    style={{ cursor: "pointer" }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSelectedEntity(ent);
                      setSelectedRelationship(null);
                      setSelectedAttribute(null);
                    }}
                  >
                    <rect
                      x="-70"
                      y="-25"
                      width="140"
                      height="50"
                      fill={isSelected ? "#047857" : "#0d1b18"}
                      stroke={isSelected ? "#34d399" : ent.is_weak ? "#f43f5e" : "#38bdf8"}
                      strokeWidth={ent.is_weak ? 3 : 2}
                      rx="3"
                    />
                    {ent.is_weak && (
                      <rect
                        x="-65"
                        y="-20"
                        width="130"
                        height="40"
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth="1.5"
                        rx="2"
                      />
                    )}
                    <text
                      y="-4"
                      textAnchor="middle"
                      fill="#f8fafc"
                      fontSize="12"
                      fontWeight="700"
                    >
                      {ent.name.length > 18 ? ent.name.slice(0, 16) + "…" : ent.name}
                    </text>
                    <text
                      y="14"
                      textAnchor="middle"
                      fill={isSelected ? "#d1fae5" : "#64748b"}
                      fontSize="9"
                    >
                      {ent.table_name}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Selected Entity Inspector Overlay */}
        {selectedEntity && (
          <div
            style={{
              position: "absolute",
              right: "16px",
              top: "16px",
              width: "320px",
              background: "rgba(13, 27, 24, 0.95)",
              border: "1px solid #1a332d",
              borderRadius: "8px",
              padding: "1rem",
              boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
              color: "#f8fafc",
              fontSize: "0.82rem",
              backdropFilter: "blur(8px)",
              maxHeight: "90%",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
              <div>
                <span style={{ fontSize: "0.72rem", color: "#34d399", fontWeight: 700 }}>
                  {selectedEntity.is_weak ? "WEAK ENTITY (Double Box)" : "STRONG ENTITY"}
                </span>
                <h4 style={{ margin: "2px 0 0", fontSize: "1.1rem" }}>{selectedEntity.name}</h4>
                <code style={{ fontSize: "0.75rem", color: "#38bdf8" }}>{selectedEntity.table_name}</code>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntity(null)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "2px" }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ color: "#94a3b8", fontSize: "0.78rem", marginBottom: "0.75rem" }}>
              Domain: <strong style={{ color: "#e2e8f0" }}>{selectedEntity.category}</strong>
            </div>

            <div style={{ fontWeight: 700, color: "#facc15", marginBottom: "0.4rem" }}>
              Entity Attributes ({selectedEntity.attributes.length}):
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", maxHeight: "200px", overflowY: "auto" }}>
              {selectedEntity.attributes.map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #1a332d" }}>
                  <span style={{ color: a.is_primary_key ? "#facc15" : "#e2e8f0", textDecoration: a.is_primary_key ? "underline" : "none" }}>
                    {a.name}
                  </span>
                  <span style={{ color: "#64748b", fontFamily: "monospace", fontSize: "0.72rem" }}>
                    {a.data_type}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onSelectEntity(selectedEntity.table_name)}
              style={{
                marginTop: "1rem",
                width: "100%",
                background: "#047857",
                color: "#fff",
                border: "none",
                padding: "6px",
                borderRadius: "5px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.8rem",
              }}
            >
              Inspect in Live Schema Explorer →
            </button>
          </div>
        )}

        {/* Selected Relationship Overlay */}
        {selectedRelationship && (
          <div
            style={{
              position: "absolute",
              right: "16px",
              top: "16px",
              width: "320px",
              background: "rgba(13, 27, 24, 0.95)",
              border: "1px solid #a855f7",
              borderRadius: "8px",
              padding: "1rem",
              boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
              color: "#f8fafc",
              fontSize: "0.82rem",
              backdropFilter: "blur(8px)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
              <div>
                <span style={{ fontSize: "0.72rem", color: "#a855f7", fontWeight: 700 }}>
                  CHEN RELATIONSHIP (Diamond)
                </span>
                <h4 style={{ margin: "2px 0 0", fontSize: "1.1rem" }}>{selectedRelationship.name}</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRelationship(null)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div>
                <span style={{ color: "#94a3b8" }}>Cardinality:</span>{" "}
                <strong style={{ color: "#38bdf8" }}>{selectedRelationship.cardinality}</strong>
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>Source Entity:</span>{" "}
                <strong style={{ color: "#34d399" }}>{selectedRelationship.source_entity}</strong> ({selectedRelationship.source_participation} participation)
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>Target Entity:</span>{" "}
                <strong style={{ color: "#34d399" }}>{selectedRelationship.target_entity}</strong> ({selectedRelationship.target_participation} participation)
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>Foreign Key Columns:</span>{" "}
                <code style={{ color: "#f43f5e" }}>{selectedRelationship.foreign_key_columns.join(", ")}</code>
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>Identifying Relationship:</span>{" "}
                <strong>{selectedRelationship.is_identifying ? "Yes (Double Diamond)" : "No"}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Selected Attribute Overlay */}
        {selectedAttribute && (
          <div
            style={{
              position: "absolute",
              left: "16px",
              bottom: "16px",
              width: "280px",
              background: "rgba(13, 27, 24, 0.95)",
              border: "1px solid #facc15",
              borderRadius: "8px",
              padding: "0.85rem",
              boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
              color: "#f8fafc",
              fontSize: "0.82rem",
              backdropFilter: "blur(8px)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.4rem" }}>
              <div>
                <span style={{ fontSize: "0.72rem", color: "#facc15", fontWeight: 700 }}>
                  CHEN ATTRIBUTE (Oval)
                </span>
                <h4 style={{ margin: "2px 0 0", fontSize: "1rem" }}>{selectedAttribute.name}</h4>
                <small style={{ color: "#64748b" }}>Entity: {selectedAttribute.entityName}</small>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAttribute(null)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={15} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.78rem" }}>
              <div>
                <span style={{ color: "#94a3b8" }}>Type:</span>{" "}
                <code style={{ color: "#38bdf8" }}>{selectedAttribute.data_type}</code>
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>Primary Key:</span>{" "}
                <strong style={{ color: selectedAttribute.is_primary_key ? "#facc15" : "#64748b" }}>
                  {selectedAttribute.is_primary_key ? "YES (Underlined)" : "No"}
                </strong>
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>Nullable:</span>{" "}
                <strong>{selectedAttribute.nullable ? "YES" : "NO (Mandatory)"}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
