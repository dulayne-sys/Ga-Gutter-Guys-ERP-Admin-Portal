"use client";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

const ErrorPage = ({ error, reset }: ErrorProps) => {
  return (
    <main style={{ padding: "32px", color: "#0f172a" }}>
      <h1 style={{ fontSize: "20px", marginBottom: "12px" }}>Something went wrong</h1>
      <p style={{ marginBottom: "16px" }}>{error.message || "Unexpected error."}</p>
      <button
        onClick={reset}
        style={{
          background: "#0ea5e9",
          color: "#fff",
          padding: "8px 12px",
          borderRadius: "6px",
          border: "none",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </main>
  );
};

export default ErrorPage;
