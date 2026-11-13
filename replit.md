# Fantasy Legends (Sorare Companion)

Competition-scoped Sorare fantasy companion. World Cup 2026 is the seeded default competition; APIs and UI are parameterized by competition code.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (port **3001**)
- `pnpm --filter @workspace/sorare-companion run dev` — frontend (Vite; proxies `/api` → 3001)
- `pnpm run typecheck` / `pnpm run build`
- `pnpm run db:migrate` — apply Drizzle migrations (required after pull)
- Required env: `DATABASE_URL`; auth needs Supabase keys; standings need `FOOTBALL_DATA_API_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 · DB: PostgreSQL + Drizzle · Frontend: React 19 + Vite + Wouter

## Where things live

- Schema: `lib/db/src/schema/index.ts`
- Competition API: `artifacts/api-server/src/routes/competitions.ts` (`/api/competitions/:code/*`; `/api/world-cup/*` aliases WC)
- Rosters: `artifacts/api-server/src/data/competition-rosters.ts`
- Frontend hub: `/c/:code/*` in `artifacts/sorare-companion`

## Architecture decisions

- Competitions are first-class; sync deletes only `competition_teams` membership for that competition (never global team wipe).
- Fantasy leagues require `competitionId`.
- Club leagues / other sports are later phases (adapters), not schema rewrites.

## Gotchas

- Run `pnpm run db:migrate` after pulling competition config migration `0011`.
- Adding a new football tournament: insert a `competitions` row + roster in `competition-rosters.ts`, then `POST /api/competitions/:code/sync`.
