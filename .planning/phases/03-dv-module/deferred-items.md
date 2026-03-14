# Deferred Items - Phase 03

## Pre-existing test failure

**File:** `dvhub/test/dv-control-readback-runtime.test.js`
**Issue:** Test reads from `server.js` looking for `buildDvControlReadbackPollConfig` and `buildDvControlReadbackPolls`, but these functions were moved to `modules/gateway/index.js` during Phase 01-04 bootstrap rewrite.
**Impact:** Test was already failing before Phase 03 changes.
**Fix:** Update test to read from `modules/gateway/index.js` instead of `server.js`.
