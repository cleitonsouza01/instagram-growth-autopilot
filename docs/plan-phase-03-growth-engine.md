# Phase 3: Growth Engine — Like-Based Engagement

> The core value — a prospect pipeline that harvests competitor followers,
> filters for quality, and engages them through likes.

## Objectives

- Build the prospect harvesting pipeline (fetch competitor followers)
- Implement the engagement queue (FIFO with priority)
- Create the like execution loop with timing controls
- Wire service worker alarms to content script actions
- Persist all state for service worker restarts

---

## Deliverables

### 3.1 Prospect Harvester

```typescript
// src/lib/harvester.ts
```

**Pipeline:**
1. Accept a list of competitor usernames from settings
2. Resolve each username to a user ID via `getUserByUsername`
3. Fetch followers page by page (50 per page) with delay between pages
4. For each follower, check if already in prospects DB (dedup by `igUserId`)
5. For each new follower, create a `Prospect` record with status `"queued"`
6. Stop after configurable max prospects per competitor (default: 200)
7. Rotate through competitors — don't exhaust one before moving to next

**Rate limiting:**
- Max 1 follower page fetch per 5 seconds
- Max 3 competitor resolutions per minute
- Stop harvesting if approaching daily action budget

```typescript
export interface HarvestConfig {
  competitors: string[];
  maxProspectsPerCompetitor: number;  // default: 200
  pageFetchDelayMs: number;          // default: 5000
  maxPagesPerSession: number;        // default: 10
}

export interface HarvestResult {
  competitorUsername: string;
  newProspects: number;
  duplicatesSkipped: number;
  pagesProcessed: number;
  cursor: string | null;             // resume cursor for next session
}

export async function harvestCompetitorFollowers(
  config: HarvestConfig,
  onProgress: (result: HarvestResult) => void,
  signal: AbortSignal
): Promise<HarvestResult[]>
```

### 3.2 Prospect Filter

```typescript
// src/lib/prospect-filter.ts
```

**Filters applied to each prospect before queuing:**

| Filter | Default | Rationale |
|--------|---------|-----------|
| Min post count | 3 | Accounts with <3 posts are likely inactive or bots |
| Skip private | true | Can't view feed to like posts |
| Skip verified | false | Verified accounts won't follow back |
| Skip already following | true | Don't waste actions on existing followers |
| Skip previously engaged | true | Don't re-engage within 30 days |
| Bot score threshold | 0.7 | Skip if bot probability > 70% (Phase 5) |

```typescript
export interface FilterConfig {
  minPostCount: number;
  skipPrivate: boolean;
  skipVerified: boolean;
  skipAlreadyFollowing: boolean;
  skipPreviouslyEngaged: boolean;
  reEngagementCooldownDays: number;
}

export interface FilterResult {
  passed: boolean;
  reason?: string;  // e.g., "private_account", "low_post_count"
}

export function filterProspect(
  prospect: Prospect,
  config: FilterConfig,
  engagementHistory: ActionLog[]
): FilterResult
```

### 3.3 Engagement Queue

```typescript
// src/lib/engagement-queue.ts
```

**Queue mechanics:**
- FIFO ordering by `fetchedAt` timestamp
- Prospects are pulled from IndexedDB where `status === "queued"`
- After engagement, status updates to `"engaged"` with `engagedAt` timestamp
- Failed engagements update to `"failed"` with retry after cooldown
- Queue depth visible in popup dashboard

```typescript
export async function getNextProspect(): Promise<Prospect | null>

export async function markEngaged(
  prospectId: number,
  success: boolean,
  error?: string
): Promise<void>

export async function getQueueStats(): Promise<{
  queued: number;
  engaged: number;
  failed: number;
  skipped: number;
}>
```

### 3.4 Like Executor

```typescript
// src/lib/like-executor.ts
```

**Execution flow for a single prospect:**
1. Fetch prospect's recent feed (last 12 posts)
2. Filter to posts not already liked
3. Select N posts to like (N = `likesPerProspect`, default 2)
4. Like each post with delay between likes (5-15 seconds)
5. Log each action to `actionLogs` table
6. Update prospect status

```typescript
export interface LikeExecutionResult {
  prospectId: number;
  username: string;
  postsLiked: number;
  postsAttempted: number;
  errors: string[];
}

export async function engageProspect(
  prospect: Prospect,
  likesPerProspect: number,
  signal: AbortSignal
): Promise<LikeExecutionResult>
```

### 3.5 Orchestrator (Service Worker)

```typescript
// src/background/orchestrator.ts
```

**State machine:**
```
IDLE → HARVESTING → ENGAGING → IDLE
  ↕         ↓           ↓
PAUSED   ERROR/BLOCK  ERROR/BLOCK
  ↕         ↓           ↓
IDLE     COOLDOWN     COOLDOWN
            ↓           ↓
          IDLE         IDLE
```

**Alarm schedule:**
- `harvest-tick` — triggers every 30 minutes during active hours
- `engage-tick` — triggers every 1-3 minutes during active hours
- `daily-reset` — resets daily counters at midnight local time
- `cooldown-end` — resumes after block cooldown

**Service worker lifecycle considerations:**
- All alarm listeners must be registered **synchronously** at the top level
  of `entrypoints/background.ts`. Never inside async functions or callbacks.
- On every alarm fire, **restore state from `chrome.storage.local`** before
  processing — the service worker may have been terminated and cold-started.
- Re-verify alarm existence on `chrome.runtime.onStartup` — alarms may not
  persist across browser restarts.
- For long harvesting operations (>30s), use the **heartbeat pattern**: call
  `chrome.storage.local.set({ heartbeat: Date.now() })` periodically to
  prevent the service worker from being terminated mid-operation.
- Never use global variables for state — all mutable state must be persisted.

```typescript
export type EngineState =
  | "idle"
  | "harvesting"
  | "engaging"
  | "paused"
  | "cooldown"
  | "error";

export interface EngineStatus {
  state: EngineState;
  todayLikes: number;
  dailyLimit: number;
  queueDepth: number;
  lastAction: number | null;
  cooldownEndsAt: number | null;
  activeCompetitor: string | null;
}

export async function startEngine(): Promise<void>
export async function stopEngine(): Promise<void>
export async function getEngineStatus(): Promise<EngineStatus>
```

### 3.6 Message Flow

```
Popup                Service Worker              Content Script
  │                       │                        (on instagram.com)
  │                       │                           │
  │── START_ENGINE ──────>│                           │
  │                       │── HARVEST_START ─────────>│
  │                       │                           │── same-origin fetch()
  │                       │                           │   (cookies auto-included)
  │                       │<── HARVEST_RESULT ────────│
  │                       │   (follower data)         │
  │                       │                           │
  │                       │── ENGAGE_PROSPECT ───────>│
  │                       │   (prospect username)     │── fetch user feed
  │                       │                           │── fetch() like endpoint
  │                       │<── ENGAGE_RESULT ─────────│
  │                       │   (success/failure)       │
  │                       │                           │
  │<── STATUS_UPDATE ─────│                           │
  │                       │                           │
  │                       │<── ACTION_BLOCKED ────────│
  │                       │   (429 or spam detected)  │
  │                       │                           │
  │<── COOLDOWN_ALERT ────│                           │
```

> **Key**: The content script makes ALL HTTP requests to Instagram.
> It runs on `instagram.com` so `fetch()` calls are same-origin — the browser
> automatically includes all cookies (including HttpOnly `sessionid`).
> The service worker only orchestrates timing and state — it never calls
> Instagram endpoints directly.

---

## Module Structure

```
src/lib/
├── harvester.ts           # Competitor follower fetching
├── prospect-filter.ts     # Quality/bot filtering
├── engagement-queue.ts    # Queue management (Dexie)
├── like-executor.ts       # Like action execution
└── constants.ts           # Default limits and timings

src/background/
├── orchestrator.ts        # State machine + alarm scheduling
├── alarm-manager.ts       # chrome.alarms wrapper
└── message-handler.ts     # Route messages to orchestrator
```

---

## Testing Strategy

### Unit Tests
- `harvester.test.ts` — mock API, verify pagination and dedup
- `prospect-filter.test.ts` — all filter combinations
- `engagement-queue.test.ts` — FIFO order, status transitions
- `like-executor.test.ts` — mock API, verify like count and logging
- `orchestrator.test.ts` — state machine transitions

### Integration Tests
- Full pipeline: harvest → filter → queue → engage with mocked API
- Service worker restart recovery (state persistence)
- Alarm firing and action execution

---

## Acceptance Criteria

- [ ] Harvester fetches competitor followers with pagination
- [ ] Prospects are deduplicated by Instagram user ID
- [ ] Filters correctly exclude bots, private accounts, already-engaged
- [ ] Queue returns prospects in FIFO order
- [ ] Like executor likes correct number of posts per prospect
- [ ] All actions logged to IndexedDB with timestamps
- [ ] Orchestrator state machine handles all transitions
- [ ] Engine pauses automatically outside active hours
- [ ] Engine resumes after service worker restart (state from storage)
- [ ] Daily counter resets at midnight
