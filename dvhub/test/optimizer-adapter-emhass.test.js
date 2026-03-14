import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createEmhassAdapter } from '../modules/optimizer/adapters/emhass.js';

describe('EMHASS Adapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = createEmhassAdapter({ baseUrl: 'http://localhost:5000' });
  });

  it('createEmhassAdapter(config) returns object with correct interface', () => {
    assert.equal(adapter.name, 'emhass');
    assert.equal(adapter.baseUrl, 'http://localhost:5000');
    assert.equal(typeof adapter.buildInput, 'function');
    assert.equal(typeof adapter.validateResponse, 'function');
    assert.equal(typeof adapter.normalizeOutput, 'function');
    assert.equal(typeof adapter.healthCheck, 'function');
    assert.equal(typeof adapter.optimize, 'function');
    assert.ok(adapter.testedVersions instanceof Set);
  });

  it('buildInput converts snapshot to EMHASS format with soc_init as 0-1 fraction', () => {
    const snapshot = {
      soc: 75,
      batteryPowerW: 500,
      pvTotalW: 2000,
      loadPowerW: 1200,
      gridTotalW: -800,
      prices: [{ ts: '2026-03-14T10:00:00Z', ct_kwh: 5 }],
      timestamps: ['2026-03-14T10:00:00Z']
    };
    const input = adapter.buildInput(snapshot);
    assert.equal(input.soc_init, 0.75);
    assert.equal(input.battery_power_w, 500);
    assert.equal(input.pv_power_w, 2000);
    assert.equal(input.load_power_w, 1200);
    assert.equal(input.grid_power_w, -800);
    assert.deepEqual(input.prices, snapshot.prices);
    assert.deepEqual(input.timestamps, snapshot.timestamps);
    assert.equal(input.costfun, 'profit');
  });

  it('validateResponse accepts any object (permissive schema)', () => {
    const res = adapter.validateResponse({ anything: true });
    assert.equal(res.valid, true);
  });

  it('validateResponse rejects null', () => {
    const res = adapter.validateResponse(null);
    assert.equal(res.valid, false);
  });

  it('normalizeOutput converts EMHASS arrays to canonical 15-min slot plan', () => {
    const raw = {
      P_PV: [1000, 1200],
      P_Load: [500, 600],
      P_grid_pos: [200, 0],
      P_grid_neg: [0, -300],
      P_batt: [100, -50],
      SOC_opt: [0.6, 0.58],
      timestamps: ['2026-03-14T10:00:00Z', '2026-03-14T10:15:00Z']
    };
    const plan = adapter.normalizeOutput(raw);

    assert.equal(plan.optimizer, 'emhass');
    assert.ok(plan.runId);
    assert.ok(plan.createdAt);
    assert.equal(plan.slots.length, 2);

    // Slot 0: positive grid import, positive battery (charge)
    const s0 = plan.slots[0];
    assert.equal(s0.start, '2026-03-14T10:00:00Z');
    assert.equal(s0.end, '2026-03-14T10:15:00Z');
    assert.equal(s0.gridImportWh, 200 * 0.25);   // 50
    assert.equal(s0.gridExportWh, 0);
    assert.equal(s0.batteryChargeWh, 100 * 0.25); // 25
    assert.equal(s0.batteryDischargeWh, 0);
    assert.equal(s0.targetSocPct, 60);

    // Slot 1: negative grid (export), negative battery (discharge)
    const s1 = plan.slots[1];
    assert.equal(s1.gridImportWh, 0);
    assert.equal(s1.gridExportWh, 300 * 0.25);    // 75
    assert.equal(s1.batteryChargeWh, 0);
    assert.equal(s1.batteryDischargeWh, 50 * 0.25); // 12.5
    assert.ok(Math.abs(s1.targetSocPct - 58) < 0.001, `targetSocPct should be ~58, got ${s1.targetSocPct}`);
  });

  describe('healthCheck', () => {
    let origFetch;
    beforeEach(() => { origFetch = globalThis.fetch; });
    afterEach(() => { globalThis.fetch = origFetch; });

    it('returns { healthy: true } on successful connection', async () => {
      globalThis.fetch = async () => ({ ok: true });
      const result = await adapter.healthCheck();
      assert.equal(result.healthy, true);
    });

    it('returns { healthy: false, error } on failure', async () => {
      globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };
      const result = await adapter.healthCheck();
      assert.equal(result.healthy, false);
      assert.ok(result.error.includes('ECONNREFUSED'));
    });
  });

  describe('optimize', () => {
    let origFetch;
    beforeEach(() => { origFetch = globalThis.fetch; });
    afterEach(() => { globalThis.fetch = origFetch; });

    it('calls single POST to /action/naive-mpc-optim and returns normalized plan', async () => {
      const calls = [];
      globalThis.fetch = async (url, opts) => {
        calls.push({ url, method: opts?.method || 'GET' });
        return {
          ok: true,
          json: async () => ({
            P_PV: [1000],
            P_Load: [500],
            P_grid_pos: [200],
            P_grid_neg: [0],
            P_batt: [100],
            SOC_opt: [0.6],
            timestamps: ['2026-03-14T10:00:00Z']
          })
        };
      };
      const snapshot = { soc: 50, pvTotalW: 1000 };
      const plan = await adapter.optimize(snapshot);

      assert.equal(calls.length, 1);
      assert.ok(calls[0].url.includes('/action/naive-mpc-optim'));
      assert.equal(calls[0].method, 'POST');
      assert.equal(plan.optimizer, 'emhass');
      assert.equal(plan.slots.length, 1);
    });
  });
});
