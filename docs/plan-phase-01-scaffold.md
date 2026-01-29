# Phase 1: Extension Scaffold & Build Pipeline

> Set up the foundational Chrome extension project with Manifest V3,
> React, TypeScript, WXT, and all tooling.

## Objectives

- Scaffold a working Chrome MV3 extension with popup, options, background, and content script
- Configure WXT framework (Vite-based) with HMR and file-based entrypoints
- Set up TypeScript strict mode, ESLint 9+ flat config, Prettier
- Establish testing infrastructure (Vitest + Playwright)
- Create the storage abstraction layer
- Implement type-safe message-passing contracts

---

## Deliverables

### 1.1 Project Initialization

```bash
# Scaffold with WXT (replaces manual Vite + CRXJS setup)
pnpm dlx wxt@latest init platform-growth-autopilot --template react

# Additional dependencies
pnpm add react react-dom dexie
pnpm add -D @types/react @types/react-dom @types/chrome
pnpm add -D @tailwindcss/vite tailwindcss
pnpm add -D vitest @testing-library/react @testing-library/jest-dom
pnpm add -D playwright @playwright/test
pnpm add -D eslint prettier eslint-config-prettier
pnpm add -D @eslint/js typescript-eslint eslint-plugin-react eslint-plugin-react-hooks
```

> **Why WXT over CRXJS?** CRXJS had a maintenance crisis in 2025 (nearly archived).
> While it recovered with v2.0, WXT is the industry-recommended framework for new
> projects — it offers file-based entrypoints (auto-generated manifest), auto-imports,
> cross-browser support, type-safe messaging, and a much larger active community.
> See [2025 State of Browser Extension Frameworks](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/).

### 1.2 Directory Structure (WXT Convention)

WXT uses a **file-based entrypoint system** — files in `entrypoints/` automatically
generate the manifest. No manual `manifest.json` editing needed.

```
platform-growth-autopilot/
├── docs/                          # Project documentation
├── assets/
│   └── icons/                     # Extension icons (16, 32, 48, 128)
├── entrypoints/                   # WXT auto-discovers these → generates manifest
│   ├── background.ts              # Service worker (auto-registered)
│   ├── content.ts                 # Content script (matches configured in file)
│   ├── popup/                     # Popup UI
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── components/
│   │       ├── Header.tsx
│   │       ├── StatusBadge.tsx
│   │       └── QuickActions.tsx
│   └── options/                   # Options page
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       └── components/
│           ├── SettingsForm.tsx
│           └── CompetitorList.tsx
├── lib/                           # Shared business logic (auto-imported by WXT)
│   ├── constants.ts
│   ├── orchestrator.ts            # Engine state machine
│   ├── alarm-manager.ts           # chrome.alarms scheduling
│   └── message-handler.ts         # Message routing
├── api/                           # Platform API wrapper layer
│   ├── client.ts
│   ├── cookies.ts
│   ├── errors.ts
│   ├── retry.ts
│   ├── endpoint-registry.ts       # Endpoint URL management
│   ├── response-detector.ts
│   └── endpoints/
│       ├── user.ts
│       ├── followers.ts
│       └── media.ts
├── storage/
│   ├── chrome-storage.ts          # chrome.storage.local/sync wrapper
│   ├── database.ts                # Dexie.js database definition
│   └── index.ts
├── types/
│   ├── messages.ts
│   ├── settings.ts
│   ├── platform.ts
│   └── index.ts
├── utils/
│   ├── delay.ts
│   ├── logger.ts
│   └── index.ts
├── tests/
│   ├── unit/                      # Vitest unit tests
│   └── e2e/                       # Playwright E2E tests
│       └── extension.spec.ts
├── wxt.config.ts                  # WXT configuration (replaces vite.config + manifest)
├── tsconfig.json                  # TypeScript strict config
├── eslint.config.mjs              # ESLint 9+ flat config
├── .prettierrc                    # Prettier config
├── package.json
├── pnpm-lock.yaml
├── CLAUDE.md
└── .gitignore
```

> **Note**: WXT auto-generates `manifest.json` at build time from entrypoint files.
> Entrypoint metadata (matches, permissions, run_at) is defined inline via
> `export default defineContentScript({...})` or similar WXT APIs.

### 1.3 WXT Configuration (replaces manual manifest.json)

WXT auto-generates the manifest from entrypoint files and `wxt.config.ts`.

```typescript
// wxt.config.ts
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Platform Growth Autopilot",
    description: "Grow your Platform audience organically with smart, safe engagement automation.",
    permissions: ["storage", "alarms"],
    host_permissions: [
      "https://www.platform.com/*",
      "https://i.platform.com/*",
    ],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
  },
  vite: () => ({
    plugins: [],  // @tailwindcss/vite added here
  }),
});
```

**Entrypoint examples:**

```typescript
// entrypoints/background.ts
export default defineBackground(() => {
  // All event listeners registered synchronously at top level
  chrome.alarms.onAlarm.addListener(handleAlarm);
  chrome.runtime.onMessage.addListener(handleMessage);
  chrome.runtime.onInstalled.addListener(handleInstall);
  chrome.runtime.onStartup.addListener(handleStartup);
});

// entrypoints/content.ts
export default defineContentScript({
  matches: ["https://www.platform.com/*"],
  runAt: "document_idle",
  main() {
    // Content script logic
  },
});
```

> **Same-origin architecture** — The content script runs on `platform.com`,
> so all `fetch()` calls are same-origin. The browser automatically includes
> ALL cookies (including HttpOnly `sessionid`) with these requests. We only
> need to manually extract the `csrftoken` from `document.cookie` for the
> `X-CSRFToken` header. No `chrome.cookies` permission needed. No API keys.
> No OAuth. No official Graph API.
>
> **No `activeTab`** — Content scripts declared in the manifest run automatically
> on matching pages. `activeTab` only applies to user-initiated actions (clicks).
> We use explicit `host_permissions` instead.

### 1.4 ESLint 9+ Flat Config

```javascript
// eslint.config.mjs
import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat["jsx-runtime"],
  {
    settings: { react: { version: "detect" } },
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  { ignores: ["dist/", ".output/", ".wxt/", "node_modules/", "coverage/"] }
);
```

> **Note**: Uses the new ESLint flat config format (`eslint.config.mjs`), not the
> legacy `.eslintrc.cjs`. The `tseslint.config()` utility is deprecated in favor
> of ESLint core's `defineConfig()`.

### 1.5 TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": false,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["entrypoints/**/*", "lib/**/*", "api/**/*", "storage/**/*", "types/**/*", "utils/**/*"],
  "exclude": ["node_modules", ".output", ".wxt"]
}
```

### 1.5b Tailwind CSS v4 Setup

Tailwind CSS v4 uses a Rust-based engine with automatic content detection
and built-in tree shaking — no `tailwind.config.ts` or PostCSS config needed.

```typescript
// In wxt.config.ts, add to vite plugins:
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
```

```css
/* Main CSS file (imported in each entrypoint) */
@import "tailwindcss";

/* Custom theme via CSS @theme (replaces tailwind.config.ts) */
@theme {
  --color-primary: #6366f1;
  --color-danger: #ef4444;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
}
```

> **v4 benefits over v3**: 3.5x faster full rebuilds, 8x faster incremental builds,
> 35% smaller installed package, zero-config content detection, no PostCSS dependency.

### 1.6 Core Type Definitions

```typescript
// src/types/messages.ts
export const MessageType = {
  // Engagement
  ENGAGEMENT_START: "ENGAGEMENT_START",
  ENGAGEMENT_STOP: "ENGAGEMENT_STOP",
  ENGAGEMENT_STATUS: "ENGAGEMENT_STATUS",
  // Harvesting
  HARVEST_START: "HARVEST_START",
  HARVEST_COMPLETE: "HARVEST_COMPLETE",
  // Prospects
  PROSPECT_QUEUED: "PROSPECT_QUEUED",
  PROSPECT_ENGAGED: "PROSPECT_ENGAGED",
  // Safety
  RATE_LIMIT_HIT: "RATE_LIMIT_HIT",
  ACTION_BLOCKED: "ACTION_BLOCKED",
  COOLDOWN_START: "COOLDOWN_START",
  COOLDOWN_END: "COOLDOWN_END",
  // Status
  STATUS_REQUEST: "STATUS_REQUEST",
  STATUS_RESPONSE: "STATUS_RESPONSE",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload: T;
  timestamp: number;
}
```

```typescript
// src/types/settings.ts
export interface UserSettings {
  // Competitors
  competitors: string[];          // Platform usernames to target

  // Engagement limits
  dailyLikeLimit: number;         // Max likes per day (default: 100)
  likesPerProspect: number;       // Likes per prospect (default: 2)

  // Timing
  activeHoursStart: number;       // Hour (0-23, default: 8)
  activeHoursEnd: number;         // Hour (0-23, default: 23)
  minDelaySeconds: number;        // Min delay between actions (default: 30)
  maxDelaySeconds: number;        // Max delay between actions (default: 120)

  // Safety
  pauseOnBlock: boolean;          // Auto-pause on action block (default: true)
  cooldownHours: number;          // Hours to wait after block (default: 24)

  // Filters
  minPostCount: number;           // Skip accounts with fewer posts (default: 3)
  skipPrivateAccounts: boolean;   // Skip private accounts (default: true)
  skipVerifiedAccounts: boolean;  // Skip verified accounts (default: false)

  // UI
  theme: "light" | "dark" | "system";
}
```

### 1.7 Storage Layer

```typescript
// src/storage/database.ts
import Dexie, { type EntityTable } from "dexie";

export interface Prospect {
  id?: number;
  igUserId: string;
  username: string;
  fullName: string;
  profilePicUrl: string;
  isPrivate: boolean;
  isVerified: boolean;
  postCount: number;
  followerCount: number;
  followingCount: number;
  source: string;              // competitor username that led us here
  fetchedAt: number;
  engagedAt: number | null;
  status: "queued" | "engaged" | "skipped" | "failed";
}

export interface ActionLog {
  id?: number;
  action: "like" | "unlike" | "harvest" | "filter";
  targetUserId: string;
  targetUsername: string;
  mediaId?: string;
  success: boolean;
  error?: string;
  timestamp: number;
}

export interface FollowerSnapshot {
  id?: number;
  snapshotDate: string;        // ISO date string
  followerCount: number;
  followingCount: number;
  newFollowers: string[];
  lostFollowers: string[];
}

export class AppDatabase extends Dexie {
  prospects!: EntityTable<Prospect, "id">;
  actionLogs!: EntityTable<ActionLog, "id">;
  followerSnapshots!: EntityTable<FollowerSnapshot, "id">;

  constructor() {
    super("PlatformGrowthAutopilot");

    this.version(1).stores({
      prospects: "++id, igUserId, username, source, status, fetchedAt",
      actionLogs: "++id, action, targetUserId, timestamp, success",
      followerSnapshots: "++id, snapshotDate",
    });
  }
}

export const db = new AppDatabase();
```

### 1.8 Logger Utility

```typescript
// src/utils/logger.ts
type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_PREFIX = "[GA-Autopilot]";

function log(level: LogLevel, context: string, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const formatted = `${LOG_PREFIX} [${timestamp}] [${level.toUpperCase()}] [${context}] ${message}`;

  switch (level) {
    case "debug":
      console.debug(formatted, data ?? "");
      break;
    case "info":
      console.info(formatted, data ?? "");
      break;
    case "warn":
      console.warn(formatted, data ?? "");
      break;
    case "error":
      console.error(formatted, data ?? "");
      break;
  }
}

export const logger = {
  debug: (ctx: string, msg: string, data?: unknown) => log("debug", ctx, msg, data),
  info: (ctx: string, msg: string, data?: unknown) => log("info", ctx, msg, data),
  warn: (ctx: string, msg: string, data?: unknown) => log("warn", ctx, msg, data),
  error: (ctx: string, msg: string, data?: unknown) => log("error", ctx, msg, data),
};
```

---

## Testing Strategy

### Unit Tests (Vitest)
- `storage/chrome-storage.test.ts` — mock `chrome.storage` API
- `storage/database.test.ts` — Dexie operations with fake-indexeddb
- `utils/delay.test.ts` — delay/jitter calculations
- `types/messages.test.ts` — type guard validation

### E2E Tests (Playwright)
- Load extension as unpacked in Chromium
- Verify popup renders correctly
- Verify options page renders correctly
- Verify content script injects on platform.com

---

## Acceptance Criteria

- [ ] `pnpm dev` starts Vite dev server, extension loads in Chrome with HMR
- [ ] `pnpm build` produces a valid `dist/` directory loadable as unpacked extension
- [ ] Popup shows a placeholder dashboard UI
- [ ] Options page shows a settings form
- [ ] Content script logs injection on platform.com
- [ ] Service worker registers and responds to status messages
- [ ] All unit tests pass with `pnpm test`
- [ ] TypeScript compiles with zero errors in strict mode
- [ ] ESLint passes with zero warnings
