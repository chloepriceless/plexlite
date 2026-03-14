import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createExecutor } from '../core/executor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMockHal() {
  return {
    writeControl: mock.fn(async () => {}),
    readMeter: mock.fn(async () => ({ gridPower: 100 }))
  };
}

function makeMockDb() {
  return {
    insertControlEvent: mock.fn(async () => {})
  };
}

function makeMockEventBus() {
  return { emit: mock.fn() };
}

function makeMockLog() {
  return {
    info: mock.fn(),
    warn: mock.fn(),
    error: mock.fn()
  };
}

function baseCommand() {
  return { source: 'test', priority: 3, target: 'gridSetpointW', value: 1000, reason: 'unit test' };
}

// ── Null DB tests ────────────────────────────────────────────────────────────

describe('executor null db safety', () => {
  it('executeCommand succeeds when db is null (HAL write still called)', async () => {
    const hal = makeMockHal();
    const eventBus = makeMockEventBus();
    const log = makeMockLog();
    const executor = createExecutor({ hal, db: null, eventBus, log, config: { readbackEnabled: false } });

    const result = await executor.executeCommand(baseCommand());

    assert.equal(result.success, true);
    assert.equal(hal.writeControl.mock.calls.length, 1, 'HAL writeControl must be called');
  });

  it('log.warn called about skipped command logging when db is null', async () => {
    const hal = makeMockHal();
    const eventBus = makeMockEventBus();
    const log = makeMockLog();
    const executor = createExecutor({ hal, db: null, eventBus, log, config: { readbackEnabled: false } });

    await executor.executeCommand(baseCommand());

    assert.ok(log.warn.mock.calls.length > 0, 'log.warn must be called');
    const warnMsg = log.warn.mock.calls[0].arguments;
    const hasSkipMsg = warnMsg.some(a => typeof a === 'string' && a.includes('skipping command log'));
    assert.ok(hasSkipMsg, 'warn message should mention skipping command log');
  });

  it('readback path works with null db (db logging skipped, readback still compared)', async () => {
    const hal = makeMockHal();
    // readMeter returns gridPower: 100, command value 1000 => deviation 900 > threshold 500
    const eventBus = makeMockEventBus();
    const log = makeMockLog();
    const executor = createExecutor({ hal, db: null, eventBus, log });

    const result = await executor.executeCommand(baseCommand());

    assert.equal(result.success, true);
    assert.equal(result.deviationAlert, true);
    assert.equal(result.readback, 100);
  });

  it('deviation alert still emits to eventBus even when db is null', async () => {
    const hal = makeMockHal();
    const eventBus = makeMockEventBus();
    const log = makeMockLog();
    const executor = createExecutor({ hal, db: null, eventBus, log });

    await executor.executeCommand(baseCommand());

    assert.ok(eventBus.emit.mock.calls.length > 0, 'eventBus.emit must be called for deviation');
    const emitted = eventBus.emit.mock.calls[0].arguments[0];
    assert.equal(emitted.type, 'exec:deviation');
  });
});

// ── Null HAL tests ───────────────────────────────────────────────────────────

describe('executor null hal safety', () => {
  it('executeCommand throws Error with "HAL unavailable" when hal is null', async () => {
    const db = makeMockDb();
    const eventBus = makeMockEventBus();
    const log = makeMockLog();
    const executor = createExecutor({ hal: null, db, eventBus, log });

    await assert.rejects(
      () => executor.executeCommand(baseCommand()),
      (err) => {
        assert.ok(err instanceof Error, 'must be an Error instance (not TypeError)');
        assert.ok(err.message.includes('HAL unavailable'), `message should include "HAL unavailable", got: ${err.message}`);
        return true;
      }
    );
  });

  it('thrown error is Error (not TypeError) when hal is null', async () => {
    const db = makeMockDb();
    const eventBus = makeMockEventBus();
    const log = makeMockLog();
    const executor = createExecutor({ hal: null, db, eventBus, log });

    try {
      await executor.executeCommand(baseCommand());
      assert.fail('should have thrown');
    } catch (err) {
      assert.equal(err.constructor.name, 'Error', 'must be plain Error, not TypeError');
      assert.ok(!(err instanceof TypeError), 'must not be TypeError');
    }
  });
});

// ── WebSocket field name alignment tests ─────────────────────────────────────

describe('WebSocket field name alignment', () => {
  const wsHookPath = resolve(__dirname, '../public/components/shared/use-websocket.js');
  const gatewayPluginPath = resolve(__dirname, '../modules/gateway/plugin.js');

  it('use-websocket.js source contains "data.data" (not "data.payload")', () => {
    const src = readFileSync(wsHookPath, 'utf8');
    assert.ok(src.includes('data.data'), 'use-websocket.js must reference data.data');
  });

  it('use-websocket.js source has zero occurrences of "data.payload"', () => {
    const src = readFileSync(wsHookPath, 'utf8');
    const count = (src.match(/data\.payload/g) || []).length;
    assert.equal(count, 0, `expected 0 occurrences of data.payload, found ${count}`);
  });

  it('gateway plugin.js broadcasts with "data" field', () => {
    const src = readFileSync(gatewayPluginPath, 'utf8');
    assert.ok(src.match(/broadcast\(\{[^}]*data/), 'gateway plugin must broadcast with data field');
  });
});
