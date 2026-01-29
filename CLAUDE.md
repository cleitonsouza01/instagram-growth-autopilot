# CLAUDE.md — Platform Growth Autopilot

> This file defines the canonical patterns, conventions, and constraints
> that every agent (human or AI) must follow when working in this repository.

## Project Identity

- **Name**: Platform Growth Autopilot
- **Type**: Chrome Extension (Manifest V3)
- **Stack**: TypeScript · React 18 · Vite (via WXT framework) · Tailwind CSS v4 · Dexie.js
- **Target**: Chromium-based browsers (Chrome, Edge, Brave, Arc)
- **License**: TBD

---

## Architecture Principles

### 1. Client-Side Only
All automation runs in the user's browser. There is **no backend server**.
The extension uses the user's existing Platform session cookies — it never
stores, transmits, or requests Platform credentials.

### 2. Manifest V3 First
We use Chrome Manifest V3 exclusively. No MV2 fallbacks. Key implications:
- Background logic lives in a **service worker** (no DOM access).
- No remotely-hosted code — everything ships in the extension bundle.
- `declarativeNetRequest` instead of `webRequest` where applicable.
- Service workers are ephemeral — persist state to `chrome.storage` or IndexedDB.

### 3. Separation of Concerns
```
src/
├── background/     # Service worker — orchestration, alarms, message routing
├── content/        # Content scripts — injected into platform.com
├── popup/          # Popup UI — React app shown on extension icon click
├── options/        # Options/settings page — React app
├── lib/            # Shared business logic (pure functions, no DOM/chrome deps)
├── api/            # Platform API wrapper layer
├── storage/        # chrome.storage + Dexie.js abstraction
├── types/          # Shared TypeScript types and interfaces
└── utils/          # Generic utilities (time, math, string helpers)
```

### 4. Message-Passing Architecture
Communication between extension contexts uses `chrome.runtime.sendMessage`
and `chrome.runtime.onMessage`. All messages conform to a typed contract:
```typescript
interface ExtensionMessage<T = unknown> {
  type: string;       // e.g. "ENGAGEMENT_START", "PROSPECT_FETCHED"
  payload: T;
  timestamp: number;
}
```

### 5. Service Worker Lifecycle Awareness
Service workers are ephemeral — they terminate after ~30 seconds of inactivity.
- **All event listeners** must be registered synchronously at the top level of
  the service worker. Never nest listeners inside async functions or callbacks.
- **No global variables** for state — use `chrome.storage.local` or IndexedDB.
- **Replace `setTimeout`/`setInterval`** with `chrome.alarms` (min 30s interval).
- **Re-verify alarms on startup** — alarms may not persist across browser restarts.
- **Heartbeat pattern** for long operations — periodically call a trivial
  `chrome.storage.local.set()` to reset the 30s idle timer.
- **Prepare for cold starts** — every message handler must be prepared to
  reinitialize state from storage before processing.

### 6. Safety-First Automation
Every automated action respects:
- **Daily action limits** (configurable, default 100-500 based on account age)
- **Active hours window** (default 8:00–23:00 user local time)
- **Random delays with jitter** between actions (30s–120s baseline)
- **Automatic pause** on HTTP 429 or action block detection
- **Cooldown periods** after blocks (24–48h auto-resume)

---

## Coding Standards

### TypeScript
- **Strict mode**: `"strict": true` in tsconfig — no exceptions.
- **No `any`**: Use `unknown` + type guards instead of `any`.
- **Explicit return types**: All exported functions must have explicit return types.
- **Enums**: Prefer `as const` objects over TypeScript enums.
- **Barrel exports**: Each module directory has an `index.ts` barrel file.

### React
- **Functional components only** — no class components.
- **Hooks**: Custom hooks in `hooks/` directories, prefixed with `use`.
- **State management**: React Context + `useReducer` for complex state. No Redux.
- **Naming**: PascalCase for components, camelCase for hooks/utilities.
- **File naming**: Component files match component name (e.g., `ProspectList.tsx`).

### CSS / Styling
- **Tailwind CSS v4** for all styling — no CSS modules, no styled-components.
- **Vite plugin**: Use `@tailwindcss/vite` instead of PostCSS-based setup.
- **Design tokens**: Colors, spacing, and typography via CSS `@theme` (v4 syntax).
- **Dark mode**: Support `prefers-color-scheme` via Tailwind `dark:` variants.
- **No inline styles** unless dynamically computed.

### Testing
- **Unit tests**: Vitest — colocated as `*.test.ts` next to source files.
- **E2E tests**: Playwright with CDP for extension-specific flows.
- **Coverage target**: 80%+ on `lib/`, `api/`, `storage/` modules.
- **Naming**: `describe("ModuleName")` → `it("should <behavior>")`.
- **ESLint**: Flat config (`eslint.config.mjs`) with `typescript-eslint` + `eslint-plugin-react`.

### Error Handling
- **Never swallow errors** — always log or propagate.
- **Custom error classes** for domain errors (e.g., `RateLimitError`, `ActionBlockError`).
- **Retry with exponential backoff** for transient API failures.
- **User-facing errors**: Always provide actionable messages in the UI.

---

## Platform API Interaction Rules

### Same-Origin Content Script Architecture
All Platform interactions happen from the **content script** injected into
`platform.com`. Because the content script runs in the page's origin:
- `fetch()` calls to Platform endpoints are **same-origin** — the browser
  automatically includes all cookies (including HttpOnly `sessionid`).
- No `chrome.cookies` API needed. No API keys. No OAuth. No official Graph API.
- We simply make the **same HTTP requests** that Platform's own JavaScript makes.
- This is how Inssist and similar extensions work — they piggyback on the
  user's existing authenticated session.

### CSRF Token
- The only token we need to extract manually is `csrftoken` for the `X-CSRFToken` header.
- This cookie is **NOT HttpOnly** — readable via `document.cookie` in the content script.
- Extract once per session, refresh if a request fails with 403.

### Rate Limiting
- Budget: **200 actions/hour maximum** (Platform's enforced ceiling).
- Our default: far below this — 100–500 actions/day spread across active hours.
- Monitor response status codes for throttle signals.
- On 429: stop all actions, enter cooldown (minimum 1 hour).

### Endpoint Resilience
- Platform rotates internal `doc_id` GraphQL endpoints every 2-4 weeks.
- Abstract all endpoint URLs into a single **endpoint registry** module.
- Include a version/health check on startup to detect endpoint breakage.
- Log all 404/400 responses as potential endpoint rotation signals.
- Design the request layer so endpoint URLs can be updated without code changes
  (store discovered endpoints in `chrome.storage.local`).

### Request Patterns
- All requests made from the content script via `fetch()` (same-origin).
- Always include `X-CSRFToken`, `X-Platform-AJAX`, `X-Requested-With` headers.
- `User-Agent` and cookies are handled automatically by the browser.
- Add random delay (2–5 seconds) between sequential requests.
- Paginate with cursor — never fetch more than one page at a time without delay.
- Implement retry with exponential backoff: 1s → 2s → 4s → 8s → max 60s.

### What We Do NOT Use
- **No official Graph API** — requires app review, business accounts, rate limits.
- **No API keys or OAuth tokens** — the session cookie is all we need.
- **No `chrome.cookies` permission** — same-origin fetch handles cookies.
- **No external servers** — everything runs in the browser.

---

## Data Storage Strategy

### chrome.storage.local
- User settings and preferences.
- Active competitor list.
- Current engagement queue (serialized).
- Daily action counters.

### chrome.storage.sync
- Settings that should sync across devices (theme, active hours).
- Maximum 100KB total — keep payloads small.

### IndexedDB (via Dexie.js)
- Prospect database (profiles fetched from competitors).
- Engagement history log (all actions with timestamps).
- Follower snapshots for growth/unfollower tracking.
- Analytics time-series data.
- Use `navigator.storage.persist()` to prevent eviction.

### Storage Schema Versioning
- Dexie handles schema migrations via version numbers.
- Never delete columns — only add. Mark deprecated fields in types.
- Always test migrations with existing data.

---

## Security Constraints

### Permissions (Minimal)
```json
{
  "permissions": ["storage", "alarms"],
  "host_permissions": ["https://www.platform.com/*", "https://i.platform.com/*"]
}
```
- `host_permissions` grant content script injection on Platform pages.
- Content script `fetch()` calls are same-origin — no extra permissions needed.
- Request only what's needed. No `<all_urls>`, no `tabs`, no `cookies`, no `webRequest`.
- Note: `activeTab` is NOT used — content scripts declared in manifest
  need explicit `host_permissions`, not `activeTab`.

### Content Security Policy
- Use Manifest V3 defaults: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`.
- No `unsafe-inline`, no `unsafe-eval`.
- No external script loading.

### Data Handling
- **No credential storage** — ever.
- **No data exfiltration** — all data stays in the browser.
- **No remote analytics** — usage stats are local-only.
- **No third-party scripts** in the extension.

---

## Git Conventions

### Branch Naming
- `feat/<short-description>` — new features
- `fix/<short-description>` — bug fixes
- `refactor/<short-description>` — code restructuring
- `docs/<short-description>` — documentation only
- `chore/<short-description>` — build, deps, tooling

### Commit Messages
Follow Conventional Commits:
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```
Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`
Scopes: `background`, `content`, `popup`, `options`, `api`, `storage`, `lib`

### Pull Requests
- One feature/fix per PR.
- PR description must include: what, why, and how to test.
- All tests must pass before merge.

---

## Build & Development

### Commands
```bash
pnpm install          # Install dependencies
pnpm dev              # Start WXT dev server with HMR
pnpm build            # Production build → .output/
pnpm test             # Run Vitest unit tests
pnpm test:e2e         # Run Playwright E2E tests
pnpm lint             # ESLint + type check
pnpm zip              # Package for Chrome Web Store (WXT built-in)
pnpm postinstall      # WXT prepare (auto-run by pnpm)
```

### Environment
- **Node.js**: 20 LTS or 22+
- **Package manager**: pnpm (strict, no phantom deps)
- **CI**: GitHub Actions

---

## Key Flows

### Engagement Pipeline
```
User configures competitors (Popup/Options UI)
       ↓
Settings saved to chrome.storage.local
       ↓
Service Worker schedules harvest alarm (chrome.alarms)
       ↓
Service Worker sends HARVEST message → Content Script
       ↓
Content Script makes same-origin fetch() to platform endpoints
  (cookies auto-included, csrftoken from document.cookie)
       ↓
Content Script returns follower data → Service Worker
       ↓
Prospects filtered + stored in IndexedDB (Dexie)
       ↓
Service Worker schedules engagement alarm
       ↓
Service Worker sends ENGAGE message → Content Script
       ↓
Content Script likes 1-2 posts per prospect via fetch()
       ↓
Results reported back → Service Worker logs to IndexedDB
       ↓
Popup reads analytics from IndexedDB on open
```

### Safety Pipeline
```
Before each action (checked by Service Worker):
  1. Check daily limit not exceeded (from chrome.storage)
  2. Check within active hours
  3. Check no active cooldown
  4. Check minimum delay since last action
  5. Send action command → Content Script
  6. Content Script executes fetch(), reports result
  7. On success → SW increments counter, logs, schedules next
  8. On 429/block → SW enters cooldown, notifies user via badge
```

---

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| React Component | `PascalCase.tsx` | `ProspectCard.tsx` |
| Hook | `useCamelCase.ts` | `useEngagement.ts` |
| Utility | `camelCase.ts` | `rateLimiter.ts` |
| Type file | `camelCase.types.ts` | `prospect.types.ts` |
| Test file | `*.test.ts(x)` | `rateLimiter.test.ts` |
| Constant | `UPPER_SNAKE_CASE` | `MAX_DAILY_LIKES` |
| Config | `kebab-case` | `wxt.config.ts` |

---

## Non-Negotiables

1. **Never store Platform credentials** — use session cookies only.
2. **Never exceed safety limits** — the user's account safety is paramount.
3. **Never use `any` type** — TypeScript strict mode is non-negotiable.
4. **Never ship without tests** — minimum 80% coverage on core modules.
5. **Never load remote code** — MV3 forbids it, and we enforce it.
6. **Never use `unsafe-eval` or `unsafe-inline`** — CSP must be strict.
7. **Never bypass rate limits** — respect Platform's platform.
8. **All actions must be logged** — full audit trail in IndexedDB.
9. **All user data stays local** — no telemetry, no analytics servers.
10. **Graceful degradation** — if Platform changes APIs, fail safely with clear user messaging.
