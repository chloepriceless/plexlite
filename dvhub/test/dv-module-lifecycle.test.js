/**
 * DV Module Lifecycle Integration Tests
 *
 * Tests the DV module init/destroy lifecycle,
 * gateway cleanup verification, and enable/disable behavior.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDvModule } from '../modules/dv/index.js';
import { createEventBus } from '../core/event-bus.js';

describe('DV Module Lifecycle', () => {
  function createMockCtx() {
    const eventBus = createEventBus();
    eventBus.createStream('telemetry', { meter: { grid_total_w: 0 } });
    const mockRegistry = {
      get: (name) => name === 'gateway'
        ? { modbusProxy: { setFrameHandler: () => {} } }
        : undefined
    };
    return {
      fastify: { log: { info: () => {}, warn: () => {} } },
      eventBus,
      config: {},
      registry: mockRegistry
    };
  }

  it('returns correct module interface', () => {
    const mod = createDvModule({});
    assert.equal(mod.name, 'dv');
    assert.deepEqual(mod.requires, ['gateway']);
    assert.equal(typeof mod.init, 'function');
    assert.equal(typeof mod.destroy, 'function');
    assert.equal(mod.plugin, null, 'plugin should be null before init');
  });

  it('has non-null plugin after init', async () => {
    const mod = createDvModule({});
    const ctx = createMockCtx();
    await mod.init(ctx);

    assert.notEqual(mod.plugin, null, 'plugin should be set after init');
    assert.equal(typeof mod.plugin, 'function', 'plugin should be a function wrapper');

    await mod.destroy();
    ctx.eventBus.destroy();
  });

  it('has null plugin after destroy', async () => {
    const mod = createDvModule({});
    const ctx = createMockCtx();
    await mod.init(ctx);
    await mod.destroy();

    assert.equal(mod.plugin, null, 'plugin should be null after destroy');
    ctx.eventBus.destroy();
  });

  it('sets frame handler on gateway modbusProxy during init', async () => {
    let handlerSet = false;
    const mod = createDvModule({});
    const ctx = createMockCtx();
    ctx.registry = {
      get: (name) => name === 'gateway'
        ? { modbusProxy: { setFrameHandler: () => { handlerSet = true; } } }
        : undefined
    };

    await mod.init(ctx);
    assert.equal(handlerSet, true, 'frame handler should be set on modbusProxy');

    await mod.destroy();
    ctx.eventBus.destroy();
  });

  it('subscribes to telemetry stream during init', async () => {
    const mod = createDvModule({});
    const ctx = createMockCtx();
    await mod.init(ctx);

    // Verify by checking that updating telemetry does not throw
    const stream = ctx.eventBus.getStream('telemetry');
    stream.next({ meter: { grid_total_w: 500 } });

    await mod.destroy();
    ctx.eventBus.destroy();
  });

  it('can be initialized and destroyed multiple times', async () => {
    const mod = createDvModule({});

    for (let i = 0; i < 3; i++) {
      const ctx = createMockCtx();
      await mod.init(ctx);
      assert.notEqual(mod.plugin, null);
      await mod.destroy();
      assert.equal(mod.plugin, null);
      ctx.eventBus.destroy();
    }
  });
});

describe('Gateway DV code removal verification', () => {
  it('gateway module has no DV-specific exports', async () => {
    // Dynamic import to check the gateway module interface
    const { createGatewayModule } = await import('../modules/gateway/index.js');
    const mod = createGatewayModule();

    // These should NOT exist on the module return object
    assert.equal(mod.dvRegs, undefined, 'gateway should not have dvRegs');
    assert.equal(mod.processModbusFrame, undefined, 'gateway should not have processModbusFrame');
    assert.equal(mod.setForcedOff, undefined, 'gateway should not have setForcedOff');
    assert.equal(mod.clearForcedOff, undefined, 'gateway should not have clearForcedOff');
    assert.equal(mod.controlValue, undefined, 'gateway should not have controlValue');
  });

  it('gateway module exposes modbusProxy property', async () => {
    const { createGatewayModule } = await import('../modules/gateway/index.js');
    const mod = createGatewayModule();

    // modbusProxy is null before init (set during init)
    assert.equal('modbusProxy' in mod, true, 'gateway should have modbusProxy property');
  });
});
