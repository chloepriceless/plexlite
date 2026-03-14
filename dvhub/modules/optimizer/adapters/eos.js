/**
 * EOS Optimizer Adapter
 *
 * Translates between DVhub telemetry snapshots and the EOS optimization API.
 * Validates EOS responses against JSON schema (SEC-02).
 *
 * EOS API flow:
 *   1. PUT  /v1/measurement/data        -- push current measurement
 *   2. POST /v1/prediction/update        -- trigger prediction
 *   3. GET  /v1/energy-management/optimization/solution -- get result
 *   4. GET  /v1/health                   -- health/version check
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import Ajv from 'ajv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const eosSchema = JSON.parse(
  readFileSync(join(__dirname, '..', 'schemas', 'eos-response.json'), 'utf8')
);

/**
 * Create an EOS optimizer adapter.
 * @param {object} [config]
 * @param {string} [config.baseUrl] - EOS API base URL (default: http://localhost:8503)
 * @param {number} [config.timeoutMs] - Request timeout in ms (default: 5000)
 * @param {string[]} [config.testedVersions] - Known-good EOS versions
 * @returns {object} Adapter implementing the optimizer adapter interface
 */
export function createEosAdapter(config = {}) {
  const baseUrl = config.baseUrl || 'http://localhost:8503';
  const timeoutMs = config.timeoutMs || 5000;
  const testedVersions = new Set(config.testedVersions || ['0.2.0']);

  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(eosSchema);

  /**
   * Build EOS API input from a telemetry snapshot.
   * @param {object} snapshot - Current system state
   * @returns {object} EOS measurement format
   */
  function buildInput(snapshot) {
    return {
      measurement: {
        battery_soc: [(snapshot.soc || 0) / 100],
        battery_power: [snapshot.batteryPowerW || 0],
        grid_import_w: [snapshot.gridImportW || 0],
        grid_export_w: [snapshot.gridExportW || 0],
        pv_power: [snapshot.pvTotalW || 0],
        load_power: [snapshot.loadPowerW || 0]
      },
      victron: {
        grid_setpoint_w: snapshot.gridSetpointW || 0,
        min_soc_pct: snapshot.minSocPct || 10,
        self_consumption_w: snapshot.selfConsumptionW || 0
      },
      prices: snapshot.prices || []
    };
  }

  /**
   * Validate an EOS API response against the JSON schema (SEC-02).
   * @param {object} raw - Raw response from EOS API
   * @returns {{ valid: boolean, errors?: object[] }}
   */
  function validateResponse(raw) {
    const valid = validate(raw);
    return valid ? { valid: true } : { valid: false, errors: validate.errors };
  }

  /**
   * Normalize EOS response to canonical plan format.
   * @param {object} raw - Validated EOS response
   * @returns {object} Canonical plan with 15-min slots
   */
  function normalizeOutput(raw) {
    return {
      optimizer: 'eos',
      runId: randomUUID(),
      createdAt: new Date().toISOString(),
      slots: raw.result.map(slot => ({
        start: slot.start_datetime,
        end: slot.end_datetime,
        gridImportWh: Number(slot.Last_Wh_pro_Stunde || 0),
        gridExportWh: Number(slot.Einspeisung_Wh_pro_Stunde || 0),
        batteryChargeWh: Number(slot.Akku_Wh_Charge || 0),
        batteryDischargeWh: Number(slot.Akku_Wh_Discharge || 0),
        targetSocPct: Number(slot.Akku_SoC || 0) * 100,
        expectedProfitEur: Number(slot.Kosten_EUR || 0),
        meta: { eautoSocPct: slot.Eauto_SoC_pro }
      }))
    };
  }

  /**
   * Check EOS service health and version.
   * @returns {Promise<{ healthy: boolean, version?: string, error?: string }>}
   */
  async function healthCheck() {
    try {
      const res = await fetch(`${baseUrl}/v1/health`, {
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!res.ok) return { healthy: false, error: `HTTP ${res.status}` };
      const data = await res.json();
      return { healthy: true, version: data.version || 'unknown' };
    } catch (err) {
      return { healthy: false, error: err.message };
    }
  }

  /**
   * Run full EOS optimization: push measurement, trigger prediction, get solution.
   * @param {object} snapshot - Current system state
   * @returns {Promise<object>} Canonical plan
   * @throws {Error} On HTTP failure or schema validation failure
   */
  async function optimize(snapshot) {
    const input = buildInput(snapshot);

    // Step 1: Push measurement data
    const putRes = await fetch(`${baseUrl}/v1/measurement/data`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.measurement),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!putRes.ok) throw new Error(`EOS PUT measurement failed: HTTP ${putRes.status}`);

    // Step 2: Trigger prediction update
    const postRes = await fetch(`${baseUrl}/v1/prediction/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!postRes.ok) throw new Error(`EOS POST prediction failed: HTTP ${postRes.status}`);

    // Step 3: Get optimization solution
    const getRes = await fetch(`${baseUrl}/v1/energy-management/optimization/solution`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!getRes.ok) throw new Error(`EOS GET solution failed: HTTP ${getRes.status}`);

    const raw = await getRes.json();

    // SEC-02: Validate response against schema
    const validation = validateResponse(raw);
    if (!validation.valid) {
      throw new Error(`Schema validation failed: ${JSON.stringify(validation.errors)}`);
    }

    return normalizeOutput(raw);
  }

  return {
    name: 'eos',
    baseUrl,
    testedVersions,
    buildInput,
    validateResponse,
    normalizeOutput,
    healthCheck,
    optimize
  };
}
