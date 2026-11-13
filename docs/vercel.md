# Vercel setup (Fantasy Legends / Sorare Companion)

Git-linked previews for the **web UI**. Production traffic can stay on Replit until the API is migrated.

## Architecture choice

| Piece | Vercel shape | Notes |
| --- | --- | --- |
| Frontend (`artifacts/sorare-companion`) | One Git-linked project, Root Directory `artifacts/sorare-companion`, framework **Vite** | SPA rewrites in `artifacts/sorare-companion/vercel.json`. Workspace install from monorepo root. |
| API (`artifacts/api-server`) | **Not** deployed as-is on Vercel yet | Express listens with `PORT` + in-process `node-cron`. Ephemeral serverless / scale-to-zero will not run cron reliably. Keep API on Replit (or adapt later). |

**Not chosen for day one:** a single project that wraps Express as a serverless function with frontend rewrites. That needs an export-without-`listen` adapter, Fluid Compute tuning, and replacing `node-cron` with [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs).

**Follow-up (optional second project `fantasy-legends-api`):** serverless/Fluid Express handler + `vercel.json` `crons` calling sync routes; or a container Function (`Dockerfile.vercel`) if a long-lived Node process is required. Until then, preview URLs exercise the UI; `/api/*` still needs a live API host (local, Replit, or future Vercel API).

## Project settings (dashboard / `create_git_project`)

- **Repo:** `mauriquelabs/fantasy-legends`
- **Suggested name:** `fantasy-legends`
- **Root Directory:** `artifacts/sorare-companion`
- **Install / Build / Output:** see `artifacts/sorare-companion/vercel.json`
- **Production branch:** `main` (every other branch / PR gets a Preview URL via Git integration)

Replit (`.replit` autoscale) is unchanged.

## Environment variables

Set in **Project → Settings → Environment Variables** for **Preview** and **Production** (and Development if using `vercel env pull`). Values are secrets — do not invent them; copy from Replit / Supabase.

### Frontend project (`fantasy-legends`)

| Variable | Required | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes (auth UI) | Baked at **build** time. Redeploy after changes. |
| `VITE_SUPABASE_ANON_KEY` | Yes (auth UI) | Public anon key only. Redeploy after changes. |

### Future API project / Replit (not in frontend build)

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string |
| `SUPABASE_URL` | Yes | Server admin client |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Sensitive** — never `VITE_` / client |
| `FOOTBALL_DATA_API_KEY` | For standings sync | football-data.org |
| `APP_URL` | Optional | Invite / origin fallbacks |
| `PORT` | Yes on long-running host | Required by `api-server` listen path; not applicable to pure static frontend |

CLI (after linking): `vercel env add <NAME>` per environment. MCP `create_project_env` requires a real `value` — prefer the dashboard for secrets.

## Verify PR previews

1. Link the GitHub repo and ensure the Vercel GitHub app can access `mauriquelabs`.
2. Open or push a PR (e.g. #27). Vercel should comment with a Preview URL.
3. Confirm the static shell loads. API-backed pages need a reachable `/api` backend (proxy today only works in Vite dev → `localhost:3001`).
