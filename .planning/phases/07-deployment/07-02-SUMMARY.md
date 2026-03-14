---
phase: 07-deployment
plan: 02
subsystem: infra
tags: [install, npm-ci, docker, systemd, staggered-scheduling, compose-lifecycle]

# Dependency graph
requires:
  - phase: 07-deployment-01
    provides: Docker Compose profiles, compose-manager, systemd template
  - phase: 04-optimizer
    provides: optimizer module with adapter registry and plan engine
provides:
  - Enhanced install.sh with npm ci, mode detection, Docker preflight
  - Staggered optimizer scheduling for CPU-safe Pi operation
  - Compose lifecycle integration in optimizer module
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [staggered-scheduling, compose-lifecycle-wrapper, install-mode-detection]

key-files:
  created:
    - dvhub/modules/optimizer/services/staggered-scheduler.js
    - dvhub/modules/optimizer/services/compose-lifecycle.js
    - dvhub/test/staggered-scheduler.test.js
    - dvhub/test/compose-lifecycle.test.js
    - dvhub/test/install-preflight.test.js
  modified:
    - install.sh
    - dvhub/modules/optimizer/index.js

key-decisions:
  - "Staggered scheduler uses setTimeout+setInterval with unref() for non-blocking timers"
  - "Compose lifecycle swallows errors to be non-fatal when Docker is unavailable"
  - "Install.sh uses sed template substitution instead of inline heredoc for systemd service"
  - "Contract tests grep install.sh for patterns rather than executing it"

patterns-established:
  - "Staggered scheduling: evenly distribute adapter runs within interval"
  - "Compose lifecycle: error-swallowing wrapper for compose-manager"
  - "Install contract tests: regex-based structural validation of shell scripts"

requirements-completed: [DEPLOY-01, DEPLOY-03, DEPLOY-04, DEPLOY-06]

# Metrics
duration: 5min
completed: 2026-03-14
---

# Phase 7 Plan 2: Installer Enhancement and Optimizer Scheduling Summary

**npm ci reproducible installs with mode detection, staggered optimizer scheduling to prevent Pi CPU saturation, and compose-lifecycle for module-level Docker control**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-14T15:41:50Z
- **Completed:** 2026-03-14T15:47:21Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Staggered scheduler distributes optimizer adapter runs evenly within interval (2 adapters at 60min = 30min offset)
- Compose lifecycle wraps compose-manager with error swallowing for non-fatal Docker failures
- install.sh upgraded to npm ci with package-lock.json validation for reproducible installs
- install.sh accepts --mode (native/hybrid/full) with Docker preflight validation
- Hardened systemd template used via sed substitution instead of inline heredoc
- 14 new tests passing (5 stagger + 4 lifecycle + 5 install contract)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing staggered-scheduler and compose-lifecycle tests** - `223f869` (test)
2. **Task 1 GREEN: Staggered-scheduler and compose-lifecycle implementation** - `1722903` (feat)
3. **Task 2: Enhanced install.sh with npm ci and mode detection** - `f4c13fc` (feat)

## Files Created/Modified
- `dvhub/modules/optimizer/services/staggered-scheduler.js` - Distributes optimizer runs evenly within interval
- `dvhub/modules/optimizer/services/compose-lifecycle.js` - Wraps compose-manager for module lifecycle
- `dvhub/modules/optimizer/index.js` - Integrates staggered-scheduler and compose-lifecycle
- `dvhub/test/staggered-scheduler.test.js` - 5 unit tests for stagger offset calculation and timer behavior
- `dvhub/test/compose-lifecycle.test.js` - 4 unit tests with DI mocks
- `dvhub/test/install-preflight.test.js` - 5 contract tests grepping install.sh patterns
- `install.sh` - npm ci, --mode, Docker preflight, sed template, Docker Compose startup

## Decisions Made
- Staggered scheduler uses setTimeout for initial offset then setInterval for repeating, all with unref()
- Compose lifecycle factory accepts _createManager DI parameter for testing without Docker
- Install.sh contract tests use fs.readFileSync + regex instead of actually running the shell script
- Full mode skips systemd service start since DVhub runs in container

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 7 (Deployment) is complete: all deployment infrastructure in place
- install.sh ready for production use with native, hybrid, and full modes
- Optimizer scheduling prevents resource contention on Raspberry Pi

---
*Phase: 07-deployment*
*Completed: 2026-03-14*
