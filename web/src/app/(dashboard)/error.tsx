"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard Error:", error);
  }, [error]);

  return (
    <div style={{ padding: "40px", fontFamily: "monospace" }}>
      <h2 style={{ color: "red" }}>Dashboard Error</h2>
      <pre style={{ background: "#f5f5f5", padding: "16px", borderRadius: "8px", overflow: "auto" }}>
        {error.message}
        {"\n\n"}
        {error.stack}
      </pre>
      <button
        onClick={reset}
        style={{ marginTop: "16px", padding: "8px 16px", cursor: "pointer" }}
      >
        Try again
      </button>
    </div>
  );
}
