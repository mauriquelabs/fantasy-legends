export default function Slide4TechStack() {
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
              width: "10vw",
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
            Tech Stack
          </h2>
        </div>
        <div style={{ fontSize: "1.2vw", fontWeight: 800, color: "#0A1628", letterSpacing: "-0.02em", fontFamily: "'Inter', sans-serif" }}>
          Sorare Companion
        </div>
      </div>

      <div style={{ display: "flex", gap: "5vw", flex: 1, paddingBottom: "10vh" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "3vh", flex: 1 }}>
          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.2vw", color: "#A0AEC0", fontWeight: 600, flexShrink: 0 }}>FE</div>
            <div>
              <h3 style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", margin: "0 0 0.6vh 0" }}>Frontend</h3>
              <p style={{ fontSize: "1.2vw", color: "#4A5568", lineHeight: 1.5, margin: 0 }}>
                React 19 + Vite, Tailwind CSS 4, TanStack Query, Framer Motion, wouter routing, Radix UI
              </p>
            </div>
          </div>

          <div style={{ width: "100%", height: "1px", backgroundColor: "#E2E8F0" }} />

          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.2vw", color: "#A0AEC0", fontWeight: 600, flexShrink: 0 }}>BE</div>
            <div>
              <h3 style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", margin: "0 0 0.6vh 0" }}>Backend</h3>
              <p style={{ fontSize: "1.2vw", color: "#4A5568", lineHeight: 1.5, margin: 0 }}>
                Node.js + Express 5, PostgreSQL via Supabase, Drizzle ORM, Zod validation, Pino logging
              </p>
            </div>
          </div>

          <div style={{ width: "100%", height: "1px", backgroundColor: "#E2E8F0" }} />

          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.2vw", color: "#A0AEC0", fontWeight: 600, flexShrink: 0 }}>API</div>
            <div>
              <h3 style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", margin: "0 0 0.6vh 0" }}>External APIs</h3>
              <p style={{ fontSize: "1.2vw", color: "#4A5568", lineHeight: 1.5, margin: 0 }}>
                Sorare GraphQL API for card stats, football-data.org for live fixtures and standings
              </p>
            </div>
          </div>

          <div style={{ width: "100%", height: "1px", backgroundColor: "#E2E8F0" }} />

          <div style={{ display: "flex", gap: "2vw", alignItems: "flex-start" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.2vw", color: "#A0AEC0", fontWeight: 600, flexShrink: 0 }}>DX</div>
            <div>
              <h3 style={{ fontSize: "1.5vw", fontWeight: 700, color: "#0A1628", margin: "0 0 0.6vh 0" }}>Developer Experience</h3>
              <p style={{ fontSize: "1.2vw", color: "#4A5568", lineHeight: 1.5, margin: 0 }}>
                TypeScript monorepo with pnpm workspaces, Vitest, Supertest, shared Zod types across API and frontend
              </p>
            </div>
          </div>
        </div>

        <div style={{ width: "28vw", display: "flex", flexDirection: "column", gap: "2vh" }}>
          <div style={{ backgroundColor: "#F7FAFC", border: "1px solid #E2E8F0", padding: "3vh 2.5vw", flex: 1 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0", fontWeight: 500, letterSpacing: "0.08em", marginBottom: "2vh" }}>
              ARCHITECTURE
            </div>
            <p style={{ fontSize: "1.4vw", fontWeight: 700, color: "#0A1628", lineHeight: 1.4, margin: 0, letterSpacing: "-0.01em" }}>
              Single monorepo. Shared types. One source of truth from API contract to rendered UI.
            </p>
          </div>
          <div style={{ border: "1px solid #E2E8F0", padding: "3vh 2.5vw" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0", fontWeight: 500, letterSpacing: "0.08em", marginBottom: "2vh" }}>
              AUTH
            </div>
            <p style={{ fontSize: "1.3vw", color: "#4A5568", lineHeight: 1.5, margin: 0 }}>
              Supabase Auth with magic-link email, session management, and row-level security
            </p>
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
        borderTop: "1px solid #E2E8F0",
        paddingTop: "2vh",
      }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#A0AEC0" }}>
          Tech Stack / Sorare Companion
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1vw", color: "#0A1628", fontWeight: 600 }}>
          04
        </div>
      </div>
    </div>
  );
}
