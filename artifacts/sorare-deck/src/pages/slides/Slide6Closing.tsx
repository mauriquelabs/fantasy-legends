export default function Slide6Closing() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{
        backgroundColor: "#0A1628",
        fontFamily: "'Inter', sans-serif",
        boxSizing: "border-box",
        padding: "5vh 5vw",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10vh" }}>
        <div style={{ fontSize: "1.5vw", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif" }}>
          Sorare Companion
        </div>
        <div style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: "1vw",
          color: "#A0AEC0",
          display: "flex",
          gap: "3vw",
        }}>
          <div>WC 2026 Edition</div>
          <div>In Development</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, textAlign: "center" }}>
        <div style={{ position: "relative", marginBottom: "5vh" }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "42vw",
              height: "10vh",
              backgroundColor: "#FFFFFF",
              opacity: 0.04,
              zIndex: 0,
            }}
          />
          <h2
            style={{
              fontSize: "6vw",
              fontWeight: 900,
              color: "#FFFFFF",
              margin: 0,
              lineHeight: 1,
              letterSpacing: "-0.04em",
              position: "relative",
              zIndex: 1,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Scout Smarter.
          </h2>
        </div>

        <p style={{ fontSize: "1.8vw", color: "#E2E8F0", maxWidth: "50vw", lineHeight: 1.5, margin: "0 0 7vh 0", fontWeight: 400 }}>
          One place to cross-reference national team squads, tournament fixtures, and Sorare SO5 scores — before every WC deadline window.
        </p>

        <div style={{ display: "flex", gap: "4vw", alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0", marginBottom: "1vh" }}>NATIONS COVERED</div>
            <div style={{ fontSize: "4vw", fontWeight: 900, color: "#FFFFFF", letterSpacing: "-0.04em", lineHeight: 1 }}>48</div>
          </div>
          <div style={{ width: "1px", height: "8vh", backgroundColor: "rgba(255,255,255,0.15)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0", marginBottom: "1vh" }}>CORE FEATURES</div>
            <div style={{ fontSize: "4vw", fontWeight: 900, color: "#FFFFFF", letterSpacing: "-0.04em", lineHeight: 1 }}>4</div>
          </div>
          <div style={{ width: "1px", height: "8vh", backgroundColor: "rgba(255,255,255,0.15)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0", marginBottom: "1vh" }}>DATA SOURCES</div>
            <div style={{ fontSize: "4vw", fontWeight: 900, color: "#FFFFFF", letterSpacing: "-0.04em", lineHeight: 1 }}>2</div>
          </div>
        </div>
      </div>

      <div style={{
        position: "absolute",
        bottom: "5vh",
        left: "5vw",
        right: "5vw",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderTop: "1px solid rgba(255,255,255,0.15)",
        paddingTop: "2vh",
      }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0" }}>
          Sorare Companion / FIFA World Cup 2026
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#FFFFFF", fontWeight: 600 }}>
          06
        </div>
      </div>
    </div>
  );
}
