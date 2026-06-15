export default function DashboardLoading() {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          border: "1px solid rgba(3,72,82,0.08)",
          borderRadius: "24px",
          padding: "40px 48px",
          textAlign: "center",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        }}
      >
        <p
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.3em",
            color: "#0abe62",
          }}
        >
          Loading
        </p>
        <p
          style={{
            marginTop: "12px",
            fontSize: "22px",
            fontWeight: 700,
            color: "#034852",
            fontFamily: "var(--font-heading)",
          }}
        >
          Opening your dashboard
        </p>
        <p
          style={{
            marginTop: "8px",
            fontSize: "14px",
            color: "rgba(3,72,82,0.6)",
          }}
        >
          Fetching your OpenGrad workspace&hellip;
        </p>
      </div>
    </div>
  );
}
