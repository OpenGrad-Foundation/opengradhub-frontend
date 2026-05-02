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
          background: "rgba(255,255,255,0.7)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "24px",
          padding: "40px 48px",
          textAlign: "center",
          boxShadow: "0 32px 64px rgba(0,0,0,0.1)",
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
