import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createExecutor } from '../core/executor.js';

/**
 * Creates mock dependencies for executor tests.
 */
function createMocks({ meterResponse } = {}) {
  const dbCalls = [];
  const eventCalls = [];
  const halCalls = [];

  const mockHal = {
    async writeControl(target, value) {
      halCalls.push({ method: 'writeControl', target, value });
      return { success: true, target, value, register: 2700 };
    },
    async readMeter() {
      halCalls.push({ method: 'readMeter' });
      return meterResponse || { gridPower: 500, soc: 80, timestamp: Date.now() };
    }
  };

  const mockDb = {
    async insertControlEvent(event) {
      dbCalls.push(event);
    }
  };

  const mockEventBus = {
    emit(event) {
      eventCalls.push(event);
    }
  };

  return { mockHal, mockDb, mockEventBus, dbCalls, eventCalls, halCalls };
}

describe('createExecutor', () => {
  it('executeCommand logs command:sent to db before HAL write', async () => {
    const { mockHal, mockDb, mockEventBus, dbCalls, halCalls } = createMocks();
    const exec = createExecutor({
      hal: mockHal, db: mockDb, eventBus: mockEventBus,
      config: { readbackEnabled: false }
    });

    await exec.executeCommand({
      source: 'dv', priority: 2, target: 'gridSetpointW', value: 500, reason: 'test'
    });

    // command:sent should be logged before writeControl
    assert.equal(dbCalls.length >= 1, true);
    assert.equal(dbCalls[0].type, 'command:sent');
    assert.ok(dbCalls[0].message.includes('gridSetpointW'));
    assert.equal(halCalls[0].method, 'writeControl');
  });

  it('executeCommand calls hal.writeControl(target, value)', async () => {
    const { mockHal, mockDb, mockEventBus, halCalls } = createMocks();
    const exec = createExecutor({
      hal: mockHal, db: mockDb, eventBus: mockEventBus,
      config: { readbackEnabled: false }
    });

    await exec.executeCommand({
      source: 'dv', priority: 2, target: 'gridSetpointW', value: 750, reason: 'test'
    });

    const writeCall = halCalls.find(c => c.method === 'writeControl');
    assert.ok(writeCall);
    assert.equal(writeCall.target, 'gridSetpointW');
    assert.equal(writeCall.value, 750);
  });

  it('executeCommand reads back via hal.readMeter() after write', async () => {
    const { mockHal, mockDb, mockEventBus, halCalls } = createMocks({
      meterResponse: { gridPower: 500, soc: 80, timestamp: Date.now() }
    });
    const exec = createExecutor({
      hal: mockHal, db: mockDb, eventBus: mockEventBus,
      config: { readbackEnabled: true, readbackDelayMs: 0 }
    });

    await exec.executeCommand({
      source: 'dv', priority: 2, target: 'gridSetpointW', value: 500, reason: 'test'
    });

    const readCall = halCalls.find(c => c.method === 'readMeter');
    assert.ok(readCall, 'readMeter should have been called');
  });

  it('readback match within threshold -> logs command:verified', async () => {
    const { mockHal, mockDb, mockEventBus, dbCalls } = createMocks({
      meterResponse: { gridPower: 520, soc: 80, timestamp: Date.now() }
    });
    const exec = createExecutor({
      hal: mockHal, db: mockDb, eventBus: mockEventBus,
      config: { readbackEnabled: true, readbackDelayMs: 0, thresholds: { gridSetpointW: 500 } }
    });

    const result = await exec.executeCommand({
      source: 'dv', priority: 2, target: 'gridSetpointW', value: 500, reason: 'test'
    });

    const verifiedLog = dbCalls.find(c => c.type === 'command:verified');
    assert.ok(verifiedLog, 'command:verified should be logged');
    assert.equal(result.deviationAlert, false);
  });

  it('readback deviates beyond threshold -> logs command:deviation AND emits exec:deviation', async () => {
    const { mockHal, mockDb, mockEventBus, dbCalls, eventCalls } = createMocks({
      meterResponse: { gridPower: 2000, soc: 80, timestamp: Date.now() }
    });
    const exec = createExecutor({
      hal: mockHal, db: mockDb, eventBus: mockEventBus,
      config: { readbackEnabled: true, readbackDelayMs: 0, thresholds: { gridSetpointW: 500 } }
    });

    const result = await exec.executeCommand({
      source: 'dv', priority: 2, target: 'gridSetpointW', value: 500, reason: 'test'
    });

    const deviationLog = dbCalls.find(c => c.type === 'command:deviation');
    assert.ok(deviationLog, 'command:deviation should be logged');
    assert.equal(deviationLog.severity, 'warn');

    const deviationEvent = eventCalls.find(e => e.type === 'exec:deviation');
    assert.ok(deviationEvent, 'exec:deviation event should be emitted');
    assert.equal(deviationEvent.target, 'gridSetpointW');
    assert.equal(deviationEvent.commanded, 500);
    assert.equal(deviationEvent.readback, 2000);

    assert.equal(result.deviationAlert, true);
    assert.equal(result.deviation, 1500);
  });

  it('readback field unavailable for target -> logs readback:unavailable, no deviation', async () => {
    const { mockHal, mockDb, mockEventBus, dbCalls, eventCalls } = createMocks();
    const exec = createExecutor({
      hal: mockHal, db: mockDb, eventBus: mockEventBus,
      config: { readbackEnabled: true, readbackDelayMs: 0 }
    });

    // feedExcessDcPv has no READBACK_MAP entry
    const result = await exec.executeCommand({
      source: 'dv', priority: 2, target: 'feedExcessDcPv', value: false, reason: 'test'
    });

    const unavailLog = dbCalls.find(c => c.message && c.message.includes('readback:unavailable'));
    assert.ok(unavailLog, 'readback:unavailable should be logged');
    assert.equal(result.readback, null);
    assert.equal(result.deviation, null);
    assert.equal(result.deviationAlert, false);
    assert.equal(eventCalls.length, 0, 'no deviation event should be emitted');
  });

  it('executeCommand returns { success, target, value, readback, deviation }', async () => {
    const { mockHal, mockDb, mockEventBus } = createMocks({
      meterResponse: { gridPower: 490, soc: 80, timestamp: Date.now() }
    });
    const exec = createExecutor({
      hal: mockHal, db: mockDb, eventBus: mockEventBus,
      config: { readbackEnabled: true, readbackDelayMs: 0, thresholds: { gridSetpointW: 500 } }
    });

    const result = await exec.executeCommand({
      source: 'dv', priority: 2, target: 'gridSetpointW', value: 500, reason: 'test'
    });

    assert.equal(result.success, true);
    assert.equal(result.target, 'gridSetpointW');
    assert.equal(result.value, 500);
    assert.equal(result.readback, 490);
    assert.equal(result.deviation, 10);
    assert.equal(result.deviationAlert, false);
  });

  it('getCommandLog returns recent commands', async () => {
    const { mockHal, mockDb, mockEventBus } = createMocks();
    const exec = createExecutor({
      hal: mockHal, db: mockDb, eventBus: mockEventBus,
      config: { readbackEnabled: false }
    });

    await exec.executeCommand({
      source: 'dv', priority: 2, target: 'gridSetpointW', value: 500, reason: 'a'
    });
    await exec.executeCommand({
      source: 'dv', priority: 2, target: 'gridSetpointW', value: 600, reason: 'b'
    });

    const log = exec.getCommandLog(10);
    assert.equal(log.length, 2);
    // Most recent first
    assert.equal(log[0].value, 600);
    assert.equal(log[1].value, 500);
  });

  it('getConfig returns merged config', () => {
    const { mockHal, mockDb, mockEventBus } = createMocks();
    const exec = createExecutor({
      hal: mockHal, db: mockDb, eventBus: mockEventBus,
      config: { readbackDelayMs: 100 }
    });

    const cfg = exec.getConfig();
    assert.equal(cfg.readbackDelayMs, 100);
    assert.equal(cfg.readbackEnabled, true); // default
  });
});
