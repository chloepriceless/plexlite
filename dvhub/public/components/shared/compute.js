/**
 * Pure computation functions for KPI metrics.
 * No framework dependencies -- safe to import from Node.js tests.
 */

/**
 * Compute autarky rate: how much of the load is self-supplied (not from grid).
 * gridPower > 0 means import, gridPower < 0 means export.
 * Returns 0-100 integer, 0 if loadPower is 0.
 */
export function computeAutarky(loadPower, gridPower) {
  if (!loadPower || loadPower <= 0) return 0;
  const selfSupplied = loadPower - Math.max(0, gridPower);
  const rate = Math.round(Math.max(0, selfSupplied / loadPower) * 100);
  return Math.min(100, rate);
}

/**
 * Compute self-consumption rate: how much PV is consumed locally (not exported).
 * gridPower < 0 means export (feeding to grid).
 * Returns 0-100 integer, 0 if pvPower is 0.
 */
export function computeSelfConsumption(pvPower, gridPower) {
  if (!pvPower || pvPower <= 0) return 0;
  // -gridPower when negative = export amount; Math.max(0, -gridPower) = actual export
  const selfConsumed = pvPower - Math.max(0, -gridPower);
  const rate = Math.round(Math.max(0, selfConsumed / pvPower) * 100);
  return Math.min(100, rate);
}
