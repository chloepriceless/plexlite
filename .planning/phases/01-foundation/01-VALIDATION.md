---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node:test) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `node --test tests/unit/` |
| **Full suite command** | `node --test tests/` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/unit/`
- **After every plan wave:** Run `node --test tests/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | ARCH-01 | unit | `node --test tests/unit/module-registry.test.js` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | ARCH-02 | unit | `node --test tests/unit/module-activation.test.js` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | GW-01 | integration | `node --test tests/integration/fastify-server.test.js` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | GW-05 | unit | `node --test tests/unit/event-bus.test.js` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | GW-02 | unit | `node --test tests/unit/device-hal.test.js` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 2 | SEC-01 | integration | `node --test tests/integration/modbus-security.test.js` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 2 | SEC-04 | unit | `node --test tests/unit/auth-roles.test.js` | ❌ W0 | ⬜ pending |
| 1-04-02 | 04 | 2 | SEC-05 | integration | `node --test tests/integration/ws-auth.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/module-registry.test.js` — stubs for ARCH-01, ARCH-02
- [ ] `tests/unit/event-bus.test.js` — stubs for GW-05
- [ ] `tests/unit/device-hal.test.js` — stubs for GW-02, GW-03
- [ ] `tests/unit/auth-roles.test.js` — stubs for SEC-04, SEC-05
- [ ] `tests/integration/fastify-server.test.js` — stubs for GW-01, ARCH-05
- [ ] `tests/integration/modbus-security.test.js` — stubs for SEC-01
- [ ] `tests/integration/ws-auth.test.js` — stubs for SEC-05
- [ ] `tests/helpers/fixtures.js` — shared test fixtures

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Existing API responses identical to v1 | ARCH-04 | Requires running v1 and v2 side-by-side | Capture v1 responses with curl, compare against v2 |
| Real Victron hardware poll via Modbus TCP | GW-06 | Requires physical hardware | Connect to test Victron device, verify telemetry stream |
| DV real-time latency < 2x pollInterval | GW-05 | Requires timing measurement under load | Run poll loop, measure time between poll and getValue() |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
