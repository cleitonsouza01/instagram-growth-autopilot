# Phase 4: Safety Controls & Rate Limiting

> Protect users' Instagram accounts from bans, action blocks,
> and detection by Instagram's anti-automation systems.

## Objectives

- Implement adaptive rate limiting that respects Instagram's thresholds
- Build human-like timing patterns with statistical variance
- Create action block detection and automatic cooldown
- Add progressive scaling for new vs. mature accounts
- Provide clear user warnings and safety status indicators

---

## Deliverables

### 4.1 Rate Limiter

```typescript
// src/lib/rate-limiter.ts
```

**Multi-layer rate limiting:**

| Layer | Limit | Window | Action on exceed |
|-------|-------|--------|-----------------|
| Per-action delay | 30-120s | Between actions | Wait for delay |
| Hourly limit | 30 likes | 1 hour | Pause until next hour |
| Daily limit | 100-500 | 24 hours | Stop for the day |
| Session limit | 50 actions | Per active session | Force break (15-30 min) |

```typescript
export interface RateLimiterConfig {
  dailyLimit: number;
  hourlyLimit: number;
  sessionLimit: number;
  minDelayMs: number;
  maxDelayMs: number;
  sessionBreakMinutes: number;
}

export interface RateLimitCheck {
  allowed: boolean;
  waitMs: number;          // How long to wait before next action
  reason?: string;         // Why action was denied
  dailyRemaining: number;
  hourlyRemaining: number;
  sessionRemaining: number;
}

export class RateLimiter {
  constructor(config: RateLimiterConfig);

  canPerformAction(): Promise<RateLimitCheck>;
  recordAction(): Promise<void>;
  resetDaily(): Promise<void>;
  resetSession(): Promise<void>;
  getStatus(): Promise<RateLimitStatus>;
}
```

### 4.2 Human-Like Timing

```typescript
// src/lib/timing.ts
```

**Timing strategies to mimic human behavior:**

1. **Gaussian delay distribution** — delays centered around a mean with standard deviation, not uniform random
2. **Activity bursts** — occasional faster sequences (like a human scrolling), followed by longer pauses
3. **Natural breaks** — 5-15 minute breaks every 20-40 actions
4. **Time-of-day variation** — slightly faster during "peak" hours (11am-1pm, 7pm-9pm), slower otherwise
5. **Weekday vs. weekend** — configurable different patterns

```typescript
export function gaussianDelay(meanMs: number, stdDevMs: number): number;

export function humanLikeDelay(config: {
  baseMinMs: number;
  baseMaxMs: number;
  burstProbability: number;    // 0.15 = 15% chance of faster action
  burstSpeedMultiplier: number; // 0.5 = half the delay during burst
}): number;

export function shouldTakeBreak(
  actionsInSession: number,
  config: { breakEvery: [number, number]; breakDuration: [number, number] }
): { takeBreak: boolean; breakDurationMs: number };

export function isWithinActiveHours(
  startHour: number,
  endHour: number,
  now?: Date
): boolean;
```

### 4.3 Action Block Detector

```typescript
// src/lib/block-detector.ts
```

**Detection signals:**
- HTTP 429 response → confirmed rate limit
- HTTP 400 with `"spam": true` → action block
- HTTP 400 with `"feedback_required"` → soft block
- Consecutive failures (3+ in a row) → probable block
- `"checkpoint_required"` → account flagged, stop everything

**Response actions:**

| Signal | Severity | Cooldown | User notification |
|--------|----------|----------|-------------------|
| Single 429 | Low | 1 hour | Badge warning |
| `spam: true` | Medium | 24 hours | Popup notification |
| `feedback_required` | High | 48 hours | Popup + options page warning |
| 3+ consecutive fails | Medium | 12 hours | Badge warning |
| `checkpoint_required` | Critical | Indefinite (manual) | Full-screen alert |

```typescript
export type BlockSeverity = "low" | "medium" | "high" | "critical";

export interface BlockEvent {
  severity: BlockSeverity;
  reason: string;
  detectedAt: number;
  cooldownEndsAt: number | null;  // null = manual resume required
  autoResume: boolean;
}

export class BlockDetector {
  detectBlock(response: Response, body: unknown): BlockEvent | null;
  recordFailure(): void;
  resetFailureCount(): void;
  isInCooldown(): Promise<boolean>;
  getCooldownRemaining(): Promise<number>;  // ms remaining
}
```

### 4.4 Progressive Scaling

```typescript
// src/lib/scaling.ts
```

**Account maturity tiers:**

| Account Age | Daily Limit | Hourly Limit | Recommended |
|-------------|------------|--------------|-------------|
| < 14 days | 50 | 10 | Do not use automation |
| 14-30 days | 100 | 15 | Very conservative |
| 1-3 months | 200 | 25 | Conservative |
| 3-6 months | 300 | 35 | Moderate |
| 6+ months | 500 | 50 | Full speed |

```typescript
export interface AccountProfile {
  accountAgeDays: number;     // User-provided or estimated
  totalPosts: number;
  followerCount: number;
  hasProfilePic: boolean;
  hasBio: boolean;
  hasWebsite: boolean;
}

export interface ScalingRecommendation {
  tier: "new" | "young" | "growing" | "established" | "mature";
  dailyLimit: number;
  hourlyLimit: number;
  minDelaySeconds: number;
  warnings: string[];        // e.g., "Account is too new for automation"
}

export function getScalingRecommendation(
  profile: AccountProfile
): ScalingRecommendation;
```

### 4.5 Safety Dashboard Component

```typescript
// src/popup/components/SafetyStatus.tsx
```

**Visual indicators:**
- Green shield: all safe, within limits
- Yellow shield: approaching daily limit (>80%)
- Orange shield: in session break or nearing hourly limit
- Red shield: action block detected, in cooldown
- Gray shield: automation paused or outside active hours

**Information displayed:**
- Actions today: `X / Y` (with progress bar)
- Current state: harvesting / engaging / idle / cooldown
- Next action in: countdown timer
- Cooldown remaining: countdown (if applicable)
- Session actions: `X / Y`

---

## Module Structure

```
src/lib/
├── rate-limiter.ts        # Multi-layer rate limiting
├── timing.ts              # Human-like delay generation
├── block-detector.ts      # Action block detection
└── scaling.ts             # Progressive account scaling

src/popup/components/
└── SafetyStatus.tsx        # Safety dashboard widget
```

---

## Testing Strategy

### Unit Tests
- `rate-limiter.test.ts`
  - Verify daily/hourly/session limits are enforced
  - Verify reset behavior at boundaries
  - Verify `waitMs` calculation accuracy
- `timing.test.ts`
  - Gaussian distribution produces values within expected range
  - Human-like delays include bursts at configured probability
  - Break scheduling triggers at correct intervals
  - Active hours check with timezone variations
- `block-detector.test.ts`
  - All detection patterns correctly identified
  - Cooldown durations match severity
  - Consecutive failure counting
  - Cooldown expiry check
- `scaling.test.ts`
  - All account age tiers produce correct limits
  - Edge cases at tier boundaries

### Integration Tests
- Rate limiter + block detector working together
- Cooldown persists across service worker restarts
- Progressive scaling adjusts limits in real-time

---

## Acceptance Criteria

- [ ] Rate limiter enforces daily, hourly, and session limits
- [ ] Actions are delayed with human-like timing (not uniform random)
- [ ] Natural breaks inserted every 20-40 actions
- [ ] HTTP 429 triggers automatic 1-hour cooldown
- [ ] Action blocks trigger 24-48 hour cooldown
- [ ] Checkpoint required stops all automation indefinitely
- [ ] Consecutive failures (3+) trigger protective cooldown
- [ ] Safety status displays correctly in popup
- [ ] Cooldown state persists across service worker restarts
- [ ] Progressive scaling recommends limits based on account age
- [ ] Users can override limits (with warnings for aggressive settings)
