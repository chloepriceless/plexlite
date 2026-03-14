/**
 * LUOX Provider Adapter
 *
 * Translates between the DV module's register model
 * and the LUOX DV operator's Modbus protocol.
 *
 * Register layout:
 *   0 = power (u16, absolute watts)
 *   1 = sign  (0x0000 = positive/export, 0xFFFF = negative/import)
 *   3 = reserved
 *   4 = reserved
 *
 * Curtailment signals:
 *   addr 0, [0x0000, 0x0000] => curtail (power off)
 *   addr 0, [0xFFFF, 0xFFFF] => release (power on)
 *   addr 3, [0x0001]         => curtail
 *   addr 3, [0x0000]         => release
 */

import { u16 } from '../dv-state.js';

/**
 * Create a LUOX provider adapter.
 * @returns {object} Provider matching PROVIDER_INTERFACE contract
 */
export function createLuoxProvider() {
  return {
    name: 'luox',

    registerLayout: {
      power: 0,
      sign: 1,
      reserved: [3, 4]
    },

    /**
     * Interpret a Modbus write to determine curtailment action.
     * @param {number} addr - Register address
     * @param {number[]} values - Written values
     * @returns {{ action: string, reason: string } | null}
     */
    interpretWrite(addr, values) {
      if (addr === 0 && values.length >= 2) {
        if (values[0] === 0 && values[1] === 0) {
          return { action: 'curtail', reason: 'fc16_addr0_0000' };
        }
        if (values[0] === 0xffff && values[1] === 0xffff) {
          return { action: 'release', reason: 'fc16_addr0_ffff' };
        }
      }
      if (addr === 3 && values.length >= 1) {
        if (values[0] === 1) {
          return { action: 'curtail', reason: 'fc16_addr3_0001' };
        }
        if (values[0] === 0) {
          return { action: 'release', reason: 'fc16_addr3_0000' };
        }
      }
      return null;
    },

    /**
     * Format meter telemetry data into register values.
     * @param {object} meterData - { grid_total_w, ... }
     * @returns {object} { 0: power, 1: sign, 3: 0, 4: 0 }
     */
    formatRegisters(meterData) {
      const gridW = meterData.grid_total_w ?? 0;
      const isNegative = gridW < 0;
      return {
        0: u16(gridW),
        1: isNegative ? 0xffff : 0,
        3: 0,
        4: 0
      };
    }
  };
}
