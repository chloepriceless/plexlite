import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createEosAdapter } from '../modules/optimizer/adapters/eos.js';

describe('EOS Adapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = createEosAdapter({ baseUrl: 'http://localhost:8503' });
  });

  it('createEosAdapter(config) returns object with correct interface', () => {
    assert.equal(adapter.name, 'eos');
    assert.equal(adapter.baseUrl, 'http://localhost:8503');
    assert.equal(typeof adapter.buildInput, 'function');
    assert.equal(typeof adapter.validateResponse, 'function');
    assert.equal(typeof adapter.normalizeOutput, 'function');
    assert.equal(typeof adapter.healthCheck, 'function');
    assert.equal(typeof adapter.optimize, 'function');
    assert.ok(adapter.testedVersions instanceof Set);
  });

  it('buildInput converts snapshot to EOS measurement format', () => {
    const snapshot = {
      soc: 50,
      pvTotalW: 3000,
      loadPowerW: 800,
      gridImportW: 0,
      gridExportW: 2200,
      batteryPowerW: 0,
      prices: [{ ts: '2026-03-14T10:00:00Z', ct_kwh: 5 }]
    };
    const input = adapter.buildInput(snapshot);
    assert.deepEqual(input.measurement.battery_soc, [0.5]);
    assert.deepEqual(input.measurement.pv_power, [3000]);
    assert.deepEqual(input.measurement.load_power, [800]);
    assert.deepEqual(input.measurement.grid_import_w, [0]);
    assert.deepEqual(input.measurement.grid_export_w, [2200]);
    assert.deepEqual(input.measurement.battery_power, [0]);
    assert.deepEqual(input.prices, snapshot.prices);
  });

  it('validateResponse with valid EOS result returns { valid: true }', () => {
    const raw = {
      result: [
        { start_datetime: '2026-03-14T10:00:00', end_datetime: '2026-03-14T10:15:00' }
      ]
    };
    const res = adapter.validateResponse(raw);
    assert.equal(res.valid, true);
  });

  it('validateResponse with missing result key returns { valid: false } (SEC-02)', () => {
    const raw = { notResult: [] };
    const res = adapter.validateResponse(raw);
    assert.equal(res.valid, false);
    assert.ok(Array.isArray(res.errors));
    assert.ok(res.errors.length > 0);
  });

  it('normalizeOutput converts EOS slots to canonical format', () => {
    const raw = {
      result: [
        {
          start_datetime: '2026-03-14T10:00:00',
          end_datetime: '2026-03-14T10:15:00',
          Last_Wh_pro_Stunde: 150,
          Einspeisung_Wh_pro_Stunde: 0,
          Akku_Wh_Charge: 200,
          Akku_Wh_Discharge: 0,
          Akku_SoC: 0.65,
          Kosten_EUR: -0.02,
          Eauto_SoC_pro: 80
        }
      ]
    };
    const plan = adapter.normalizeOutput(raw);
    assert.equal(plan.optimizer, 'eos');
    assert.ok(plan.runId);
    assert.ok(plan.createdAt);
    assert.equal(plan.slots.length, 1);

    const slot = plan.slots[0];
    assert.equal(slot.start, '2026-03-14T10:00:00');
    assert.equal(slot.end, '2026-03-14T10:15:00');
    assert.equal(slot.gridImportWh, 150);
    assert.equal(slot.gridExportWh, 0);
    assert.equal(slot.batteryChargeWh, 200);
    assert.equal(slot.batteryDischargeWh, 0);
    assert.equal(slot.targetSocPct, 65);
    assert.equal(slot.expectedProfitEur, -0.02);
    assert.deepEqual(slot.meta, { eautoSocPct: 80 });
  });

  it('normalizeOutput generates runId (UUID) and createdAt (ISO string)', () => {
    const raw = { result: [{ start_datetime: 'a', end_datetime: 'b' }] };
    const plan = adapter.normalizeOutput(raw);
    // UUID v4 format
    assert.match(plan.runId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    // ISO date string
    assert.ok(new Date(plan.createdAt).toISOString() === plan.createdAt);
  });

  describe('healthCheck', () => {
    let origFetch;
    beforeEach(() => { origFetch = globalThis.fetch; });
    afterEach(() => { globalThis.fetch = origFetch; });

    it('fetches /v1/health and returns { healthy: true, version }', async () => {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ version: '0.2.0' })
      });
      const result = await adapter.healthCheck();
      assert.equal(result.healthy, true);
      assert.equal(result.version, '0.2.0');
    });

    it('returns { healthy: false, error } on fetch failure', async () => {
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

    it('calls 3-step PUT/POST/GET flow and returns normalized plan', async () => {
      const calls = [];
      globalThis.fetch = async (url, opts) => {
        calls.push({ url, method: opts?.method || 'GET' });
        return {
          ok: true,
          json: async () => ({
            result: [
              { start_datetime: '2026-03-14T10:00:00', end_datetime: '2026-03-14T10:15:00' }
            ]
          })
        };
      };
      const snapshot = { soc: 50, pvTotalW: 3000, loadPowerW: 800 };
      const plan = await adapter.optimize(snapshot);

      assert.equal(calls.length, 3);
      assert.ok(calls[0].url.includes('/v1/measurement/data'));
      assert.equal(calls[0].method, 'PUT');
      assert.ok(calls[1].url.includes('/v1/prediction/update'));
      assert.equal(calls[1].method, 'POST');
      assert.ok(calls[2].url.includes('/v1/energy-management/optimization/solution'));
      assert.equal(calls[2].method, 'GET');

      assert.equal(plan.optimizer, 'eos');
      assert.equal(plan.slots.length, 1);
    });

    it('throws on schema validation failure', async () => {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({ notResult: 'bad' })
      });
      const snapshot = { soc: 50 };
      await assert.rejects(() => adapter.optimize(snapshot), /Schema validation failed/);
    });
  });
});
