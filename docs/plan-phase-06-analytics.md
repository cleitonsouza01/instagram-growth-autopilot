# Phase 6: Analytics Dashboard

> Provide users with actionable insights about their growth,
> engagement effectiveness, and audience quality.

## Objectives

- Track follower growth over time with daily snapshots
- Measure engagement conversion rates (likes → follows)
- Detect unfollowers between snapshots
- Visualize analytics in the popup and options pages
- Enable data export for external analysis

---

## Deliverables

### 6.1 Follower Snapshot System

```typescript
// src/lib/follower-tracker.ts
```

**Daily snapshot process (triggered by alarm):**
1. Fetch current user's profile (follower/following counts)
2. Fetch full follower list (paginated, rate-limited over time)
3. Compare with previous snapshot
4. Identify new followers and lost followers (unfollowers)
5. Store snapshot in IndexedDB

```typescript
export interface DailySnapshot {
  date: string;                // ISO date: "2026-01-28"
  followerCount: number;
  followingCount: number;
  postCount: number;
  followerUsernames: string[]; // Full list for diff
  newFollowers: string[];
  lostFollowers: string[];
  netGrowth: number;
}

export async function takeSnapshot(): Promise<DailySnapshot>;
export async function getGrowthHistory(days: number): Promise<DailySnapshot[]>;
export async function getUnfollowers(days: number): Promise<string[]>;
```

### 6.2 Engagement Analytics

```typescript
// src/lib/engagement-analytics.ts
```

**Metrics computed from action logs + follower snapshots:**

| Metric | Formula | Description |
|--------|---------|-------------|
| Conversion rate | new_followers / prospects_engaged | % of engaged prospects who followed back |
| Likes per follow | total_likes / new_followers | Average likes needed to gain one follower |
| Best competitor | conversion_rate by source | Which competitor's followers convert best |
| Best time of day | conversion_rate by hour | When engagement is most effective |
| Daily growth rate | avg(net_growth) over 7 days | Average daily follower gain |
| Bot ratio | bots / total_followers | % of followers that are bots |
| Engagement efficiency | follows_gained / actions_used | Overall efficiency score |

```typescript
export interface AnalyticsSummary {
  period: "7d" | "30d" | "90d" | "all";
  totalLikes: number;
  totalProspectsEngaged: number;
  newFollowers: number;
  lostFollowers: number;
  netGrowth: number;
  conversionRate: number;
  likesPerFollow: number;
  dailyGrowthRate: number;
  bestCompetitors: Array<{ username: string; conversionRate: number }>;
  bestHours: Array<{ hour: number; conversionRate: number }>;
  actionBreakdown: {
    successful: number;
    failed: number;
    blocked: number;
  };
}

export async function getAnalyticsSummary(
  period: "7d" | "30d" | "90d" | "all"
): Promise<AnalyticsSummary>;
```

### 6.3 Dashboard UI Components

```typescript
// src/popup/components/analytics/
```

**Components:**

| Component | Content |
|-----------|---------|
| `GrowthChart.tsx` | Line chart: follower count over time |
| `ConversionCard.tsx` | Conversion rate with trend arrow |
| `DailyStats.tsx` | Today's actions, new followers, net growth |
| `CompetitorRanking.tsx` | Table: competitors ranked by conversion rate |
| `UnfollowerList.tsx` | List of recent unfollowers with timestamps |
| `TimeHeatmap.tsx` | Grid showing best engagement times |
| `ExportButton.tsx` | CSV export of analytics data |

**Chart library:** Use lightweight SVG-based charts (custom or `chart.js` with tree-shaking). Avoid heavy chart libraries to keep extension bundle small.

> **Popup size constraint**: Chrome popups are max 800×600px. The popup should
> show only **quick summary stats** (DailyStats, ConversionCard, SafetyStatus).
> Full analytics (GrowthChart, CompetitorRanking, TimeHeatmap, UnfollowerList)
> should live in the **options page**, which has no size constraints.
> Add a "View full analytics →" link in the popup that opens the options page.

### 6.4 Data Export

```typescript
// src/lib/data-export.ts
```

**Export formats:**
- CSV: follower history, action logs, prospect list
- JSON: full database dump for backup/restore

```typescript
export async function exportFollowerHistory(format: "csv" | "json"): Promise<Blob>;
export async function exportActionLogs(format: "csv" | "json"): Promise<Blob>;
export async function exportProspects(format: "csv" | "json"): Promise<Blob>;
export async function importData(file: File): Promise<ImportResult>;
```

---

## Module Structure

```
src/lib/
├── follower-tracker.ts         # Daily snapshot + diff
├── engagement-analytics.ts     # Metrics computation
└── data-export.ts              # CSV/JSON export

src/popup/components/analytics/
├── GrowthChart.tsx             # Follower growth line chart
├── ConversionCard.tsx          # Conversion rate display
├── DailyStats.tsx              # Today's summary
├── CompetitorRanking.tsx       # Competitor effectiveness table
├── UnfollowerList.tsx          # Recent unfollowers
├── TimeHeatmap.tsx             # Best times grid
└── ExportButton.tsx            # Data export trigger
```

---

## Storage Schema Addition

```typescript
// Add to src/storage/database.ts — version 2

this.version(2).stores({
  // ... existing stores
  dailySnapshots: "++id, &date",  // Unique date index
}).upgrade(tx => {
  // No data migration needed for new table
});
```

---

## Testing Strategy

### Unit Tests
- `follower-tracker.test.ts` — snapshot creation, diff calculation
- `engagement-analytics.test.ts` — all metric formulas with known data
- `data-export.test.ts` — CSV format validation, JSON schema

### Component Tests (Vitest + Testing Library)
- Chart components render with mock data
- Export button triggers download
- Unfollower list displays correctly

---

## Acceptance Criteria

- [ ] Daily snapshots capture follower/following counts
- [ ] New followers and unfollowers detected via list diff
- [ ] Conversion rate calculated correctly (likes → follows)
- [ ] Analytics summary available for 7d, 30d, 90d, all-time
- [ ] Best competitor ranking based on follower conversion
- [ ] Best time-of-day analysis from action timestamps
- [ ] Growth chart displays follower trend over time
- [ ] CSV export produces valid, downloadable files
- [ ] JSON export/import enables data backup and restore
- [ ] Analytics update automatically as new data arrives
