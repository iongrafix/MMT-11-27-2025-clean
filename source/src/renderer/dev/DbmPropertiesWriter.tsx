import React, { useState } from "react";

type MetadataState = {
  filePath: string;
  title: string;
  comments: string;
  windowsTags: string;
  macTags: string;
  log: string;
};

declare global {
  interface Window {
    mmt: {
      selectFiles: () => Promise<string[]>;
      readMetadata: (filePath: string) => Promise<{
        title?: string;
        comments?: string;
        windowsTags?: string[];
        macTags?: string[];
      }>;
      applyMetadata: (filePath: string, data: {
        title: string;
        comments: string;
        windowsTags: string[];
        macTags: string[];
      }) => Promise<void>;
      openLog: () => Promise<void>;
    };
  }
}

const DbmPropertiesWriter: React.FC = () => {
  const [state, setState] = useState<MetadataState>({
    filePath: "",
    title: "",
    comments: "",
    windowsTags: "",
    macTags: "",
    log: "",
  });

  const logLine = (msg: string) => {
    setState((s) => ({
      ...s,
      log: `[${new Date().toLocaleTimeString()}] ${msg}\n` + s.log,
    }));
  };

  const handleSelectFile = async () => {
    try {
      const files = await window.mmt.selectFiles();
      if (!files || files.length === 0) {
        logLine("File selection cancelled.");
        return;
      }
      setState((s) => ({ ...s, filePath: files[0] }));
      logLine(`Selected file: ${files[0]}`);
    } catch (err: any) {
      logLine(`Error selecting file: ${err?.message ?? err}`);
    }
  };

  const handleRead = async () => {
    if (!state.filePath) {
      logLine("No file selected.");
      return;
    }
    try {
      const meta = await window.mmt.readMetadata(state.filePath);

      setState((s) => ({
        ...s,
        title: meta.title ?? "",
        comments: meta.comments ?? "",
        windowsTags: (meta.windowsTags ?? []).join(", "),
        macTags: (meta.macTags ?? []).join(", "),
      }));

      logLine(
        `Read metadata from ${state.filePath} (title=${meta.title ?? ""})`
      );
    } catch (err: any) {
      logLine(`Error reading metadata: ${err?.message ?? err}`);
    }
  };

  const handleApply = async () => {
    if (!state.filePath) {
      logLine("No file selected.");
      return;
    }

    const windowsTagsArray = state.windowsTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const macTagsArray = state.macTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await window.mmt.applyMetadata(state.filePath, {
        title: state.title,
        comments: state.comments,
        windowsTags: windowsTagsArray,
        macTags: macTagsArray,
      });

      logLine(
        `Applied metadata to ${state.filePath} (Win tags=${windowsTagsArray.join(
          "; "
        )}, Mac tags=${macTagsArray.join("; ")})`
      );
    } catch (err: any) {
      logLine(`Error applying metadata: ${err?.message ?? err}`);
    }
  };

  const handleOpenLog = async () => {
    try {
      await window.mmt.openLog();
      logLine("Opened application log file.");
    } catch (err: any) {
      logLine(`Error opening log: ${err?.message ?? err}`);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        padding: "16px",
        gap: "12px",
        fontFamily: "system-ui, sans-serif",
        color: "#f0f0f0",
        backgroundColor: "#111827",
      }}
    >
      <h1 style={{ fontSize: "20px", margin: 0 }}>DBM Properties Writer</h1>

      {/* Active file + buttons */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          readOnly
          value={state.filePath}
          placeholder="No file selected"
          style={{
            flex: 1,
            padding: "6px 8px",
            borderRadius: 4,
            border: "1px solid #374151",
            backgroundColor: "#020617",
            color: "#e5e7eb",
            fontSize: 12,
          }}
        />

        <button onClick={handleSelectFile} style={btnStyle}>
          Select File
        </button>
        <button onClick={handleRead} style={btnStyle}>
          Read
        </button>
        <button onClick={handleApply} style={btnPrimaryStyle}>
          Apply
        </button>
        <button onClick={handleOpenLog} style={btnStyle}>
          Logs
        </button>
      </div>

      {/* Metadata form */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={labelStyle}>
            Title
            <input
              type="text"
              value={state.title}
              onChange={(e) =>
                setState((s) => ({ ...s, title: e.target.value }))
              }
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Comments / Description
            <textarea
              value={state.comments}
              onChange={(e) =>
                setState((s) => ({ ...s, comments: e.target.value }))
              }
              rows={4}
              style={textareaStyle}
            />
          </label>

          <label style={labelStyle}>
            Windows Tags (Explorer)
            <input
              type="text"
              placeholder="tag1, tag2, tag3"
              value={state.windowsTags}
              onChange={(e) =>
                setState((s) => ({ ...s, windowsTags: e.target.value }))
              }
              style={inputStyle}
            />
            <span style={hintStyle}>
              These become Windows “Tags” (XPKeywords / XMP Subject).
            </span>
          </label>

          <label style={labelStyle}>
            macOS Tags / Keywords
            <input
              type="text"
              placeholder="tag1, tag2, tag3"
              value={state.macTags}
              onChange={(e) =>
                setState((s) => ({ ...s, macTags: e.target.value }))
              }
              style={inputStyle}
            />
            <span style={hintStyle}>
              These are written as Finder tags / XMP keywords.
            </span>
          </label>
        </div>

        {/* Right column – log output */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={labelStyle}>
            Log
            <textarea
              readOnly
              value={state.log}
              style={{ ...textareaStyle, flex: 1, fontSize: 11 }}
            />
          </label>
        </div>
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 4,
  border: "1px solid #4b5563",
  backgroundColor: "#111827",
  color: "#e5e7eb",
  fontSize: 12,
  cursor: "pointer",
};

const btnPrimaryStyle: React.CSSProperties = {
  ...btnStyle,
  backgroundColor: "#2563eb",
  borderColor: "#1d4ed8",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 12,
};

const inputStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 4,
  border: "1px solid #374151",
  backgroundColor: "#020617",
  color: "#e5e7eb",
  fontSize: 12,
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "vertical",
};

const hintStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#9ca3af",
};

export default DbmPropertiesWriter;
