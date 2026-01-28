# Phase 2: Instagram Request Layer

> Build a typed, rate-aware request layer that runs inside the content script
> on `instagram.com`, making same-origin `fetch()` calls that piggyback on the
> user's existing logged-in session. No API keys, no OAuth, no official API.

## Objectives

- Create a same-origin fetch wrapper running in the content script
- Implement typed request/response contracts for all Instagram endpoints
- Build retry logic with exponential backoff
- Handle CSRF token extraction from `document.cookie`
- Detect action blocks and rate limits from responses

---

## Deliverables

### 2.1 Request Client Core

```typescript
// api/client.ts — runs inside the CONTENT SCRIPT on instagram.com
```

**How it works:**
The content script is injected into `instagram.com`. When it calls `fetch()`,
the browser treats it as a same-origin request and automatically attaches all
cookies — including the HttpOnly `sessionid`. We don't need to read or manage
the session cookie ourselves. The only thing we extract manually is the
`csrftoken` (which is NOT HttpOnly) for the `X-CSRFToken` request header.

**Responsibilities:**
- Extract `csrftoken` from `document.cookie` (non-HttpOnly, readable in content script)
- Set required headers: `X-CSRFToken`, `X-Instagram-AJAX`, `X-Requested-With`
- Base `fetch` wrapper with automatic header injection
- Response parsing with error classification
- Retry with exponential backoff (1s → 2s → 4s → 8s, max 60s, max 3 retries)

**Headers template:**
```typescript
const buildHeaders = (csrfToken: string): HeadersInit => ({
  "X-CSRFToken": csrfToken,
  "X-Instagram-AJAX": "1",
  "X-Requested-With": "XMLHttpRequest",
  "Content-Type": "application/x-www-form-urlencoded",
});
// User-Agent, Referer, and cookies are handled automatically by the browser
// because the fetch is same-origin (content script on instagram.com)
```

### 2.2 CSRF Token Extraction

```typescript
// api/csrf.ts — runs inside the CONTENT SCRIPT on instagram.com
```

**How same-origin authentication works:**
The content script runs on `instagram.com`. When we call `fetch()` from the
content script, the browser automatically includes ALL cookies for the domain
(including the HttpOnly `sessionid`). We never need to read or manage the
session cookie — the browser handles it.

The only cookie we need to extract is `csrftoken` for the `X-CSRFToken` header.
This cookie is NOT HttpOnly, so `document.cookie` works.

```typescript
export function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  if (!match?.[1]) {
    throw new NotAuthenticatedError();
  }
  return match[1];
}

export function isLoggedIn(): boolean {
  // If csrftoken exists, the user has an active session.
  // The HttpOnly sessionid cookie is also present (we can't read it,
  // but the browser will include it in same-origin fetch calls).
  return /csrftoken=.+/.test(document.cookie);
}
```

> **Architecture**: All `fetch()` calls to Instagram endpoints happen in the
> **content script** (same-origin). The **service worker** orchestrates
> WHEN to make requests (via alarms + messages), but never makes the HTTP
> calls itself. The service worker sends a message like `"HARVEST_START"`,
> the content script executes the fetches, and reports results back.

### 2.3 API Endpoints

#### User Endpoints
```typescript
// src/api/endpoints/user.ts

// Get user info by username
// GET https://www.instagram.com/api/v1/users/web_profile_info/?username={username}
export async function getUserByUsername(username: string): Promise<UserProfile>

// Get user info by ID
// GET https://i.instagram.com/api/v1/users/{userId}/info/
export async function getUserById(userId: string): Promise<UserProfile>

// Search users
// GET https://www.instagram.com/web/search/topsearch/?query={query}
export async function searchUsers(query: string): Promise<UserSearchResult[]>
```

#### Follower Endpoints
```typescript
// src/api/endpoints/followers.ts

// Get followers of a user (paginated)
// GET https://www.instagram.com/api/v1/friendships/{userId}/followers/
//   ?count=50&max_id={cursor}
export async function getFollowers(
  userId: string,
  cursor?: string,
  count?: number
): Promise<PaginatedResponse<FollowerInfo>>

// Get following of a user (paginated)
// GET https://www.instagram.com/api/v1/friendships/{userId}/following/
//   ?count=50&max_id={cursor}
export async function getFollowing(
  userId: string,
  cursor?: string,
  count?: number
): Promise<PaginatedResponse<FollowerInfo>>

// Check friendship status
// GET https://www.instagram.com/api/v1/friendships/show/{userId}/
export async function getFriendshipStatus(
  userId: string
): Promise<FriendshipStatus>
```

#### Media Endpoints
```typescript
// src/api/endpoints/media.ts

// Get user feed (recent posts)
// GET https://www.instagram.com/api/v1/feed/user/{userId}/
//   ?count=12&max_id={cursor}
export async function getUserFeed(
  userId: string,
  count?: number
): Promise<PaginatedResponse<MediaItem>>

// Like a media item
// POST https://www.instagram.com/api/v1/web/likes/{mediaId}/like/
export async function likeMedia(mediaId: string): Promise<LikeResponse>

// Unlike a media item
// POST https://www.instagram.com/api/v1/web/likes/{mediaId}/unlike/
export async function unlikeMedia(mediaId: string): Promise<LikeResponse>
```

### 2.4 Type Definitions

```typescript
// src/types/instagram.ts

export interface UserProfile {
  pk: string;                // Instagram user ID
  username: string;
  full_name: string;
  biography: string;
  profile_pic_url: string;
  is_private: boolean;
  is_verified: boolean;
  media_count: number;
  follower_count: number;
  following_count: number;
  external_url: string | null;
}

export interface FollowerInfo {
  pk: string;
  username: string;
  full_name: string;
  profile_pic_url: string;
  is_private: boolean;
  is_verified: boolean;
}

export interface MediaItem {
  id: string;
  pk: string;
  media_type: number;        // 1=photo, 2=video, 8=carousel
  caption: { text: string } | null;
  like_count: number;
  comment_count: number;
  taken_at: number;
  has_liked: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  next_max_id: string | null; // cursor for next page, null = no more
  has_more: boolean;
}

export interface FriendshipStatus {
  following: boolean;
  followed_by: boolean;
  blocking: boolean;
  is_private: boolean;
  incoming_request: boolean;
  outgoing_request: boolean;
}

export interface LikeResponse {
  status: "ok" | "fail";
  spam?: boolean;
}
```

### 2.5 Error Types

```typescript
// src/api/errors.ts

export class InstagramApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = "InstagramApiError";
  }
}

export class RateLimitError extends InstagramApiError {
  constructor(response?: unknown) {
    super("Rate limit exceeded", 429, response);
    this.name = "RateLimitError";
  }
}

export class ActionBlockError extends InstagramApiError {
  constructor(response?: unknown) {
    super("Action blocked by Instagram", 400, response);
    this.name = "ActionBlockError";
  }
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super("Not authenticated — no valid Instagram session found");
    this.name = "NotAuthenticatedError";
  }
}

export class CheckpointRequiredError extends InstagramApiError {
  constructor(public readonly checkpointUrl: string, response?: unknown) {
    super("Checkpoint required", 400, response);
    this.name = "CheckpointRequiredError";
  }
}
```

### 2.6 Retry Logic

```typescript
// src/api/retry.ts

export interface RetryConfig {
  maxRetries: number;        // default: 3
  baseDelayMs: number;       // default: 1000
  maxDelayMs: number;        // default: 60000
  retryableStatuses: number[]; // default: [429, 500, 502, 503, 504]
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T>
```

**Backoff formula:** `delay = min(baseDelay * 2^attempt + jitter, maxDelay)`

**Non-retryable errors:** `ActionBlockError`, `NotAuthenticatedError`, `CheckpointRequiredError`

### 2.7 Endpoint Registry

```typescript
// api/endpoint-registry.ts
```

Instagram rotates internal GraphQL `doc_id` values every 2-4 weeks.
Hardcoding endpoint URLs is fragile. The endpoint registry provides:

1. **Centralized URL management** — all endpoint URLs in one module
2. **Runtime updateability** — endpoints can be updated via `chrome.storage`
   without code changes
3. **Health checking** — on extension startup, verify critical endpoints
   return expected response shapes
4. **Fallback chains** — try primary endpoint, fall back to alternative

```typescript
export interface EndpointEntry {
  url: string;
  method: "GET" | "POST";
  fallbackUrl?: string;
  lastVerified?: number;
  broken?: boolean;
}

export const defaultEndpoints: Record<string, EndpointEntry> = {
  userProfile: {
    url: "/api/v1/users/web_profile_info/",
    method: "GET",
  },
  followers: {
    url: "/api/v1/friendships/{userId}/followers/",
    method: "GET",
  },
  likeMedia: {
    url: "/api/v1/web/likes/{mediaId}/like/",
    method: "POST",
  },
  // ... all endpoints
};

export async function getEndpoint(key: string): Promise<EndpointEntry>;
export async function updateEndpoint(key: string, url: string): Promise<void>;
export async function healthCheck(): Promise<Record<string, boolean>>;
```

> **Why this matters**: Instagram has deprecated the Basic Display API (Dec 2024),
> deprecated multiple insights metrics (Jan 2025), and continues to rotate
> private GraphQL `doc_id` values regularly. Without an endpoint registry,
> the extension silently breaks when endpoints change.

### 2.8 Response Detection Patterns

```typescript
// src/api/response-detector.ts
```

Detect action blocks from response patterns:
- HTTP 400 with `"spam": true` in body
- HTTP 400 with `"message": "feedback_required"`
- HTTP 429 (rate limit)
- Response containing `"checkpoint_required"` → extract checkpoint URL
- Response containing `"login_required"` → session expired

---

## Module Structure

```
api/
├── client.ts              # Core same-origin fetch wrapper (content script)
├── csrf.ts                # CSRF token extraction from document.cookie
├── errors.ts              # Error class hierarchy
├── retry.ts               # Exponential backoff retry
├── endpoint-registry.ts   # Centralized endpoint URL management
├── response-detector.ts   # Action block/rate limit detection
├── endpoints/
│   ├── user.ts            # User profile endpoints
│   ├── followers.ts       # Follower/following endpoints
│   └── media.ts           # Feed and like endpoints
├── types.ts               # Re-export from types/instagram.ts
└── index.ts               # Barrel export
```

> All modules in `api/` run inside the **content script** context.
> They are called by the content script's message handler when the
> service worker sends action commands.

---

## Testing Strategy

### Unit Tests (Vitest)
- Mock `fetch` globally with `vi.fn()`
- Test header injection with correct CSRF token
- Test retry logic: verify exponential backoff timing
- Test error classification: 429 → `RateLimitError`, etc.
- Test cookie extraction with various `document.cookie` formats
- Test pagination cursor handling

### Integration Tests
- Test against mock Instagram responses (fixtures)
- Verify full request/response cycle for each endpoint
- Test error propagation from API to caller

---

## Acceptance Criteria

- [ ] Content script extracts CSRF token from `document.cookie`
- [ ] All `fetch()` calls are same-origin (no external API keys or OAuth)
- [ ] All endpoint functions are typed with request/response contracts
- [ ] Retry logic handles transient failures with exponential backoff
- [ ] Action blocks are detected and surfaced as `ActionBlockError`
- [ ] Rate limits (429) are detected and surfaced as `RateLimitError`
- [ ] Session expiry detected and surfaced as `NotAuthenticatedError`
- [ ] All functions return typed responses
- [ ] Unit tests cover all error paths and retry scenarios
- [ ] No credentials stored — session handled by browser cookies automatically
- [ ] No `chrome.cookies` permission used — everything is same-origin
