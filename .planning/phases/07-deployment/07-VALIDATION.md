---
phase: 7
slug: deployment
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-14
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node:test) |
| **Config file** | none |
| **Quick run command** | `node --test dvhub/test/compose-manager.test.js dvhub/test/staggered-scheduler.test.js dvhub/test/install-preflight.test.js` |
| **Full suite command** | `cd dvhub && node --test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test dvhub/test/{changed-module}.test.js`
- **After every plan wave:** Run `cd dvhub && node --test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Created By | Status |
|---------|------|------|-------------|-----------|-------------------|-----------------|--------|
| 07-01-T1 | 07-01 | 1 | DEPLOY-01, DEPLOY-02, DEPLOY-05 | file-exists + grep | `test -f dvhub/deploy/docker-compose.yaml && grep -q "seccomp:unconfined" dvhub/deploy/docker-compose.yaml && echo PASS` | 07-01-T1 | pending |
| 07-01-T2 | 07-01 | 1 | DEPLOY-04, DEPLOY-06 | unit | `cd dvhub && node --test test/compose-manager.test.js` | 07-01-T2 | pending |
| 07-02-T1 | 07-02 | 2 | DEPLOY-04, DEPLOY-06 | unit | `cd dvhub && node --test test/staggered-scheduler.test.js` | 07-02-T1 | pending |
| 07-02-T2 | 07-02 | 2 | DEPLOY-01, DEPLOY-03 | contract | `cd dvhub && node --test test/install-preflight.test.js` | 07-02-T2 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Test scaffolds that must be created before or during implementation:

| Test File | Created By Task | Covers Requirement | Automated Command |
|-----------|-----------------|--------------------|--------------------|
| `dvhub/test/compose-manager.test.js` | 07-01-T2 | DEPLOY-04 (compose-manager unit tests) | `cd dvhub && node --test test/compose-manager.test.js` |
| `dvhub/test/staggered-scheduler.test.js` | 07-02-T1 | DEPLOY-06 (staggered scheduling logic) | `cd dvhub && node --test test/staggered-scheduler.test.js` |
| `dvhub/test/install-preflight.test.js` | 07-02-T2 | DEPLOY-03 (install.sh contract tests) | `cd dvhub && node --test test/install-preflight.test.js` |

All three test files are created by TDD tasks (tests written before implementation).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Docker Compose hybrid mode starts EOS/EMHASS/EVCC containers | DEPLOY-04, DEPLOY-05 | Requires Docker daemon and images pulled | Run `docker compose -f dvhub/deploy/docker-compose.yaml --profile hybrid up -d`, verify containers healthy with `docker compose ps` |
| Full-Docker mode runs entire stack | DEPLOY-02 | Requires Docker daemon and Dockerfile build | Run `docker compose -f dvhub/deploy/docker-compose.yaml --profile full up -d`, verify DVhub + optimizers all running |
| Native-only install.sh works on clean system | DEPLOY-03 | Requires clean test environment | Run `install.sh --mode native` on fresh VM, verify systemd service starts |
| Hybrid install.sh starts containers | DEPLOY-04 | Requires Docker daemon | Run `install.sh --mode hybrid`, verify both systemd service and Docker containers running |
| ARM64 containers run on Raspberry Pi | DEPLOY-01 | Requires physical Pi hardware | Pull and start containers on Pi, verify no arch errors |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] All test files are created by plan tasks (TDD approach)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
