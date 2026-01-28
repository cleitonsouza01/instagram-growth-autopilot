# Plan General — Instagram Growth Autopilot

> Master plan and roadmap for building a client-side Chrome extension that
> automates Instagram growth through like-based engagement.

## Table of Contents

- [Vision](#vision)
- [Architecture Overview](#architecture-overview)
- [Phase Breakdown](#phase-breakdown)
- [Tech Stack](#tech-stack)
- [Risk Register](#risk-register)
- [Phase Plans (Detailed)](#phase-plans-detailed)

---

## Vision

Build a Chrome extension that helps Instagram creators grow their audience
organically by automating like-based engagement on competitor followers.
The extension runs entirely client-side — no backend servers, no credential
storage, no data exfiltration.

### Core Value Proposition
- **Automated prospecting** — find relevant audiences via competitor analysis
- **Safe engagement** — like posts with human-like timing and rate limits
- **Zero risk of credential theft** — uses existing browser session
- **Full transparency** — all actions logged and visible to the user

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                     Chrome Browser                        │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐  │
│  │  Popup   │  │ Options  │  │   Service Worker       │  │
│  │  (React) │  │ (React)  │  │   (Orchestrator)       │  │
│  │          │  │          │  │                        │  │
│  │ Dashboard│  │ Settings │  │ • Alarm scheduling     │  │
│  │ Controls │  │ Config   │  │ • State machine        │  │
│  │ Stats    │  │ Limits   │  │ • Safety checks        │  │
│  └────┬─────┘  └────┬─────┘  │ • Message routing      │  │
│       │              │        └───────────┬────────────┘  │
│       │              │                    │               │
│       └──────────────┼────────────────────┘               │
│                      │  chrome.runtime messages           │
│                      │                                    │
│  ┌───────────────────┴──────────────────────────────┐    │
│  │         Content Script (instagram.com)            │    │
│  │         ══════════════════════════════             │    │
│  │  SAME-ORIGIN — fetch() includes all cookies       │    │
│  │  automatically (including HttpOnly sessionid)     │    │
│  │                                                    │    │
│  │  • Reads csrftoken from document.cookie           │    │
│  │  • Makes fetch() to /api/v1/* endpoints           │    │
│  │  • Harvests competitor followers                   │    │
│  │  • Executes likes on prospect posts               │    │
│  │  • Detects action blocks from responses           │    │
│  │  • Reports results back to Service Worker         │    │
│  │                                                    │    │
│  │  NO API keys · NO OAuth · NO chrome.cookies       │    │
│  └───────────────────┬──────────────────────────────┘    │
│                      │                                    │
│  ┌───────────────────┴──────────────────────────────┐    │
│  │              Storage Layer                        │    │
│  │                                                    │    │
│  │  chrome.storage.local  │  IndexedDB (Dexie.js)    │    │
│  │  • Settings            │  • Prospects DB           │    │
│  │  • Engine state        │  • Action log             │    │
│  │  • Daily counters      │  • Follower snapshots     │    │
│  │  • Competitor list     │  • Analytics data         │    │
│  └────────────────────────────────────────────────────┘   │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## Phase Breakdown

| Phase | Name | Priority | Dependencies |
|-------|------|----------|-------------|
| 1 | [Extension Scaffold & Build Pipeline](./plan-phase-01-scaffold.md) | P0 | None |
| 2 | [Instagram API Integration](./plan-phase-02-api-integration.md) | P0 | Phase 1 |
| 3 | [Growth Engine — Like-Based Engagement](./plan-phase-03-growth-engine.md) | P0 | Phase 2 |
| 4 | [Safety Controls & Rate Limiting](./plan-phase-04-safety-controls.md) | P0 | Phase 3 |
| 5 | [Bot Detection & Prospect Filtering](./plan-phase-05-bot-detection.md) | P1 | Phase 3 |
| 6 | [Analytics Dashboard](./plan-phase-06-analytics.md) | P1 | Phase 4 |
| 7 | [Content Publishing from Desktop](./plan-phase-07-publishing.md) | P2 | Phase 1 |
| 8 | [Scheduling & Automation Extras](./plan-phase-08-scheduling.md) | P2 | Phase 7 |

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Extension Runtime | Chrome Manifest V3 | Required for Web Store, modern architecture |
| Language | TypeScript 5.x (strict) | Type safety, better DX, fewer runtime errors |
| UI Framework | React 18 | Component model, ecosystem, developer familiarity |
| Build Tool | WXT (Vite-based framework) | File-based entrypoints, auto-imports, cross-browser, type-safe messaging, active community |
| Styling | Tailwind CSS v4 + `@tailwindcss/vite` | Rust-based engine, automatic purging, 3.5x faster builds |
| Local Database | Dexie.js 4.x (IndexedDB) | Structured queries, schema migrations, bulk ops |
| Settings Storage | chrome.storage API | Built-in sync, extension-native |
| Scheduling | chrome.alarms API | Service worker compatible, persistent timers |
| Unit Testing | Vitest | Vite-native, fast, TypeScript-first |
| E2E Testing | Playwright + CDP | Real browser testing, extension support |
| Linting | ESLint 9+ (flat config) + Prettier | Consistent code style, `eslint.config.mjs` |
| CI/CD | GitHub Actions | Automated testing, build verification |
| Package Manager | pnpm | Fast, strict, disk-efficient |

---

## Risk Register

### High Risk

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Instagram API changes | Extension breaks silently | Version detection, graceful fallback, rapid update process |
| User account bans | Loss of user trust | Conservative defaults, clear warnings, safety-first design |
| Chrome Web Store rejection | Cannot distribute | Clear user consent, transparent automation disclosure |
| Instagram `doc_id` rotation | Endpoints break every 2-4 weeks | Endpoint registry pattern, health checks, easy update path |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|-----------|
| IndexedDB data eviction | Lost engagement history | Use `StorageManager.persist()`, periodic export option |
| Service worker termination | Interrupted automation | Persist state to storage, resume on wake |
| Rate limit changes | Reduced effectiveness | Adaptive rate limiting, user-configurable limits |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Browser compatibility | Limited user base | Target Chromium only (Chrome, Edge, Brave, Arc) |
| Tailwind bundle size | Larger extension | PurgeCSS in production build |

---

## Phase Plans (Detailed)

Each phase has a dedicated plan document with:
- Objectives and deliverables
- File-by-file implementation details
- API contracts and type definitions
- Testing strategy
- Acceptance criteria

Navigate to individual phase plans:
1. [Phase 1: Extension Scaffold](./plan-phase-01-scaffold.md)
2. [Phase 2: Instagram API Integration](./plan-phase-02-api-integration.md)
3. [Phase 3: Growth Engine](./plan-phase-03-growth-engine.md)
4. [Phase 4: Safety Controls](./plan-phase-04-safety-controls.md)
5. [Phase 5: Bot Detection](./plan-phase-05-bot-detection.md)
6. [Phase 6: Analytics Dashboard](./plan-phase-06-analytics.md)
7. [Phase 7: Content Publishing](./plan-phase-07-publishing.md)
8. [Phase 8: Scheduling & Extras](./plan-phase-08-scheduling.md)
