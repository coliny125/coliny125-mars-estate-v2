# Mars Estate Dashboard — Session Notes

## What This Is
A cloud-ready Next.js 14 operations dashboard for Mars Estate, a Napa Valley winery on Howell Mountain. Rebuilt from scratch to replace a local-only version.

**Live URL:** https://mars-estate-v2.vercel.app  
**GitHub:** https://github.com/coliny125/coliny125-mars-estate-v2  
**Local:** `~/mars-estate-v2`

---

## Stack
- **Framework:** Next.js 14 (App Router), TypeScript
- **Styling:** Tailwind CSS with custom design tokens
- **Auth:** Clerk v5 (`@clerk/nextjs`)
- **Storage:** Vercel KV (Upstash Redis) via `@vercel/kv`
- **AI:** Anthropic Claude API (`claude-sonnet-4-6`)
- **Deployment:** Vercel, team `mars-estate`

### Design tokens (from original app)
| Name | Value |
|------|-------|
| `ink-800` | `rgb(21 17 15)` — page background |
| `ink-700` | `rgb(28 23 20)` — panel surface |
| `parchment-100` | `rgb(244 238 226)` — primary text |
| `parchment-500` | `rgb(138 125 99)` — muted text |
| `brass-500` | `rgb(176 141 87)` — accent / gold |
| `oxblood-500` | `rgb(122 34 34)` — risk / danger |
| Font | Cormorant Garamond (via `next/font/google`) |

---

## What's Built

### Pages
| Route | Description |
|-------|-------------|
| `/` | Main dashboard — 4 panels + ChatBar + footer |
| `/chat` | Full chat interface with thread sidebar |
| `/sign-in` | Clerk sign-in with branded appearance |

### Dashboard Panels
1. **Communications (Panel 01)** — AI-synthesized briefing from Gmail. Shows decisions, risks, opportunities, updates. Mark-handled UX. "Connect Gmail" button when not connected. "Reload" triggers a fresh Claude synthesis.
2. **Immediate To-dos (Panel 02)** — CRUD todos stored in KV. Priority groups: High / Medium / Ongoing. Add inline, toggle done, delete.
3. **Research & News (Panel 03)** — On-demand Claude research against a configurable focus list. "Research now" triggers agent.
4. **Growth Metrics (Panel 04)** — Intentional placeholder (Klaviyo, Offset Commerce, etc. — not wired yet).

### API Routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/briefing` | GET | Load latest briefing from KV |
| `/api/briefing` | POST | Trigger manual sync (calls `lib/sync.ts` directly) |
| `/api/briefing/[id]` | PATCH | Toggle handled state, persists to KV |
| `/api/todos` | GET/POST | List / add todos |
| `/api/todos/[id]` | PATCH/DELETE | Update / delete todo |
| `/api/research` | GET/POST | Load / run research agent |
| `/api/research/focus` | PUT | Save focus topics |
| `/api/chat/threads` | GET/POST | List / create chat threads |
| `/api/chat/threads/[id]` | GET/DELETE | Load / delete thread |
| `/api/chat/send` | POST | Streaming chat (SSE), tool use for add_todo |
| `/api/auth/gmail` | GET | OAuth redirect to Google |
| `/api/auth/gmail/callback` | GET | Exchange code → store tokens in KV |
| `/api/auth/gmail/status` | GET | `{ connected: bool }` |
| `/api/cron/sync` | POST | Vercel Cron target (protected by CRON_SECRET) |
| `/api/health` | GET | Returns Claude API status |

### Key Library Files
| File | Purpose |
|------|---------|
| `lib/storage.ts` | KV-backed todos + chat threads (in-memory fallback without KV) |
| `lib/sync.ts` | Core briefing sync: fetches Gmail → runs Claude → stores to KV |
| `lib/gmail.ts` | Gmail OAuth token management + Gmail API fetch (thread list) |
| `lib/date.ts` | `relativeTime()`, `todayLong()` utilities |
| `middleware.ts` | Clerk auth — protects all page routes, API routes are public |

---

## Infrastructure

### Vercel Project
- **Project ID:** `prj_QCPMVM7encGncVDpqrcS6E3rKXL9`
- **Team:** `mars-estate` (`team_bscov8LX94bNlpnPS2Asrqg7`)
- **Token:** `vca_3EDtQxCDJK7ylO0vcFm37c9fPJwRPeYL0JkH4OHWMDJ7xE88Dx29qqfY`
- **Cron:** Every 15 minutes → `POST /api/cron/sync` (defined in `vercel.json`)

### KV Store (Upstash Redis)
- **URL:** `https://dear-griffon-138847.upstash.io`
- Keys in use:
  - `todos` — Redis hash, field = todo ID, value = JSON todo object
  - `threads:index` — Redis set of thread IDs
  - `thread:<id>` — Full thread object with messages
  - `briefing:latest` — Latest `StoredBriefing` object
  - `gmail:tokens` — `{ access_token, refresh_token, expiry }`

### Env Vars (all set in Vercel)
```
ANTHROPIC_API_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
KV_REST_API_URL
KV_REST_API_TOKEN
KV_REST_API_READ_ONLY_TOKEN
KV_URL
REDIS_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://mars-estate-v2.vercel.app/api/auth/gmail/callback
CRON_SECRET
```
All of the above are also in `~/mars-estate-v2/.env.local` for local dev.

### GitHub
- **Repo:** `coliny125/coliny125-mars-estate-v2`
- **SSH key:** generated at `~/.ssh/id_ed25519`, registered with GitHub
- **CI/CD:** Vercel linked to main branch — every `git push origin main` auto-deploys to production

---

## Current State of Each Feature

### ✅ Done and working
- All 4 dashboard panels rendering
- Todos: full CRUD, persisted in KV, seeded with 18 real action items from emails + Granola
- Chat: streaming, thread history, `add_todo` tool use wired
- Clerk auth: sign-in page, middleware, UserButton in header
- Vercel cron: fires every 15 min, calls `runSync()`
- Briefing Reload button: calls Claude directly (no self-fetch), returns in ~5s
- Gmail OAuth flow: routes built and deployed

### ⏳ Needs one action from user
- **Connect Gmail:** click "Connect Gmail" on the dashboard → authorize read-only Gmail access → briefing will start using real inbox. The OAuth app is in Google "Testing" mode — make sure `colinyuan@marscap.investments` is added as a test user in Google Cloud Console → APIs & Services → OAuth consent screen → Test users.

### 🔲 Not started
- **Gmail → auto todo extraction:** after connecting Gmail, could expand the cron to also upsert new action-item todos from emails (currently only briefing items are generated)
- **Growth Metrics panel:** wire Klaviyo (mailing list), Offset Commerce (DTC orders) — needs API keys
- **Notion:** decided not to use (todos live in KV instead)
- **Granola:** no cloud API — meeting notes only accessible locally via MCP. Cloud briefing uses Claude analysis only.
- **Clerk user management:** currently anyone who signs up gets access. Could restrict to specific emails via Clerk's allowlist if needed.

---

## How to Deploy / Develop

### Local dev
```bash
cd ~/mars-estate-v2
npm run dev        # runs on localhost:3000
```

### Push and deploy
```bash
git add -A
git commit -m "your message"
git push origin main   # triggers Vercel auto-deploy
```

### Manual Vercel deploy (if needed)
```bash
export VERCEL_TOKEN="vca_3EDtQxCDJK7ylO0vcFm37c9fPJwRPeYL0JkH4OHWMDJ7xE88Dx29qqfY"
vercel deploy --token "$VERCEL_TOKEN" --yes --scope mars-estate --prod
```

### Seed todos from emails/Granola (run from Claude session with MCP access)
The todo seeding script is a Python one-liner that hits the Upstash REST API directly. Can be re-run any time to add new items. The script used `HSET todos <id> <json>` for each item.

---

## Key Decisions Made
- **Todos in KV, not Notion** — simpler, no third-party dependency, AI can upsert directly
- **Briefing via Claude synthesis, not raw email passthrough** — summarizes 30+ threads into 4–7 actionable items
- **Granola = local only** — no cloud API exists; MCP works in Claude sessions but not deployed app
- **Superhuman = Gmail OAuth** — Superhuman sits on top of Gmail; same inbox, cloud-accessible
- **Self-fetch removed** — briefing POST previously called `/api/cron/sync` via HTTP (caused 500); fixed by importing `runSync()` directly from `lib/sync.ts`
- **API routes are public in middleware** — Clerk protects page routes only; API routes rely on client-side auth context
