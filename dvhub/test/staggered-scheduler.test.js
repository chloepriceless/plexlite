import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createStaggeredScheduler } from '../modules/optimizer/services/staggered-scheduler.js';

describe('staggered-scheduler', () => {
  let scheduler;

  afterEach(() => {
    if (scheduler) scheduler.stop();
    scheduler = null;
  });

  it('stagger offsets calculated correctly for 2 adapters', () => {
    const calls = [];
    const intervalMs = 60000;
    scheduler = createStaggeredScheduler({
      adapters: ['eos', 'emhass'],
      triggerFn: (name) => calls.push(name),
      intervalMs,
      log: null,
    });
    // Verify internal offsets: eos=0, emhass=30000
    const offsets = scheduler._getOffsets();
    assert.deepStrictEqual(offsets, [
      { adapter: 'eos', offset: 0 },
      { adapter: 'emhass', offset: 30000 },
    ]);
  });

  it('stagger offsets calculated correctly for 3 adapters', () => {
    const intervalMs = 60000;
    scheduler = createStaggeredScheduler({
      adapters: ['eos', 'emhass', 'evcc'],
      triggerFn: () => {},
      intervalMs,
      log: null,
    });
    const offsets = scheduler._getOffsets();
    assert.deepStrictEqual(offsets, [
      { adapter: 'eos', offset: 0 },
      { adapter: 'emhass', offset: 20000 },
      { adapter: 'evcc', offset: 40000 },
    ]);
  });

  it('start() calls triggerFn for each adapter', async () => {
    const calls = [];
    scheduler = createStaggeredScheduler({
      adapters: ['eos', 'emhass'],
      triggerFn: (name) => calls.push(name),
      intervalMs: 100, // short interval for testing
      log: null,
    });
    scheduler.start();
    // eos fires at 0ms, emhass at 50ms, then eos again at 100ms
    await new Promise(r => setTimeout(r, 160));
    scheduler.stop();
    // eos should have been called at least twice (0ms, 100ms), emhass at least once (50ms)
    assert.ok(calls.includes('eos'), 'eos should have been triggered');
    assert.ok(calls.includes('emhass'), 'emhass should have been triggered');
    assert.ok(calls.filter(c => c === 'eos').length >= 2, 'eos should fire at offset 0 and interval');
  });

  it('stop() clears all timers', async () => {
    const calls = [];
    scheduler = createStaggeredScheduler({
      adapters: ['eos', 'emhass'],
      triggerFn: (name) => calls.push(name),
      intervalMs: 50,
      log: null,
    });
    scheduler.start();
    await new Promise(r => setTimeout(r, 30));
    scheduler.stop();
    const countAtStop = calls.length;
    await new Promise(r => setTimeout(r, 100));
    assert.equal(calls.length, countAtStop, 'no further calls after stop()');
  });

  it('single adapter has offset 0', () => {
    scheduler = createStaggeredScheduler({
      adapters: ['eos'],
      triggerFn: () => {},
      intervalMs: 60000,
      log: null,
    });
    const offsets = scheduler._getOffsets();
    assert.deepStrictEqual(offsets, [
      { adapter: 'eos', offset: 0 },
    ]);
  });
});
