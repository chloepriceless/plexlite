/**
 * Pure function: compute flow lines from telemetry data.
 * Extracted for Node.js testability without Preact import map.
 *
 * @param {{ pvPower?: number, batteryPower?: number, gridPower?: number, loadPower?: number, evPower?: number }} data
 * @returns {Array<{ from: string, to: string, power: number, active: boolean, reverse: boolean }>}
 */
export function computeFlowLines(data) {
  const pv = data.pvPower || 0;
  const bat = data.batteryPower || 0;   // >0 = charging, <0 = discharging
  const grid = data.gridPower || 0;     // >0 = importing, <0 = exporting
  const load = data.loadPower || 0;
  const ev = data.evPower || 0;

  const lines = [];

  // PV -> Battery (when PV producing and battery charging)
  const pvToBat = pv > 0 && bat > 0 ? Math.min(pv, bat) : 0;
  lines.push({ from: 'pv', to: 'battery', power: pvToBat, active: pvToBat > 0, reverse: false });

  // PV -> Load (self-consumption from PV)
  const pvToLoad = pv > 0 ? Math.min(pv, load) : 0;
  lines.push({ from: 'pv', to: 'load', power: pvToLoad, active: pvToLoad > 0, reverse: false });

  // PV -> Grid (export when PV excess)
  const pvToGrid = pv > 0 && grid < 0 ? Math.abs(grid) : 0;
  lines.push({ from: 'pv', to: 'grid', power: pvToGrid, active: pvToGrid > 0, reverse: false });

  // Grid -> Load (import from grid)
  const gridToLoad = grid > 0 ? grid : 0;
  lines.push({ from: 'grid', to: 'load', power: gridToLoad, active: gridToLoad > 0, reverse: false });

  // Battery -> Load (discharge)
  const batToLoad = bat < 0 ? Math.abs(bat) : 0;
  lines.push({ from: 'battery', to: 'load', power: batToLoad, active: batToLoad > 0, reverse: false });

  // Grid -> EV (EV charging)
  const gridToEv = ev > 0 ? ev : 0;
  lines.push({ from: 'grid', to: 'ev', power: gridToEv, active: gridToEv > 0, reverse: false });

  return lines;
}
