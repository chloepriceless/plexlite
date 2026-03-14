import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { createDvState } from '../modules/dv/dv-state.js';
import { createDvRoutes } from '../modules/dv/routes/dv-routes.js';

function mockCurtailment(initialControlValue = 1) {
  let cv = initialControlValue;
  const calls = [];
  return {
    controlValue() { return cv; },
    setForcedOff(reason) {
      calls.push({ method: 'setForcedOff', reason });
      cv = 0;
    },
    clearForcedOff(reason) {
      calls.push({ method: 'clearForcedOff', reason });
      cv = 1;
    },
    calls
  };
}

function mockProvider(name = 'luox') {
  return { name };
}

async function buildApp(opts = {}) {
  const state = opts.state ?? createDvState();
  const curtailment = opts.curtailment ?? mockCurtailment();
  const provider = opts.provider ?? mockProvider();

  const app = Fastify({ logger: false });
  const registerRoutes = createDvRoutes({ state, curtailment, provider });
  registerRoutes(app);
  return { app, state, curtailment, provider };
}

describe('createDvRoutes', () => {
  it('returns a function', () => {
    const state = createDvState();
    const curtailment = mockCurtailment();
    const provider = mockProvider();
    const fn = createDvRoutes({ state, curtailment, provider });
    assert.strictEqual(typeof fn, 'function');
  });
});

describe('GET /dv/control-value', () => {
  it('returns text/plain "1" when curtailment not active', async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/dv/control-value' });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.headers['content-type'].includes('text/plain'));
    assert.strictEqual(res.body, '1');
  });

  it('returns text/plain "0" when curtailment is active', async () => {
    const curtailment = mockCurtailment(0);
    const { app } = await buildApp({ curtailment });
    const res = await app.inject({ method: 'GET', url: '/dv/control-value' });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body, '0');
  });
});

describe('GET /api/dv/status', () => {
  it('returns JSON with expected shape', async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/dv/status' });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.enabled, true);
    assert.strictEqual(body.provider, 'luox');
    assert.strictEqual(body.controlValue, 1);
    assert.ok('dvRegs' in body);
    assert.ok('ctrl' in body);
    assert.ok('keepalive' in body);
  });

  it('keepalive.staleness is null when no modbusLastQuery', async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/dv/status' });
    const body = JSON.parse(res.body);
    assert.strictEqual(body.keepalive.staleness, null);
  });
});

describe('POST /api/dv/control', () => {
  it('action curtail calls setForcedOff and returns ok', async () => {
    const { app, curtailment } = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/dv/control',
      payload: { action: 'curtail' }
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.controlValue, 0);
    assert.strictEqual(curtailment.calls.length, 1);
    assert.strictEqual(curtailment.calls[0].method, 'setForcedOff');
    assert.strictEqual(curtailment.calls[0].reason, 'api_control_lease');
  });

  it('action release calls clearForcedOff and returns ok', async () => {
    const curtailment = mockCurtailment(0);
    const { app } = await buildApp({ curtailment });
    const res = await app.inject({
      method: 'POST',
      url: '/api/dv/control',
      payload: { action: 'release' }
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.controlValue, 1);
    assert.strictEqual(curtailment.calls.length, 1);
    assert.strictEqual(curtailment.calls[0].method, 'clearForcedOff');
    assert.strictEqual(curtailment.calls[0].reason, 'api_control_lease_clear');
  });

  it('invalid action returns 400', async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/dv/control',
      payload: { action: 'invalid' }
    });
    assert.strictEqual(res.statusCode, 400);
  });

  it('missing action returns 400', async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/dv/control',
      payload: {}
    });
    assert.strictEqual(res.statusCode, 400);
  });
});

describe('plugin.js', () => {
  it('wraps with fastify-plugin (has skip-override symbol)', async () => {
    const mod = await import('../modules/dv/plugin.js');
    const plugin = mod.default;
    assert.strictEqual(typeof plugin, 'function');
    // fastify-plugin sets Symbol.for('skip-override') to true
    assert.strictEqual(plugin[Symbol.for('skip-override')], true);
  });
});
