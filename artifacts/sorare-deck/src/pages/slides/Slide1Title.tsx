export default function Slide1Title() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{
        backgroundColor: "#FFFFFF",
        fontFamily: "'Inter', sans-serif",
        boxSizing: "border-box",
        padding: "5vh 5vw",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: "1.5vw", fontWeight: 800, color: "#0A1628", letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif" }}>
          Sorare Companion
        </div>
        <div style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: "1vw",
          color: "#4A5568",
          display: "flex",
          flexDirection: "column",
          gap: "0.8vh",
          textAlign: "right",
        }}>
          <div><span style={{ color: "#A0AEC0", marginRight: "1vw" }}>Product:</span>Fantasy Football Tool</div>
          <div><span style={{ color: "#A0AEC0", marginRight: "1vw" }}>Tournament:</span>FIFA World Cup 2026</div>
          <div><span style={{ color: "#A0AEC0", marginRight: "1vw" }}>Audience:</span>Sorare Players</div>
          <div><span style={{ color: "#A0AEC0", marginRight: "1vw" }}>Status:</span>In Development</div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: "15vh", left: "5vw", width: "90vw" }}>
        <div style={{ position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: "-2vw",
              top: "2vh",
              width: "32vw",
              height: "5vh",
              backgroundColor: "#0A1628",
              opacity: 0.08,
              zIndex: 0,
            }}
          />
          <h1
            style={{
              fontSize: "8vw",
              fontWeight: 900,
              color: "#0A1628",
              margin: 0,
              lineHeight: 1,
              letterSpacing: "-0.04em",
              position: "relative",
              zIndex: 1,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Sorare Companion
          </h1>
        </div>

        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginTop: "6vh",
        }}>
          <p style={{
            fontSize: "1.8vw",
            fontWeight: 500,
            color: "#4A5568",
            margin: 0,
            maxWidth: "52vw",
            lineHeight: 1.4,
            fontFamily: "'Inter', sans-serif",
          }}>
            Tournament intelligence for Sorare fantasy football — bridging WC 2026 fixtures with SO5 card performance data.
          </p>
          <div style={{ width: "28vw", height: "1px", backgroundColor: "#E2E8F0" }} />
        </div>
      </div>
    </div>
  );
}
