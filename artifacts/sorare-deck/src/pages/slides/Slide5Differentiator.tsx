export default function Slide5Differentiator() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{
        backgroundColor: "#FFFFFF",
        fontFamily: "'Inter', sans-serif",
        boxSizing: "border-box",
        padding: "5vh 5vw",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "7vh" }}>
        <div style={{ position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: "-1vw",
              top: "1.5vh",
              width: "17vw",
              height: "3vh",
              backgroundColor: "#0A1628",
              opacity: 0.08,
              zIndex: 0,
            }}
          />
          <h2
            style={{
              fontSize: "3.5vw",
              fontWeight: 900,
              color: "#0A1628",
              margin: 0,
              lineHeight: 1,
              letterSpacing: "-0.03em",
              position: "relative",
              zIndex: 1,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Key Differentiator
          </h2>
        </div>
        <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#0A1628", letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif" }}>
          Sorare Companion
        </div>
      </div>

      <div style={{ display: "flex", gap: "4vw", flex: 1, paddingBottom: "10vh" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4vh" }}>
          <p style={{ fontSize: "1.8vw", fontWeight: 500, color: "#4A5568", lineHeight: 1.5, margin: 0 }}>
            Unlike browsing Sorare directly, this app unites tournament context with fantasy performance in one purpose-built tool.
          </p>

          <div style={{ width: "100%", height: "1px", backgroundColor: "#E2E8F0" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: "2.5vh" }}>
            <div style={{ display: "flex", gap: "3vw", alignItems: "center" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", color: "#A0AEC0", width: "14vw", flexShrink: 0 }}>Sorare platform</div>
              <div style={{ flex: 1, height: "1px", backgroundColor: "#E2E8F0" }} />
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.1vw", color: "#0A1628", width: "14vw", flexShrink: 0, textAlign: "right" }}>Sorare Companion</div>
            </div>

            <div style={{ display: "flex", gap: "3vw", alignItems: "center" }}>
              <div style={{ fontSize: "1.3vw", color: "#4A5568", width: "14vw", flexShrink: 0 }}>Card trading focus</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0", flexShrink: 0 }}>vs</div>
              <div style={{ flex: 1, height: "1px", backgroundColor: "#E2E8F0", margin: "0 1vw" }} />
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0", flexShrink: 0 }}>→</div>
              <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#0A1628", width: "14vw", flexShrink: 0, textAlign: "right" }}>WC scouting focus</div>
            </div>

            <div style={{ display: "flex", gap: "3vw", alignItems: "center" }}>
              <div style={{ fontSize: "1.3vw", color: "#4A5568", width: "14vw", flexShrink: 0 }}>Stats without context</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0", flexShrink: 0 }}>vs</div>
              <div style={{ flex: 1, height: "1px", backgroundColor: "#E2E8F0", margin: "0 1vw" }} />
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0", flexShrink: 0 }}>→</div>
              <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#0A1628", width: "14vw", flexShrink: 0, textAlign: "right" }}>Stats + fixture schedule</div>
            </div>

            <div style={{ display: "flex", gap: "3vw", alignItems: "center" }}>
              <div style={{ fontSize: "1.3vw", color: "#4A5568", width: "14vw", flexShrink: 0 }}>Generic player browse</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0", flexShrink: 0 }}>vs</div>
              <div style={{ flex: 1, height: "1px", backgroundColor: "#E2E8F0", margin: "0 1vw" }} />
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0", flexShrink: 0 }}>→</div>
              <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#0A1628", width: "14vw", flexShrink: 0, textAlign: "right" }}>National team rosters</div>
            </div>

            <div style={{ display: "flex", gap: "3vw", alignItems: "center" }}>
              <div style={{ fontSize: "1.3vw", color: "#4A5568", width: "14vw", flexShrink: 0 }}>Solo play only</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0", flexShrink: 0 }}>vs</div>
              <div style={{ flex: 1, height: "1px", backgroundColor: "#E2E8F0", margin: "0 1vw" }} />
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0", flexShrink: 0 }}>→</div>
              <div style={{ fontSize: "1.3vw", fontWeight: 700, color: "#0A1628", width: "14vw", flexShrink: 0, textAlign: "right" }}>Private draft leagues</div>
            </div>
          </div>
        </div>

        <div style={{ width: "24vw", backgroundColor: "#0A1628", padding: "4vh 2.5vw", display: "flex", flexDirection: "column", justifyContent: "center", gap: "3vh" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0", fontWeight: 500, letterSpacing: "0.08em" }}>
            PURPOSE-BUILT FOR
          </div>
          <div style={{ fontSize: "5vw", fontWeight: 900, color: "#FFFFFF", lineHeight: 1, letterSpacing: "-0.04em" }}>
            WC 2026
          </div>
          <p style={{ fontSize: "1.3vw", color: "#E2E8F0", lineHeight: 1.5, margin: 0 }}>
            Every feature is designed around the tournament calendar, not generic fantasy play.
          </p>
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
        borderTop: "1px solid #E2E8F0",
        paddingTop: "2vh",
      }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0" }}>
          Key Differentiator / Sorare Companion
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0A1628", fontWeight: 600 }}>
          05
        </div>
      </div>
    </div>
  );
}
