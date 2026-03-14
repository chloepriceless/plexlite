/**
 * Optimizer Routes Integration Tests
 *
 * Tests the optimizer Fastify plugin with mock planEngine and adapterRegistry.
 * Uses fastify.inject() for route testing (matching fastify-routes.test.js pattern).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

// Will be created in GREEN phase
import optimizerPlugin from '../modules/optimizer/plugin.js';

function createMockPlanEngine({ activePlan = null, history = [] } = {}) {
  return {
    getActivePlan: () => activePlan,
    getHistory: ({ limit } = {}) => limit ? history.slice(0, limit) : [...history],
    submitPlan: () => {},
    clearActivePlan: () => {},
    destroy: () => {},
  };
}

function createMockAdapterRegistry(adapterNames = []) {
  const adapters = adapterNames.map(name => ({
    name,
    buildInput: () => ({}),
    validateResponse: () => true,
    normalizeOutput: () => ({}),
    healthCheck: async () => ({ healthy: true }),
    optimize: async () => ({}),
  }));

  return {
    register: () => {},
    get: (name) => adapters.find(a => a.name === name),
    getAll: () => adapters,
    healthCheckAll: async () => new Map(),
  };
}

describe('optimizer routes - no active plan', () => {
  let fastify;

  before(async () => {
    fastify = Fastify();
    const planEngine = createMockPlanEngine();
    const adapterRegistry = createMockAdapterRegistry(['eos', 'emhass']);
    const triggerOptimization = () => {};

    await fastify.register(optimizerPlugin, {
      planEngine,
      adapterRegistry,
      triggerOptimization,
    });
  });

  after(async () => {
    await fastify.close();
  });

  it('GET /api/optimizer/plan returns 200 with { active: null } when no plan submitted', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/optimizer/plan' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.active, null);
  });

  it('GET /api/optimizer/history returns 200 with { plans: [] } when empty', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/optimizer/history' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.deepEqual(body.plans, []);
  });

  it('GET /api/optimizer/adapters returns 200 with list of registered adapter names', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/optimizer/adapters' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.deepEqual(body.adapters, [{ name: 'eos' }, { name: 'emhass' }]);
  });

  it('POST /api/optimizer/run returns 200 with status triggered and adapter list', async () => {
    const res = await fastify.inject({ method: 'POST', url: '/api/optimizer/run' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, 'triggered');
    assert.deepEqual(body.adapters, ['eos', 'emhass']);
  });
});

describe('optimizer routes - with active plan', () => {
  let fastify;
  const mockPlan = {
    optimizer: 'eos',
    runId: 'test-run-1',
    slots: [{ start: '2026-03-14T00:00:00Z', end: '2026-03-14T00:15:00Z', targetSocPct: 50 }],
    createdAt: '2026-03-14T00:00:00Z',
  };

  before(async () => {
    fastify = Fastify();
    const planEngine = createMockPlanEngine({ activePlan: mockPlan });
    const adapterRegistry = createMockAdapterRegistry([]);
    const triggerOptimization = () => {};

    await fastify.register(optimizerPlugin, {
      planEngine,
      adapterRegistry,
      triggerOptimization,
    });
  });

  after(async () => {
    await fastify.close();
  });

  it('GET /api/optimizer/plan returns 200 with active plan when plan exists', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/optimizer/plan' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.active.optimizer, 'eos');
    assert.equal(body.active.runId, 'test-run-1');
  });
});

describe('optimizer routes - history with limit', () => {
  let fastify;
  const mockHistory = Array.from({ length: 10 }, (_, i) => ({
    plan: { optimizer: 'eos', runId: `run-${i}` },
    score: { feasible: true, totalScore: i },
    receivedAt: new Date().toISOString(),
  }));

  before(async () => {
    fastify = Fastify();
    const planEngine = createMockPlanEngine({ history: mockHistory });
    const adapterRegistry = createMockAdapterRegistry([]);
    const triggerOptimization = () => {};

    await fastify.register(optimizerPlugin, {
      planEngine,
      adapterRegistry,
      triggerOptimization,
    });
  });

  after(async () => {
    await fastify.close();
  });

  it('GET /api/optimizer/history?limit=5 returns at most 5 entries', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/optimizer/history?limit=5' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.plans.length, 5);
  });

  it('GET /api/optimizer/history returns all entries when no limit', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/optimizer/history' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.plans.length, 10);
  });
});

describe('optimizer routes - auth conditional', () => {
  let fastify;

  before(async () => {
    fastify = Fastify();
    // Decorate with mock authenticate to test conditional auth
    fastify.decorate('authenticate', async (request, reply) => {
      if (!request.headers.authorization) {
        reply.code(401).send({ error: 'Authentication required' });
      }
    });

    const planEngine = createMockPlanEngine();
    const adapterRegistry = createMockAdapterRegistry([]);
    const triggerOptimization = () => {};

    await fastify.register(optimizerPlugin, {
      planEngine,
      adapterRegistry,
      triggerOptimization,
    });
  });

  after(async () => {
    await fastify.close();
  });

  it('routes apply auth preHandler when fastify.authenticate is decorated', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/optimizer/plan' });
    assert.equal(res.statusCode, 401);
  });

  it('routes pass with auth header when fastify.authenticate is decorated', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/optimizer/plan',
      headers: { authorization: 'Bearer test-token' },
    });
    assert.equal(res.statusCode, 200);
  });
});
