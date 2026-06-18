export default function Slide2Problem() {
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
              width: "11vw",
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
            The Gap
          </h2>
        </div>
        <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#0A1628", letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif" }}>
          Sorare Companion
        </div>
      </div>

      <div style={{ display: "flex", gap: "5vw", flex: 1, paddingBottom: "10vh" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3.5vh" }}>
          <p style={{ fontSize: "1.8vw", fontWeight: 500, color: "#4A5568", lineHeight: 1.5, margin: 0 }}>
            Sorare players preparing for WC 2026 juggle two separate worlds — tournament context and fantasy card data — with no single place to reconcile them.
          </p>

          <div style={{ width: "100%", height: "1px", backgroundColor: "#E2E8F0" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: "3vh" }}>
            <div style={{ display: "flex", gap: "2vw" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.2vw", color: "#A0AEC0", fontWeight: 600, flexShrink: 0 }}>01</div>
              <div>
                <h3 style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", margin: "0 0 0.8vh 0" }}>Fragmented research</h3>
                <p style={{ fontSize: "1.2vw", color: "#4A5568", lineHeight: 1.5, margin: 0 }}>
                  Fixture schedules, group standings, and SO5 scores live on different platforms with no unified view.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "2vw" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.2vw", color: "#A0AEC0", fontWeight: 600, flexShrink: 0 }}>02</div>
              <div>
                <h3 style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", margin: "0 0 0.8vh 0" }}>48 nations, no roadmap</h3>
                <p style={{ fontSize: "1.2vw", color: "#4A5568", lineHeight: 1.5, margin: 0 }}>
                  Evaluating all qualified nations requires manual cross-referencing across Sorare, football-data sites, and confederation pages.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "2vw" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.2vw", color: "#A0AEC0", fontWeight: 600, flexShrink: 0 }}>03</div>
              <div>
                <h3 style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", margin: "0 0 0.8vh 0" }}>Card investment blind spots</h3>
                <p style={{ fontSize: "1.2vw", color: "#4A5568", lineHeight: 1.5, margin: 0 }}>
                  Without fixture context, SO5 averages alone don't reveal which players have favourable group-stage schedules.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ width: "28vw", backgroundColor: "#F7FAFC", border: "1px solid #E2E8F0", padding: "4vh 2.5vw", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#718096", marginBottom: "2.5vh" }}>
            The result
          </div>
          <p style={{ fontSize: "2vw", fontWeight: 800, color: "#0A1628", lineHeight: 1.25, margin: 0, letterSpacing: "-0.02em" }}>
            "Hours of scouting work before every WC deadline window."
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
          The Gap / Sorare Companion
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0A1628", fontWeight: 600 }}>
          02
        </div>
      </div>
    </div>
  );
}
