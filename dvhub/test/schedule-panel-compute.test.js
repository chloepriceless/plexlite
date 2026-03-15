import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isSmallMarketAutomationRule,
  groupScheduleRulesForDashboard,
  collectScheduleRulesFromRowState
} from '../public/components/dashboard/schedule-compute.js';

// --- isSmallMarketAutomationRule ---

test('isSmallMarketAutomationRule returns true for source=small_market_automation', () => {
  assert.equal(isSmallMarketAutomationRule({ source: 'small_market_automation' }), true);
});

test('isSmallMarketAutomationRule returns true for id starting with sma-', () => {
  assert.equal(isSmallMarketAutomationRule({ id: 'sma-123' }), true);
});

test('isSmallMarketAutomationRule returns false for manual rules', () => {
  assert.equal(isSmallMarketAutomationRule({ id: 'grid_1', source: 'manual' }), false);
});

test('isSmallMarketAutomationRule returns false for null input', () => {
  assert.equal(isSmallMarketAutomationRule(null), false);
});

// --- groupScheduleRulesForDashboard ---

test('groupScheduleRulesForDashboard groups two rules with same timeslot into one entry', () => {
  const rules = [
    { target: 'gridSetpointW', start: '08:00', end: '12:00', value: -5000 },
    { target: 'chargeCurrentA', start: '08:00', end: '12:00', value: 20 }
  ];
  const grouped = groupScheduleRulesForDashboard(rules);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].grid, -5000);
  assert.equal(grouped[0].charge, 20);
  assert.equal(grouped[0].start, '08:00');
  assert.equal(grouped[0].end, '12:00');
});

test('groupScheduleRulesForDashboard returns [] for empty array', () => {
  assert.deepEqual(groupScheduleRulesForDashboard([]), []);
});

test('groupScheduleRulesForDashboard returns [] for null input', () => {
  assert.deepEqual(groupScheduleRulesForDashboard(null), []);
});

test('groupScheduleRulesForDashboard preserves source and autoManaged', () => {
  const rules = [
    { target: 'gridSetpointW', start: '06:00', end: '08:00', value: -3000, source: 'small_market_automation', autoManaged: true }
  ];
  const grouped = groupScheduleRulesForDashboard(rules);
  assert.equal(grouped[0].source, 'small_market_automation');
  assert.equal(grouped[0].autoManaged, true);
});

// --- collectScheduleRulesFromRowState ---

test('collectScheduleRulesFromRowState creates 2 rules from a row with grid and charge', () => {
  const rows = [
    { start: '08:00', end: '12:00', gridEnabled: true, gridVal: -5000, chargeEnabled: true, chargeVal: 20 }
  ];
  const rules = collectScheduleRulesFromRowState(rows);
  assert.equal(rules.length, 2);
  const gridRule = rules.find(r => r.target === 'gridSetpointW');
  const chargeRule = rules.find(r => r.target === 'chargeCurrentA');
  assert.ok(gridRule);
  assert.ok(chargeRule);
  assert.equal(gridRule.value, -5000);
  assert.equal(chargeRule.value, 20);
});

test('collectScheduleRulesFromRowState returns [] for rows without start/end', () => {
  const rules = collectScheduleRulesFromRowState([{ start: null, end: null }]);
  assert.deepEqual(rules, []);
});

test('collectScheduleRulesFromRowState includes stopSocPct on grid rule when present', () => {
  const rows = [
    { start: '10:00', end: '14:00', gridEnabled: true, gridVal: -2000, stopSocEnabled: true, stopSocVal: 30 }
  ];
  const rules = collectScheduleRulesFromRowState(rows);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].stopSocPct, 30);
});
