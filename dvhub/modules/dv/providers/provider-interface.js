/**
 * Provider Adapter Interface Documentation
 *
 * All DV provider adapters must implement this contract.
 * Each provider translates between the DV module's register model
 * and a specific DV operator's Modbus protocol.
 */

export const PROVIDER_INTERFACE = {
  /** @type {string} Provider identifier (e.g. 'luox') */
  name: 'string',

  /** @type {object} Register layout mapping: { power: 0, sign: 1, reserved: [3, 4] } */
  registerLayout: 'object',

  /**
   * Interpret a Modbus write to determine curtailment action.
   * @param {number} addr - Register address written to
   * @param {number[]} values - Written values (u16 array)
   * @returns {{ action: string, reason: string } | null} Signal or null if unknown
   */
  interpretWrite: 'function(addr, values) => {action, reason} | null',

  /**
   * Format meter telemetry data into register values.
   * @param {object} meterData - Meter readings (e.g. { grid_total_w })
   * @returns {object} Register map { 0: val, 1: val, 3: val, 4: val }
   */
  formatRegisters: 'function(meterData) => {0: val, 1: val, 3: val, 4: val}'
};
