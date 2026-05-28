# Mars Estate v2 — Remaining Tasks

## 1. GitHub + Vercel CI/CD  `[✓]`
- Repo: github.com/coliny125/coliny125-mars-estate-v2
- SSH key generated and registered
- Vercel auto-deploy connected to main branch
- Every `git push origin main` now triggers a Vercel production deploy

---

## 2. Persistent Storage  `[~]`
Code is fully implemented. Needs the KV store provisioned (one-time setup).
- **Action needed from user:**
  1. Go to vercel.com/mars-estate/mars-estate-v2 → **Storage** tab
  2. Create Database → **KV** → name it `mars-estate-kv`
  3. Connect it to this project
  4. Vercel auto-adds KV_REST_API_URL + KV_REST_API_TOKEN — no manual env setup
- Until then, falls back to in-memory (resets on cold start)

---

## 3. Live Data Integrations  `[ ]`

### 3a. Notion Todos  `[ ]`
- **Action needed from user:**
  - Notion integration token (notion.so/my-integrations → New integration)
  - Notion database ID for todos (32-char hex in the URL)
- Plan: `@notionhq/client` in `/api/todos` routes

### 3b. Superhuman Mail  `[ ]`
- No cloud API. Options:
  - **Option A:** Gmail OAuth (reads same inbox Superhuman uses) — fully cloud
  - **Option B:** Keep AI briefing + add paste-thread flow for real citations
- **Waiting for:** user decision

### 3c. Granola Meeting Notes  `[ ]`
- No public cloud API
- **Waiting for:** confirm cloud briefing uses Claude analysis only (no live Granola)

---

## 4. Clerk Auth  `[✓]`
- Middleware protects all routes
- /sign-in with branded appearance
- UserButton in dashboard header
- All env vars set in Vercel

---

## Done ✓
- [x] Next.js 14, Tailwind, all 4 panels, /chat, ChatBar, API routes
- [x] ANTHROPIC_API_KEY in Vercel
- [x] Deployed: https://mars-estate-v2.vercel.app
- [x] Clerk auth (middleware + sign-in + UserButton)
- [x] Vercel KV storage layer — code ready, store needs provisioning
- [x] GitHub repo pushed + linked to Vercel for auto-deploy
