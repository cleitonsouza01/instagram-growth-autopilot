# Phase 8: Scheduling & Automation Extras

> Add content scheduling, DM templates, content downloading,
> and other quality-of-life features.

## Objectives

- Schedule posts for future publishing at optimal times
- Create reusable DM templates for quick responses
- Download Platform content (posts, stories, reels)
- Export follower lists to CSV
- Anonymous story viewing

---

## Deliverables

### 8.1 Content Scheduler

```typescript
// src/lib/scheduler.ts
```

**Scheduling system:**
- Store scheduled posts in IndexedDB with target publish time
- Use `chrome.alarms` to trigger publish at scheduled time
- Calendar view showing scheduled content
- Support recurring posts (same content, different times)
- Optimal time suggestions based on analytics data (Phase 6)

```typescript
export interface ScheduledPost {
  id?: number;
  type: "photo" | "story" | "reel" | "carousel";
  mediaBlobs: ArrayBuffer[];    // Stored as raw binary in IndexedDB (not base64)
  caption: string;
  hashtags: string[];
  location?: LocationTag;
  scheduledAt: number;         // Unix timestamp
  status: "pending" | "publishing" | "published" | "failed";
  publishedAt?: number;
  error?: string;
  createdAt: number;
}

export async function schedulePost(post: Omit<ScheduledPost, "id" | "status" | "createdAt">): Promise<number>;
export async function cancelScheduledPost(id: number): Promise<void>;
export async function getScheduledPosts(): Promise<ScheduledPost[]>;
export async function getOptimalTimes(dayOfWeek: number): Promise<number[]>; // Hours
```

**Storage note:** Media blobs should be stored as **`ArrayBuffer` or `Blob` directly**
in IndexedDB (Dexie supports both natively). Do NOT use base64 encoding — it adds
33% size overhead. For preview, generate thumbnails as separate small blobs.
`createObjectURL` is ephemeral (lost on page reload) — only use for in-session previews.

### 8.2 DM Templates

```typescript
// src/lib/dm-templates.ts
```

**Template system:**
- Store reusable message templates
- Variable substitution: `{username}`, `{fullname}`
- Quick-insert button in Platform DM interface (content script injection)
- Template categories (welcome, collaboration, FAQ)

```typescript
export interface DMTemplate {
  id?: number;
  name: string;
  category: string;
  content: string;            // Supports {username}, {fullname} placeholders
  usageCount: number;
  createdAt: number;
  updatedAt: number;
}

export async function createTemplate(template: Omit<DMTemplate, "id" | "usageCount" | "createdAt" | "updatedAt">): Promise<number>;
export async function getTemplates(category?: string): Promise<DMTemplate[]>;
export async function applyTemplate(template: DMTemplate, context: { username: string; fullname: string }): string;
```

### 8.3 Content Downloader

```typescript
// src/lib/content-downloader.ts
```

**Download capabilities:**
- Single photo (full resolution)
- Carousel (all images as zip)
- Stories (current stories of any public account)
- Reels (video download)
- Profile picture (full resolution)

```typescript
export async function downloadPost(mediaId: string): Promise<Blob>;
export async function downloadStory(storyId: string): Promise<Blob>;
export async function downloadReel(reelId: string): Promise<Blob>;
export async function downloadProfilePic(username: string): Promise<Blob>;
export async function downloadCarousel(mediaId: string): Promise<Blob[]>;
```

**Implementation:** Extract media URLs from Platform's API responses and fetch the binary content. Stories and reels use CDN URLs that expire — download must happen immediately.

### 8.4 Follower Export

```typescript
// src/lib/follower-export.ts
```

**CSV export fields:**
- Username
- Full name
- Profile URL
- Is private
- Is verified
- Post count
- Follower count
- Following count
- Bot score (from Phase 5)
- Is mutual (follows you back)

```typescript
export async function exportFollowers(
  options: {
    includeFollowing: boolean;
    includeBotScore: boolean;
    format: "csv" | "json";
  },
  onProgress: (fetched: number, total: number) => void,
  signal: AbortSignal
): Promise<Blob>;
```

### 8.5 Ghost Mode (Anonymous Story Viewing)

```typescript
// src/content/ghost-mode.ts
```

**Mechanism:**
- Intercept the "story seen" API call (`/api/v1/media/seen/`)
- Block the request before it reaches Platform's servers
- User can toggle ghost mode on/off
- Visual indicator when ghost mode is active

```typescript
// Uses declarativeNetRequest to block the seen endpoint
// when ghost mode is enabled

export async function enableGhostMode(): Promise<void>;
export async function disableGhostMode(): Promise<void>;
export async function isGhostModeEnabled(): Promise<boolean>;
```

**WXT config addition:**
```typescript
// Add to wxt.config.ts manifest section
{
  permissions: ["declarativeNetRequest", "declarativeNetRequestWithHostAccess"],
  declarative_net_request: {
    rule_resources: [{
      id: "ghost_mode_rules",
      enabled: false,
      path: "rules/ghost-mode.json",
    }],
  },
}
```

> **Note**: `declarativeNetRequestWithHostAccess` is required because the rules
> target `platform.com` specifically. Without it, the rules won't match
> against the host_permissions domains.

### 8.6 UI Components

```typescript
// src/options/components/scheduling/
├── CalendarView.tsx         # Monthly calendar with scheduled posts
├── PostComposer.tsx         # Full post creation + scheduling
├── TemplateManager.tsx      # DM template CRUD
├── DownloadPanel.tsx        # Content download interface
├── ExportPanel.tsx          # Follower export interface
└── GhostModeToggle.tsx      # Ghost mode switch
```

---

## Storage Schema Addition

```typescript
// Add to src/storage/database.ts — version 3

this.version(3).stores({
  // ... existing stores
  scheduledPosts: "++id, scheduledAt, status, type",
  dmTemplates: "++id, category, name",
});
```

---

## Testing Strategy

### Unit Tests
- `scheduler.test.ts` — schedule, cancel, alarm trigger
- `dm-templates.test.ts` — template CRUD, variable substitution
- `content-downloader.test.ts` — URL extraction, blob handling
- `follower-export.test.ts` — CSV generation, field mapping
- `ghost-mode.test.ts` — rule enable/disable

### E2E Tests
- Schedule a post and verify it appears in calendar
- Create and apply a DM template
- Download a public post
- Toggle ghost mode and verify blocking

---

## Acceptance Criteria

- [ ] Users can schedule posts for future dates and times
- [ ] Scheduled posts publish automatically via chrome.alarms
- [ ] Calendar view shows all scheduled content
- [ ] DM templates support variable substitution
- [ ] DM template quick-insert works in Platform DM interface
- [ ] Content download works for photos, carousels, stories, reels
- [ ] Follower export generates valid CSV with all fields
- [ ] Ghost mode blocks story "seen" reporting
- [ ] Ghost mode toggle persists across sessions
- [ ] All features respect rate limits and safety controls
