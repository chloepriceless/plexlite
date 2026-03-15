---
phase: 13
slug: chart-interactivity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node --test) |
| **Config file** | none — existing pattern from Phase 12 |
| **Quick run command** | `node --test dvhub/test/price-chart-*.test.js` |
| **Full suite command** | `node --test dvhub/test/price-chart-*.test.js dvhub/test/chart-selection.test.js` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test dvhub/test/price-chart-*.test.js`
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | CHART-01 | unit | `node --test dvhub/test/chart-selection.test.js` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | CHART-01 | unit | `node --test dvhub/test/chart-selection.test.js` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 2 | CHART-02, CHART-03 | unit | `node --test dvhub/test/price-chart-compute.test.js` | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 2 | CHART-04 | unit | `node --test dvhub/test/price-chart-compute.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `dvhub/test/chart-selection.test.js` — stubs for CHART-01 (selection logic, window building)
- [ ] `dvhub/test/price-chart-compute.test.js` — extend existing for CHART-02, CHART-03, CHART-04

*Existing infrastructure covers test framework — no new installs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tooltip follows cursor | CHART-02 | DOM position requires browser | Hover over bars, verify tooltip appears at cursor +12px |
| Drag selection visual | CHART-01 | SVG class toggle requires browser | Mousedown + drag across bars, verify blue highlight |
| Import overlay rendering | CHART-03 | SVG polyline visual | Check green dashed line renders over bars |
| Margin summary hover update | CHART-04 | Real-time DOM update | Hover bars, verify summary text changes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
