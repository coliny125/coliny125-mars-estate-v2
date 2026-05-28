# Mars Estate v2 — Remaining Tasks

## 1. GitHub Repo  `[ ]`
Connect the local repo to GitHub so Vercel auto-deploys on push.
- **Blocker:** current PAT lacks `repo:create` scope
- **Action needed from user:** create `coliny125/mars-estate-v2` on github.com manually, then we push

---

## 2. Persistent Storage  `[ ]`
Replace in-memory store (resets on Vercel cold start) with real DB.
- **Plan:** provision Vercel KV (Redis) — free tier, zero-config on Vercel
- **What persists:** todos, chat threads, handled-state on briefing items
- **Action needed from user:** none — I can provision via Vercel CLI with existing token

Sub-tasks:
- [ ] Provision KV via `vercel kv add`
- [ ] Install `@vercel/kv` package
- [ ] Replace `lib/storage.ts` in-memory Maps with KV calls
- [ ] Redeploy

---

## 3. Live Data Integrations  `[ ]`

### 3a. Notion Todos  `[ ]`
Replace local add/list logic with real Notion database.
- **Action needed from user:**
  - Notion integration token (from notion.so/my-integrations)
  - Notion database ID for your todos (share the database with the integration)
- **Plan:** call Notion API from `/api/todos` routes using `@notionhq/client`

### 3b. Superhuman Mail (Communications panel)  `[ ]`
- **Reality check:** Superhuman has no cloud API. The original local version used an MCP server running on your Mac. For the cloud app, two options:
  1. **Recommended:** Use Claude to summarize/analyze emails that you paste or forward into the app
  2. **Alternative:** Connect Gmail via OAuth (Superhuman sits on top of Gmail — we can read the same inbox via Google OAuth)
- **Action needed from user:** confirm approach (Gmail OAuth vs. paste-to-brief)

### 3c. Granola Meeting Notes  `[ ]`
- **Reality check:** Granola has no public cloud API either (MCP only works locally).
- **Plan:** Use Granola's MCP locally in dev, or accept that the cloud briefing uses Claude's analysis only
- **Action needed from user:** confirm acceptable fallback

---

## 4. Clerk Auth  `[ ]`
Gate the dashboard behind Clerk authentication.
- **Action needed from user:**
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (from dashboard.clerk.com)
  - `CLERK_SECRET_KEY`
- **Plan:** install `@clerk/nextjs`, wrap layout with ClerkProvider, add middleware, add sign-in page

Sub-tasks:
- [ ] Get Clerk keys from user
- [ ] Install `@clerk/nextjs`
- [ ] Add ClerkProvider to layout
- [ ] Add middleware.ts to protect all routes
- [ ] Add sign-in/sign-out UI to header
- [ ] Add CLERK_* env vars to Vercel project
- [ ] Redeploy

---

## Done ✓
- [x] Next.js 14 app scaffolded at ~/mars-estate-v2
- [x] All 4 dashboard panels built (Communications, Todos, Research, Growth Metrics)
- [x] /chat page with thread sidebar + streaming Claude responses
- [x] ChatBar on dashboard
- [x] All API routes (/api/briefing, /api/todos, /api/research, /api/chat/*)
- [x] ANTHROPIC_API_KEY wired in Vercel
- [x] Deployed to https://mars-estate-v2.vercel.app
