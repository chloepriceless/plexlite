/**
 * Pure compute functions for schedule rule grouping and collection.
 * Ported from legacy app.js -- no DOM, no signals, no project imports.
 */

const SMALL_MARKET_AUTOMATION_SOURCE = 'small_market_automation';
const SMA_ID_PREFIX = 'sma-';

/**
 * Check whether a rule originates from the small market automation engine.
 * @param {object|null} rule
 * @returns {boolean}
 */
export function isSmallMarketAutomationRule(rule) {
  if (!rule || typeof rule !== 'object') return false;
  return rule.source === SMALL_MARKET_AUTOMATION_SOURCE
    || (typeof rule.id === 'string' && rule.id.startsWith(SMA_ID_PREFIX));
}

/**
 * Group flat schedule rules by time-slot key (start|end) into dashboard rows.
 * Each row carries grid, charge, stopSocPct, enabled, ruleId, source, etc.
 *
 * @param {Array} rules - flat array of rule objects
 * @returns {Array} grouped slot objects
 */
export function groupScheduleRulesForDashboard(rules) {
  if (!Array.isArray(rules)) return [];

  const timeSlots = new Map();
  for (const rule of rules) {
    if (!rule || typeof rule !== 'object') continue;
    const key = `${rule.start}|${rule.end}`;
    if (!timeSlots.has(key)) {
      timeSlots.set(key, {
        start: rule.start,
        end: rule.end,
        grid: null,
        charge: null,
        stopSocPct: null,
        enabled: rule.enabled !== false
      });
    }
    const slot = timeSlots.get(key);
    if (rule.target === 'gridSetpointW') {
      slot.grid = rule.value;
      const stopSocPct = Number(rule.stopSocPct);
      slot.stopSocPct = Number.isFinite(stopSocPct) ? stopSocPct : null;
    }
    if (rule.target === 'chargeCurrentA') slot.charge = rule.value;
    if (rule.enabled === false) slot.enabled = false;
    if (!slot.ruleId && rule.id) slot.ruleId = rule.id;
    if (!slot.source && rule.source) slot.source = rule.source;
    if (!slot.displayTone && rule.displayTone) slot.displayTone = rule.displayTone;
    if (slot.autoManaged !== true && rule.autoManaged === true) slot.autoManaged = true;
    if (!slot.activeDate && rule.activeDate) slot.activeDate = rule.activeDate;
  }

  return Array.from(timeSlots.values());
}

/**
 * Convert dashboard row-edit state back to flat API-compatible rule objects.
 *
 * @param {Array} rows - array of UI row objects from edit state
 * @returns {Array} flat rules for POST /api/schedule/rules
 */
export function collectScheduleRulesFromRowState(rows) {
  if (!Array.isArray(rows)) return [];
  const rules = [];
  let idx = 1;

  for (const row of rows) {
    const start = row?.start;
    const end = row?.end;
    if (!start || !end) {
      idx++;
      continue;
    }

    const rowEnabled = row?.rowEnabled ?? row?.enabled ?? true;
    const gridEnabled = row?.gridEnabled ?? row?.grid != null;
    const chargeEnabled = row?.chargeEnabled ?? row?.charge != null;
    const stopSocEnabled = row?.stopSocEnabled ?? row?.stopSocPct != null;

    const gridVal = Number(row?.gridVal ?? row?.grid);
    const chargeVal = Number(row?.chargeVal ?? row?.charge);
    const stopSocVal = Number(row?.stopSocVal ?? row?.stopSocPct);

    if (gridEnabled && Number.isFinite(gridVal)) {
      const gridRule = {
        id: `grid_${idx}`,
        enabled: rowEnabled,
        target: 'gridSetpointW',
        start,
        end,
        value: gridVal
      };
      if (row?.source) gridRule.source = row.source;
      if (row?.autoManaged != null) gridRule.autoManaged = Boolean(row.autoManaged);
      if (row?.displayTone) gridRule.displayTone = row.displayTone;
      if (row?.activeDate) gridRule.activeDate = row.activeDate;
      if (stopSocEnabled && Number.isFinite(stopSocVal)) {
        gridRule.stopSocPct = stopSocVal;
      }
      rules.push(gridRule);
    }

    if (chargeEnabled && Number.isFinite(chargeVal)) {
      const chargeRule = {
        id: `charge_${idx}`,
        enabled: rowEnabled,
        target: 'chargeCurrentA',
        start,
        end,
        value: chargeVal
      };
      if (row?.source) chargeRule.source = row.source;
      if (row?.autoManaged != null) chargeRule.autoManaged = Boolean(row.autoManaged);
      if (row?.displayTone) chargeRule.displayTone = row.displayTone;
      if (row?.activeDate) chargeRule.activeDate = row.activeDate;
      rules.push(chargeRule);
    }

    idx++;
  }

  return rules;
}
