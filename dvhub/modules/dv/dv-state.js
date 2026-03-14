/**
 * DV State Factory
 *
 * Creates the DV module state with register management,
 * control state, and keepalive tracking.
 *
 * Register values are u16-clamped (0..65535).
 */

/**
 * Convert value to unsigned 16-bit integer.
 * Handles negatives and overflow via modular arithmetic.
 * @param {number} v
 * @returns {number} 0..65535
 */
export function u16(v) {
  let x = Math.trunc(Number(v) || 0);
  if (x < 0) x += 0x10000;
  return x & 0xffff;
}

/**
 * Creates DV module state.
 * @returns {object} State with dvRegs, ctrl, keepalive, setReg, getReg, updateRegistersFromTelemetry
 */
export function createDvState() {
  const dvRegs = { 0: 0, 1: 0, 3: 0, 4: 0 };
  const ctrl = {
    forcedOff: false,
    offUntil: 0,
    lastSignal: null,
    updatedAt: 0,
    dvControl: null
  };
  const keepalive = { modbusLastQuery: null };

  return {
    dvRegs,
    ctrl,
    keepalive,

    /**
     * Set a register value (u16-clamped).
     * @param {number} addr - Register address
     * @param {number} value - Value to set
     */
    setReg(addr, value) {
      dvRegs[addr] = u16(value);
    },

    /**
     * Get a register value (u16-clamped).
     * @param {number} addr - Register address
     * @returns {number} 0..65535
     */
    getReg(addr) {
      return u16(dvRegs[addr] ?? 0);
    },

    /**
     * Update registers from telemetry data using a provider adapter.
     * @param {object} meterData - Meter telemetry (e.g. { grid_total_w })
     * @param {object} provider - Provider adapter with formatRegisters method
     */
    updateRegistersFromTelemetry(meterData, provider) {
      const regs = provider.formatRegisters(meterData);
      for (const [addr, value] of Object.entries(regs)) {
        dvRegs[Number(addr)] = u16(value);
      }
    }
  };
}
