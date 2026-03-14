import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createComposeLifecycle } from '../modules/optimizer/services/compose-lifecycle.js';

describe('compose-lifecycle', () => {
  it('start() calls compose-manager up()', async () => {
    let upCalled = false;
    const lifecycle = createComposeLifecycle({
      composePath: '/tmp/docker-compose.yaml',
      profile: 'hybrid',
      log: { info: () => {}, warn: () => {} },
      _createManager: () => ({
        up: async () => { upCalled = true; },
        down: async () => {},
        ps: async () => [],
        restart: async () => {},
        isHealthy: async () => true,
      }),
    });
    await lifecycle.start();
    assert.ok(upCalled, 'up() should have been called');
  });

  it('stop() calls compose-manager down()', async () => {
    let downCalled = false;
    const lifecycle = createComposeLifecycle({
      composePath: '/tmp/docker-compose.yaml',
      profile: 'hybrid',
      log: { info: () => {}, warn: () => {} },
      _createManager: () => ({
        up: async () => {},
        down: async () => { downCalled = true; },
        ps: async () => [],
        restart: async () => {},
        isHealthy: async () => true,
      }),
    });
    await lifecycle.start();
    await lifecycle.stop();
    assert.ok(downCalled, 'down() should have been called');
  });

  it('start() swallows errors and logs warning', async () => {
    const warnings = [];
    const lifecycle = createComposeLifecycle({
      composePath: '/tmp/docker-compose.yaml',
      profile: 'hybrid',
      log: { info: () => {}, warn: (...args) => warnings.push(args) },
      _createManager: () => ({
        up: async () => { throw new Error('Docker not found'); },
        down: async () => {},
        ps: async () => [],
        restart: async () => {},
        isHealthy: async () => false,
      }),
    });
    // Should not throw
    await lifecycle.start();
    assert.ok(warnings.length > 0, 'warning should have been logged');
  });

  it('getManager() returns the compose-manager instance', async () => {
    const mockManager = {
      up: async () => {},
      down: async () => {},
      ps: async () => [],
      restart: async () => {},
      isHealthy: async () => true,
    };
    const lifecycle = createComposeLifecycle({
      composePath: '/tmp/docker-compose.yaml',
      profile: 'hybrid',
      log: { info: () => {}, warn: () => {} },
      _createManager: () => mockManager,
    });
    await lifecycle.start();
    const mgr = lifecycle.getManager();
    assert.ok(mgr, 'manager should be returned');
    assert.equal(typeof mgr.up, 'function');
    assert.equal(typeof mgr.down, 'function');
    assert.equal(typeof mgr.ps, 'function');
  });
});
