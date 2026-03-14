---
phase: 08-ui-modernization
plan: 01
subsystem: ui
tags: [preact, htm, signals, import-map, spa, websocket, responsive-css]

# Dependency graph
requires:
  - phase: 01-gateway-core
    provides: WebSocket broadcast, Fastify static serving, auth middleware
provides:
  - Vendored Preact+HTM+Signals standalone bundle (22KB, offline-first)
  - SPA index.html with import map for bare specifier resolution
  - Hash-based client-side router with signal-driven route state
  - Global signal store with telemetry, config, prices, forecast signals
  - Computed autarky and self-consumption rate signals
  - WebSocket hook with exponential backoff reconnection
  - API fetch hook with auth token support
  - Format utilities (power, energy, percent, price, date, time)
  - SVG chart utilities (scaleLinear, computeBarLayout, formatAxisLabel)
  - App shell with sidebar navigation, 5-route routing, hamburger menu
  - 5 placeholder page components (dashboard, settings, setup, history, tools)
  - Responsive CSS breakpoints at 1024px, 768px, 480px
  - Power flow animation keyframes and WS connection indicator styles
affects: [08-02, 08-03]

# Tech tracking
tech-stack:
  added: [preact-htm-signals-standalone]
  patterns: [import-map-vendoring, signal-based-state, hash-routing, computed-kpi]

key-files:
  created:
    - dvhub/public/vendor/preact-htm-signals.js
    - dvhub/public/components/shared/router.js
    - dvhub/public/components/shared/use-signal-store.js
    - dvhub/public/components/shared/compute.js
    - dvhub/public/components/shared/use-websocket.js
    - dvhub/public/components/shared/use-api.js
    - dvhub/public/components/shared/format.js
    - dvhub/public/components/shared/svg-utils.js
    - dvhub/public/components/app-shell.js
    - dvhub/public/components/dashboard/dashboard-page.js
    - dvhub/public/components/settings/settings-page.js
    - dvhub/public/components/setup/setup-page.js
    - dvhub/public/components/history/history-page.js
    - dvhub/public/components/tools/tools-page.js
    - dvhub/test/ui-import-map.test.js
    - dvhub/test/ui-kpi.test.js
    - dvhub/test/ui-responsive.test.js
  modified:
    - dvhub/public/index.html
    - dvhub/public/styles.css
    - dvhub/package.json

key-decisions:
  - "Extracted pure computeAutarky/computeSelfConsumption to compute.js for Node.js testability without Preact signals"
  - "Used standalone.js (not .module.js) from preact-htm-signals-standalone -- the package ships var-declaration ESM with export statement"
  - "Added 1024/768/480 breakpoints as SPA extensions alongside existing 1180/834/440 breakpoints"

patterns-established:
  - "Import map vendoring: all bare specifiers resolve to single vendored file"
  - "Signal-based state store: global signals for telemetry, computeds for derived KPIs"
  - "Pure computation extraction: testable functions in compute.js, signals in use-signal-store.js"

requirements-completed: [UI-01, UI-06, UI-08]

# Metrics
duration: 8min
completed: 2026-03-14
---

# Phase 08 Plan 01: SPA Foundation Summary

**Preact+HTM+Signals vendored bundle with import map SPA, hash router, WebSocket signal store, computed autarky/self-consumption KPIs, and responsive CSS breakpoints**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-14T16:32:46Z
- **Completed:** 2026-03-14T16:40:23Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments
- Vendored preact-htm-signals-standalone (22KB) locally for offline-first operation on LAN
- SPA index.html with import map resolving preact, preact/hooks, @preact/signals, htm/preact to single vendored file
- App shell with hash-based SPA routing between 5 views, mobile hamburger menu, and WebSocket connection indicator
- Signal store with computed autarky and self-consumption rates verified by 10 KPI computation tests
- Responsive CSS extensions with 3 additional breakpoints, power flow animation keyframes, and WS indicator styles

## Task Commits

Each task was committed atomically:

1. **Task 1: Vendor Preact bundle, create SPA index.html, shared modules, tests** - `b43f852` (feat)
2. **Task 2: App shell with navigation, responsive CSS, placeholder pages** - `27ad0f2` (feat)

## Files Created/Modified
- `dvhub/public/vendor/preact-htm-signals.js` - Vendored Preact+HTM+Signals standalone bundle (22KB)
- `dvhub/public/index.html` - Rewritten as SPA entry point with import map
- `dvhub/public/components/shared/router.js` - Hash-based SPA router with currentRoute signal
- `dvhub/public/components/shared/use-signal-store.js` - Global signal store with computed KPIs
- `dvhub/public/components/shared/compute.js` - Pure computation functions (autarky, self-consumption)
- `dvhub/public/components/shared/use-websocket.js` - WebSocket hook with exponential backoff
- `dvhub/public/components/shared/use-api.js` - API fetch hook with auth token
- `dvhub/public/components/shared/format.js` - Number/date formatters (power, energy, price, percent, time, date)
- `dvhub/public/components/shared/svg-utils.js` - Chart helpers (scaleLinear, computeBarLayout, formatAxisLabel)
- `dvhub/public/components/app-shell.js` - Navigation shell with routing and WS connection
- `dvhub/public/components/dashboard/dashboard-page.js` - Dashboard placeholder
- `dvhub/public/components/settings/settings-page.js` - Settings placeholder
- `dvhub/public/components/setup/setup-page.js` - Setup placeholder
- `dvhub/public/components/history/history-page.js` - History placeholder
- `dvhub/public/components/tools/tools-page.js` - Tools placeholder
- `dvhub/public/styles.css` - Extended with SPA responsive breakpoints and animations
- `dvhub/test/ui-import-map.test.js` - Import map structure tests (6 tests)
- `dvhub/test/ui-kpi.test.js` - KPI computation tests (10 tests)
- `dvhub/test/ui-responsive.test.js` - CSS breakpoint tests (8 tests)

## Decisions Made
- Extracted pure `computeAutarky`/`computeSelfConsumption` to `compute.js` (separate from signal store) so KPI formulas can be tested in Node.js without browser/Preact import map context
- Used `standalone.js` (not `.module.js`) from preact-htm-signals-standalone since that is the file the npm package actually ships
- Added plan-specified 1024/768/480 breakpoints as CSS extensions alongside existing device-specific 1180/834/440 breakpoints, preserving all existing responsive rules

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extracted compute.js for Node.js testability**
- **Found during:** Task 1 (KPI test creation)
- **Issue:** use-signal-store.js imports from `@preact/signals` which requires browser import map -- Node.js cannot resolve this bare specifier
- **Fix:** Extracted pure computation functions to `compute.js` with no framework dependencies; use-signal-store.js re-exports them
- **Files modified:** dvhub/public/components/shared/compute.js (new), dvhub/public/components/shared/use-signal-store.js, dvhub/test/ui-kpi.test.js
- **Verification:** All 10 KPI tests pass in Node.js
- **Committed in:** b43f852 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary architectural split for testability. No scope creep -- plan explicitly requested testable pure functions.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Self-Check: PASSED

All 18 created files verified present. Both task commits (b43f852, 27ad0f2) verified in git log. 24 test suite pass (6 import-map + 10 KPI + 8 responsive).

## Next Phase Readiness
- SPA foundation complete: all shared modules, router, signal store, and app shell ready
- Plan 02 (dashboard views) can build real widgets inside the placeholder pages
- Plan 03 (settings pages) can build settings UI using the shared components and API hook
