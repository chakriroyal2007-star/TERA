import React, { useState } from "react";
import { Copy, Download, Printer, Check, FileText } from "lucide-react";

interface DocumentationProps {
  documentation: {
    markdown: string;
    title: string;
    generated_at: number;
  } | null;
}

export function DocumentationSection({ documentation }: DocumentationProps) {
  const [copied, setCopied] = useState(false);

  if (!documentation) {
    return <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>Generating DBMS Technical Documentation…</div>;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(documentation.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([documentation.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TERA_DBMS_Data_Dictionary_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header & Export Actions */}
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
            Automated Database Documentation & Data Dictionary
          </h2>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.88rem" }}>
            Comprehensive PostgreSQL technical specification, relational dictionaries, and integrity constraint documentation.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={handleCopy}
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
            {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
            <span>{copied ? "Copied" : "Copy Markdown"}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            style={{
              background: "#047857",
              border: "none",
              color: "#fff",
              padding: "6px 14px",
              borderRadius: "5px",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            <Download size={14} />
            <span>Download .MD</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              background: "#0284c7",
              border: "none",
              color: "#fff",
              padding: "6px 14px",
              borderRadius: "5px",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            <Printer size={14} />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Markdown Document Preview */}
      <div
        style={{
          background: "#0d1b18",
          border: "1px solid #1a332d",
          borderRadius: "10px",
          padding: "2rem",
          color: "#e2e8f0",
          fontSize: "0.88rem",
          lineHeight: "1.7",
          fontFamily: "system-ui, -apple-system, sans-serif",
          maxHeight: "750px",
          overflowY: "auto",
        }}
      >
        <pre
          style={{
            margin: 0,
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: "0.82rem",
            color: "#cbd5e1",
          }}
        >
          {documentation.markdown}
        </pre>
      </div>
    </div>
  );
}
