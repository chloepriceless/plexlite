---
phase: 2
slug: data-architecture
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node:test) |
| **Config file** | none |
| **Quick run command** | `node --test test/db-adapter*.test.js` |
| **Full suite command** | `node --test test/` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test test/db-adapter*.test.js`
- **After every plan wave:** Run `node --test test/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | DATA-01 | unit | `node --test test/db-adapter.test.js` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | DATA-03 | unit | `node --test test/db-adapter.test.js` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | DATA-04 | integration | `node --test test/db-timescale.test.js` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 1 | DATA-02, DATA-05 | integration | `node --test test/db-timescale.test.js` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 1 | DATA-04 | unit | `node --test test/db-sqlite.test.js` | ❌ W0 | ⬜ pending |
| 2-03-02 | 03 | 1 | DATA-05 | unit | `node --test test/db-sqlite.test.js` | ❌ W0 | ⬜ pending |
| 2-04-01 | 04 | 2 | GW-04 | integration | `node --test test/db-integration.test.js` | ❌ W0 | ⬜ pending |
| 2-04-02 | 04 | 2 | DATA-06 | integration | `node --test test/db-integration.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/db-adapter.test.js` — stubs for DATA-01, DATA-03 (adapter interface, schema prefixes)
- [ ] `test/db-timescale.test.js` — stubs for DATA-02, DATA-04, DATA-05 (hypertables, CAs, retention)
- [ ] `test/db-sqlite.test.js` — stubs for DATA-04, DATA-05 (WAL, partitioning, manual rollups)
- [ ] `test/db-integration.test.js` — stubs for GW-04, DATA-06 (gateway integration, performance)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TimescaleDB Continuous Aggregates refresh correctly | DATA-05 | Requires running TimescaleDB instance with real data over time | Insert test data, wait for CA refresh, verify rollup values |
| 30-day query performance < 500ms | DATA-06 | Requires representative data volume | Load 30 days of telemetry, run query, measure latency |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
