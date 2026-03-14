/**
 * EMHASS Optimizer Adapter
 *
 * Translates between DVhub telemetry snapshots and the EMHASS optimization API.
 * Uses a permissive response schema (tighten after container testing).
 *
 * EMHASS API:
 *   - POST /action/dayahead-optim     -- day-ahead optimization
 *   - POST /action/naive-mpc-optim    -- MPC optimization (used by default)
 *   - GET  /                          -- health check
 */

import { randomUUID } from 'node:crypto';

/**
 * Create an EMHASS optimizer adapter.
 * @param {object} [config]
 * @param {string} [config.baseUrl] - EMHASS API base URL (default: http://localhost:5000)
 * @param {number} [config.timeoutMs] - Request timeout in ms (default: 5000)
 * @param {string[]} [config.testedVersions] - Known-good EMHASS versions
 * @returns {object} Adapter implementing the optimizer adapter interface
 */
export function createEmhassAdapter(config = {}) {
  const baseUrl = config.baseUrl || 'http://localhost:5000';
  const timeoutMs = config.timeoutMs || 5000;
  const testedVersions = new Set(config.testedVersions || ['0.17.0']);

  /**
   * Build EMHASS API input from a telemetry snapshot.
   * @param {object} snapshot - Current system state
   * @returns {object} EMHASS input format
   */
  function buildInput(snapshot) {
    return {
      soc_init: (snapshot.soc || 0) / 100,
      battery_power_w: snapshot.batteryPowerW || 0,
      pv_power_w: snapshot.pvTotalW || 0,
      load_power_w: snapshot.loadPowerW || 0,
      grid_power_w: snapshot.gridTotalW || 0,
      prices: snapshot.prices || [],
      timestamps: snapshot.timestamps || [],
      costfun: 'profit'
    };
  }

  /**
   * Validate an EMHASS response (permissive -- tighten after container testing).
   * @param {object} raw - Raw response from EMHASS API
   * @returns {{ valid: boolean }}
   */
  function validateResponse(raw) {
    return { valid: typeof raw === 'object' && raw !== null };
  }

  /**
   * Add minutes to an ISO timestamp string.
   * @param {string} ts - ISO timestamp
   * @param {number} minutes - Minutes to add
   * @returns {string} New ISO timestamp
   */
  function addMinutes(ts, minutes) {
    const d = new Date(ts);
    d.setMinutes(d.getMinutes() + minutes);
    return d.toISOString();
  }

  /**
   * Normalize EMHASS parallel arrays to canonical 15-min slot plan.
   * @param {object} raw - Validated EMHASS response
   * @returns {object} Canonical plan with 15-min slots
   */
  function normalizeOutput(raw) {
    const timestamps = raw.timestamps || [];
    const count = Math.max(
      timestamps.length,
      (raw.P_PV || []).length,
      (raw.P_Load || []).length,
      1
    );

    const slots = [];
    for (let i = 0; i < count; i++) {
      const start = timestamps[i] || addMinutes(timestamps[0] || new Date().toISOString(), i * 15);
      const end = timestamps[i + 1] || addMinutes(start, 15);

      const gridPos = raw.P_grid_pos?.[i] || 0;
      const gridNeg = raw.P_grid_neg?.[i] || 0;
      const batt = raw.P_batt?.[i] || 0;
      const soc = raw.SOC_opt?.[i] || 0;

      slots.push({
        start,
        end,
        gridImportWh: Math.max(0, gridPos) * 0.25,
        gridExportWh: Math.abs(Math.min(0, gridNeg)) * 0.25,
        batteryChargeWh: Math.max(0, batt) * 0.25,
        batteryDischargeWh: Math.abs(Math.min(0, batt)) * 0.25,
        targetSocPct: soc * 100,
        expectedProfitEur: 0,
        meta: null
      });
    }

    return {
      optimizer: 'emhass',
      runId: randomUUID(),
      createdAt: new Date().toISOString(),
      slots
    };
  }

  /**
   * Check EMHASS service health.
   * @returns {Promise<{ healthy: boolean, version?: string, error?: string }>}
   */
  async function healthCheck() {
    try {
      const res = await fetch(baseUrl, {
        signal: AbortSignal.timeout(timeoutMs)
      });
      return { healthy: res.ok, version: 'unknown' };
    } catch (err) {
      return { healthy: false, error: err.message };
    }
  }

  /**
   * Run EMHASS MPC optimization.
   * @param {object} snapshot - Current system state
   * @returns {Promise<object>} Canonical plan
   * @throws {Error} On HTTP failure or validation failure
   */
  async function optimize(snapshot) {
    const input = buildInput(snapshot);

    const res = await fetch(`${baseUrl}/action/naive-mpc-optim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) throw new Error(`EMHASS POST optimize failed: HTTP ${res.status}`);

    const raw = await res.json();

    const validation = validateResponse(raw);
    if (!validation.valid) {
      throw new Error('Schema validation failed');
    }

    return normalizeOutput(raw);
  }

  return {
    name: 'emhass',
    baseUrl,
    testedVersions,
    buildInput,
    validateResponse,
    normalizeOutput,
    healthCheck,
    optimize
  };
}
