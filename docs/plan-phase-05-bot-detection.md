# Phase 5: Bot Detection & Prospect Filtering

> Improve engagement quality by identifying and filtering out bot accounts,
> fake followers, and low-quality prospects before wasting actions on them.

## Objectives

- Build a heuristic scoring model for bot detection
- Implement real-time filtering during prospect harvesting
- Create a bot detection scanner for existing followers
- Provide follower quality analytics

---

## Deliverables

### 5.1 Bot Scoring Engine

```typescript
// src/lib/bot-scorer.ts
```

**Heuristic signals with weights:**

| Signal | Weight | Bot Indicator | Scoring |
|--------|--------|---------------|---------|
| No profile picture | 0.15 | High | Binary: 0 or weight |
| Empty biography | 0.10 | Medium | Binary |
| No posts | 0.20 | Very High | 0 posts = full weight, 1-2 = half |
| Username pattern | 0.10 | Medium | Regex: excessive digits, random chars |
| Follower/following ratio | 0.15 | High | Following >> followers = suspicious |
| Following count extreme | 0.10 | Medium | >5000 following = suspicious |
| Account age vs posts | 0.10 | Medium | Old account with very few posts |
| Generic full name | 0.05 | Low | Names matching spam patterns |
| No external URL | 0.05 | Low | Legitimate users often have links |

**Bot score:** 0.0 (definitely human) → 1.0 (definitely bot)
**Default threshold:** 0.6 (skip prospects with score ≥ 0.6)

```typescript
export interface BotScoreResult {
  score: number;              // 0.0 - 1.0
  isBot: boolean;             // score >= threshold
  signals: BotSignal[];       // Contributing factors
  confidence: "low" | "medium" | "high";
}

export interface BotSignal {
  name: string;
  value: number;              // 0.0 - 1.0 contribution
  detail: string;             // Human-readable explanation
}

export function calculateBotScore(
  profile: UserProfile,
  config?: Partial<BotScoringConfig>
): BotScoreResult;
```

### 5.2 Username Pattern Analyzer

```typescript
// src/lib/username-analyzer.ts
```

**Suspicious patterns:**
- Excessive consecutive digits: `user839274651`
- Random character sequences: `xkjf_29sk`
- Known bot prefixes/suffixes: `follow_`, `_official`, `real_`
- Excessive underscores: `user___name__123`
- Very long usernames (>25 chars) with mixed patterns

```typescript
export function analyzeUsername(username: string): {
  suspicionScore: number;     // 0.0 - 1.0
  patterns: string[];         // e.g., ["excessive_digits", "random_chars"]
};
```

### 5.3 Follower Ratio Analyzer

```typescript
// src/lib/ratio-analyzer.ts
```

**Ratio analysis:**
- `following / followers > 10` → likely follow-for-follow bot
- `followers > 10000 && posts < 5` → fake follower count
- `following > 5000` → mass-follow behavior
- `posts / account_age_days < 0.01` → inactive or fake

```typescript
export function analyzeRatios(profile: UserProfile): {
  suspicionScore: number;
  flags: string[];
};
```

### 5.4 Existing Follower Scanner

```typescript
// src/lib/follower-scanner.ts
```

**Scan user's own followers to identify bots:**
1. Fetch follower list (paginated, rate-limited)
2. Score each follower with bot detection
3. Store results in IndexedDB
4. Present summary: total followers, bot count, bot percentage
5. Option to block detected bots (via Instagram API)

```typescript
export interface ScanResult {
  totalScanned: number;
  botsDetected: number;
  botPercentage: number;
  topBots: Array<{
    username: string;
    score: number;
    signals: BotSignal[];
  }>;
}

export async function scanFollowers(
  onProgress: (scanned: number, total: number) => void,
  signal: AbortSignal
): Promise<ScanResult>;
```

### 5.5 Bot Detection UI Components

```typescript
// src/popup/components/BotScanner.tsx    — Scan trigger + results
// src/popup/components/BotScoreCard.tsx  — Individual account score display
// src/popup/components/BotStats.tsx      — Aggregate bot statistics
```

---

## Module Structure

```
src/lib/
├── bot-scorer.ts            # Main scoring engine
├── username-analyzer.ts     # Username pattern detection
├── ratio-analyzer.ts        # Follower/following ratio analysis
└── follower-scanner.ts      # Batch follower scanning

src/popup/components/
├── BotScanner.tsx           # Scan UI
├── BotScoreCard.tsx         # Score display
└── BotStats.tsx             # Aggregate stats
```

---

## Testing Strategy

### Unit Tests
- `bot-scorer.test.ts`
  - Known bot profiles score > 0.6
  - Known human profiles score < 0.4
  - Edge cases: empty profiles, celebrity profiles
  - Weight sum equals 1.0
- `username-analyzer.test.ts`
  - Common bot username patterns detected
  - Normal usernames pass cleanly
- `ratio-analyzer.test.ts`
  - Extreme ratios flagged correctly
  - Normal ratios pass

### Test Fixtures
Create a set of mock profiles representing:
- Clear bots (no pic, no posts, random name)
- Clear humans (complete profile, normal ratios)
- Edge cases (new legitimate accounts, businesses)

---

## Acceptance Criteria

- [ ] Bot scorer produces scores between 0.0 and 1.0
- [ ] Known bot patterns detected with >80% accuracy
- [ ] Legitimate accounts pass with <20% false positive rate
- [ ] Username patterns correctly flag suspicious names
- [ ] Follower ratio analysis flags mass-follow behavior
- [ ] Follower scanner processes accounts in batches (rate-limited)
- [ ] Scan results stored in IndexedDB for historical comparison
- [ ] Bot stats displayed in popup dashboard
- [ ] User can adjust bot threshold in settings
