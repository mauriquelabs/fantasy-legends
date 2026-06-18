export default function Slide3Features() {
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6vh" }}>
        <div style={{ position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: "-1vw",
              top: "1.5vh",
              width: "9vw",
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
            Features
          </h2>
        </div>
        <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#0A1628", letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif" }}>
          Sorare Companion
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2vw", flex: 1, paddingBottom: "11vh" }}>
        <div style={{ border: "1px solid #E2E8F0", padding: "3.5vh 2.5vw", display: "flex", flexDirection: "column", gap: "1.5vh" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0", fontWeight: 500, letterSpacing: "0.05em" }}>
            01 — SQUADS
          </div>
          <h3 style={{ fontSize: "1.8vw", fontWeight: 800, color: "#0A1628", margin: 0, letterSpacing: "-0.02em" }}>World Cup Squads</h3>
          <p style={{ fontSize: "1.3vw", color: "#4A5568", lineHeight: 1.5, margin: 0 }}>
            All 48 nations by confederation. Each player shows a 15-game SO5 average and a sparkline of their last 5 scores. Squads are fully editable.
          </p>
        </div>

        <div style={{ border: "1px solid #E2E8F0", padding: "3.5vh 2.5vw", display: "flex", flexDirection: "column", gap: "1.5vh" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0", fontWeight: 500, letterSpacing: "0.05em" }}>
            02 — FIXTURES
          </div>
          <h3 style={{ fontSize: "1.8vw", fontWeight: 800, color: "#0A1628", margin: 0, letterSpacing: "-0.02em" }}>Fixtures & Standings</h3>
          <p style={{ fontSize: "1.3vw", color: "#4A5568", lineHeight: 1.5, margin: 0 }}>
            Full WC 2026 schedule via football-data.org — rounds, kickoff times, live scores, and group tables. Click any team to open their squad inline.
          </p>
        </div>

        <div style={{ border: "1px solid #E2E8F0", padding: "3.5vh 2.5vw", display: "flex", flexDirection: "column", gap: "1.5vh" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0", fontWeight: 500, letterSpacing: "0.05em" }}>
            03 — SCOUTING
          </div>
          <h3 style={{ fontSize: "1.8vw", fontWeight: 800, color: "#0A1628", margin: 0, letterSpacing: "-0.02em" }}>Player Scouting</h3>
          <p style={{ fontSize: "1.3vw", color: "#4A5568", lineHeight: 1.5, margin: 0 }}>
            Ranked list of popular Sorare players. Filter by position or club, search by name, and deep-link directly to the Sorare marketplace.
          </p>
        </div>

        <div style={{ backgroundColor: "#0A1628", padding: "3.5vh 2.5vw", display: "flex", flexDirection: "column", gap: "1.5vh" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0", fontWeight: 500, letterSpacing: "0.05em" }}>
            04 — LEAGUES
          </div>
          <h3 style={{ fontSize: "1.8vw", fontWeight: 800, color: "#FFFFFF", margin: 0, letterSpacing: "-0.02em" }}>Private Draft Leagues</h3>
          <p style={{ fontSize: "1.3vw", color: "#E2E8F0", lineHeight: 1.5, margin: 0 }}>
            Create invite-only leagues, draft national team squads with friends, and compete across the full WC 2026 tournament.
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
          Features / Sorare Companion
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0A1628", fontWeight: 600 }}>
          03
        </div>
      </div>
    </div>
  );
}
