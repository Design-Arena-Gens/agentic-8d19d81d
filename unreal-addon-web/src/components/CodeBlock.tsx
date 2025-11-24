 "use client";

import { useCallback, useState } from "react";

type CodeBlockProps = {
  title: string;
  language: string;
  filename?: string;
  code: string;
};

export function CodeBlock({ title, language, filename, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code.trimEnd());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }, [code]);

  return (
    <article className="panel" style={{ gap: "0.85rem" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "0.82rem", color: "var(--foreground-muted)" }}>
            {title}
          </span>
          {filename ? (
            <strong style={{ fontSize: "1rem", fontWeight: 600 }}>{filename}</strong>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${title}`}
          style={{
            borderRadius: "999px",
            border: "1px solid rgba(110, 197, 255, 0.35)",
            padding: "0.45rem 0.95rem",
            color: copied ? "#1dd3b0" : "var(--accent)",
            background: copied ? "rgba(29, 211, 176, 0.12)" : "transparent",
            transition: "all 0.18s ease",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </header>
      <pre className="code-block" role="region" aria-live="polite">
        <code data-language={language}>{code.trim()}</code>
      </pre>
    </article>
  );
}
