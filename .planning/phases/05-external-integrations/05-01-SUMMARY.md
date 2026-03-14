---
phase: 05-external-integrations
plan: 01
subsystem: optimizer
tags: [evcc, tariff, rxjs, behaviorsubject, epex, module3, paragraph14a]

# Dependency graph
requires:
  - phase: 04-optimizer-core
    provides: BehaviorSubject pattern, factory function pattern, Ajv schema validation
provides:
  - EVCC bridge service polling /api/state with BehaviorSubject state stream
  - Tariff engine resolving fixed/dynamic/Module 3 prices for any timestamp
  - Ajv JSON schema for EVCC state validation
affects: [05-external-integrations, 06-arbitration]

# Tech tracking
tech-stack:
  added: []
  patterns: [EVCC dual-format handling v0.207+ and legacy, Module 3 timezone-safe window matching via Intl.DateTimeFormat]

key-files:
  created:
    - dvhub/modules/optimizer/services/evcc-bridge.js
    - dvhub/modules/optimizer/services/tariff-engine.js
    - dvhub/modules/optimizer/schemas/evcc-state.json
    - dvhub/test/evcc-bridge.test.js
    - dvhub/test/tariff-engine.test.js
  modified: []

key-decisions:
  - "EVCC bridge uses dual-format handling (data.loadpoints || data.result?.loadpoints) for v0.207+ and legacy compatibility"
  - "Tariff engine uses startDate/endDate field names matching config.example.json convention (not start/end as in plan interfaces)"
  - "Module 3 window matching uses Intl.DateTimeFormat for timezone-safe Europe/Berlin resolution"
  - "Period endDate is inclusive (end of day) for user-friendly date range semantics"

patterns-established:
  - "EVCC polling: fetch with AbortSignal.timeout(5000), normalizeLoadpoint for each raw loadpoint, timer.unref()"
  - "Tariff resolution: findActivePeriod for period overrides, findActiveModule3Window for HT/NT/ST, computeTotalImportCost for gross calculation"

requirements-completed: [OPT-03, OPT-05, OPT-06]

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 5 Plan 01: EVCC Bridge and Tariff Engine Summary

**EVCC REST polling bridge with BehaviorSubject state stream and multi-mode tariff engine resolving fixed/dynamic/Module 3 prices via Europe/Berlin timezone**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-14T14:05:11Z
- **Completed:** 2026-03-14T14:08:26Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- EVCC bridge service polls /api/state with dual-format handling (v0.207+ flat and legacy result-wrapped)
- Tariff engine resolves prices across fixed, dynamic, and period-override modes
- Paragraph 14a Module 3 time-variable network charges with HT/NT/ST window matching in Europe/Berlin
- Both services follow factory function pattern with full test coverage (20 tests total)

## Task Commits

Each task was committed atomically:

1. **Task 1: EVCC Bridge Service with Tests** - `ba9999f` (feat)
2. **Task 2: Tariff Engine Service with Tests** - `3b301a7` (feat)

_Note: TDD tasks -- tests written first (RED), implementation second (GREEN)._

## Files Created/Modified
- `dvhub/modules/optimizer/services/evcc-bridge.js` - EVCC REST polling with BehaviorSubject state stream
- `dvhub/modules/optimizer/services/tariff-engine.js` - Multi-mode tariff price resolution with Module 3 windows
- `dvhub/modules/optimizer/schemas/evcc-state.json` - Ajv JSON schema for EVCC loadpoint normalization
- `dvhub/test/evcc-bridge.test.js` - 9 tests for EVCC bridge polling, normalization, error handling
- `dvhub/test/tariff-engine.test.js` - 11 tests for all tariff modes and Module 3 windows

## Decisions Made
- EVCC bridge uses dual-format handling for backward compatibility with pre-v0.207 EVCC instances
- Tariff engine uses startDate/endDate field names matching config.example.json (plan referenced start/end but actual config uses startDate/endDate)
- Module 3 window matching uses Intl.DateTimeFormat for timezone-safe resolution (no hand-rolled UTC offset math)
- Period endDate treated as inclusive (end of day) for intuitive date range semantics

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Config field name mismatch: startDate/endDate vs start/end**
- **Found during:** Task 2 (Tariff Engine)
- **Issue:** Plan interfaces section used `start`/`end` for period date fields, but actual config.example.json uses `startDate`/`endDate`
- **Fix:** Tariff engine's findActivePeriod checks both field names with fallback: `period.startDate || period.start`
- **Files modified:** dvhub/modules/optimizer/services/tariff-engine.js
- **Verification:** Tests pass with config using startDate/endDate format
- **Committed in:** 3b301a7

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary for correctness with actual config structure. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EVCC bridge and tariff engine are self-contained factory functions ready for wiring into optimizer module (Plan 03)
- Both services expose the same BehaviorSubject/factory patterns used throughout Phases 3-4
- Module 3 windows are fully configurable per Netzbetreiber requirements

---
*Phase: 05-external-integrations*
*Completed: 2026-03-14*
