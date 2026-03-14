const timeFmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Format watts as human-readable power string.
 * @param {number} watts
 * @returns {string} e.g. "1.23 kW" or "456 W"
 */
export function formatPower(watts) {
  if (watts == null || isNaN(watts)) return '-- W';
  const abs = Math.abs(watts);
  if (abs >= 1000) return `${(watts / 1000).toFixed(2)} kW`;
  return `${Math.round(watts)} W`;
}

/**
 * Format watt-hours as human-readable energy string.
 * @param {number} wh
 * @returns {string} e.g. "1.23 kWh" or "456 Wh"
 */
export function formatEnergy(wh) {
  if (wh == null || isNaN(wh)) return '-- Wh';
  const abs = Math.abs(wh);
  if (abs >= 1000) return `${(wh / 1000).toFixed(2)} kWh`;
  return `${Math.round(wh)} Wh`;
}

/**
 * Format a percentage value.
 * @param {number} value 0-100
 * @returns {string} e.g. "42%"
 */
export function formatPercent(value) {
  if (value == null || isNaN(value)) return '--%';
  return `${Math.round(value)}%`;
}

/**
 * Format price in cents per kWh.
 * @param {number} cents
 * @returns {string} e.g. "12.34 ct/kWh"
 */
export function formatPrice(cents) {
  if (cents == null || isNaN(cents)) return '-- ct/kWh';
  return `${cents.toFixed(2)} ct/kWh`;
}

/**
 * Format a Date as HH:MM (German locale).
 * @param {Date|string|number} date
 * @returns {string} e.g. "14:30"
 */
export function formatTime(date) {
  if (!date) return '--:--';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '--:--';
  return timeFmt.format(d);
}

/**
 * Format a Date as DD.MM.YYYY (German locale).
 * @param {Date|string|number} date
 * @returns {string} e.g. "14.03.2026"
 */
export function formatDate(date) {
  if (!date) return '--.--.--.--';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '--.--.--.--';
  return dateFmt.format(d);
}
