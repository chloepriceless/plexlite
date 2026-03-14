import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { createAdapterRegistry } from '../modules/optimizer/adapter-registry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemasDir = join(__dirname, '..', 'modules', 'optimizer', 'schemas');

// Helper: load and compile a JSON schema
function loadSchema(name) {
  const raw = readFileSync(join(schemasDir, name), 'utf8');
  return JSON.parse(raw);
}

// Helper: create a mock adapter
function mockAdapter(name, opts = {}) {
  return {
    name,
    testedVersions: new Set(opts.testedVersions || ['1.0.0']),
    buildInput: () => ({}),
    validateResponse: () => ({ valid: true }),
    normalizeOutput: () => ({}),
    healthCheck: opts.healthCheck || (async () => ({ healthy: true, version: '1.0.0' }))
  };
}

describe('AdapterRegistry', () => {
  it('createAdapterRegistry() returns object with register, get, getAll, healthCheckAll', () => {
    const reg = createAdapterRegistry();
    assert.equal(typeof reg.register, 'function');
    assert.equal(typeof reg.get, 'function');
    assert.equal(typeof reg.getAll, 'function');
    assert.equal(typeof reg.healthCheckAll, 'function');
  });

  it('register(adapter) stores adapter by adapter.name', () => {
    const reg = createAdapterRegistry();
    const adapter = mockAdapter('eos');
    reg.register(adapter);
    assert.equal(reg.get('eos'), adapter);
  });

  it('get("eos") returns the registered EOS adapter', () => {
    const reg = createAdapterRegistry();
    const adapter = mockAdapter('eos');
    reg.register(adapter);
    assert.equal(reg.get('eos').name, 'eos');
  });

  it('get("nonexistent") returns undefined', () => {
    const reg = createAdapterRegistry();
    assert.equal(reg.get('nonexistent'), undefined);
  });

  it('getAll() returns array of all registered adapters', () => {
    const reg = createAdapterRegistry();
    reg.register(mockAdapter('eos'));
    reg.register(mockAdapter('emhass'));
    const all = reg.getAll();
    assert.equal(all.length, 2);
    assert.ok(all.some(a => a.name === 'eos'));
    assert.ok(all.some(a => a.name === 'emhass'));
  });

  it('healthCheckAll() calls healthCheck() on each adapter and returns results map', async () => {
    const reg = createAdapterRegistry();
    reg.register(mockAdapter('eos'));
    reg.register(mockAdapter('emhass'));
    const results = await reg.healthCheckAll();
    assert.ok(results instanceof Map);
    assert.equal(results.size, 2);
    assert.deepEqual(results.get('eos'), { healthy: true, version: '1.0.0' });
    assert.deepEqual(results.get('emhass'), { healthy: true, version: '1.0.0' });
  });

  it('healthCheckAll() logs warning for untested version (SEC-03)', async () => {
    const warnings = [];
    const log = { warn: (msg) => warnings.push(msg), info: () => {} };
    const reg = createAdapterRegistry({ log });

    // Adapter reports version 2.0.0 but only 1.0.0 is tested
    reg.register(mockAdapter('eos', {
      testedVersions: ['1.0.0'],
      healthCheck: async () => ({ healthy: true, version: '2.0.0' })
    }));

    await reg.healthCheckAll();
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes('untested'));
    assert.ok(warnings[0].includes('2.0.0'));
  });

  it('healthCheckAll() handles adapter healthCheck() rejection gracefully', async () => {
    const reg = createAdapterRegistry();
    reg.register(mockAdapter('broken', {
      healthCheck: async () => { throw new Error('connection refused'); }
    }));

    const results = await reg.healthCheckAll();
    const result = results.get('broken');
    assert.equal(result.healthy, false);
    assert.ok(result.error.includes('connection refused'));
  });
});

describe('canonical-plan.json schema', () => {
  const ajv = new Ajv({ allErrors: true });
  const schema = loadSchema('canonical-plan.json');
  const validate = ajv.compile(schema);

  it('validates a well-formed plan with slots', () => {
    const plan = {
      optimizer: 'eos',
      runId: '550e8400-e29b-41d4-a716-446655440000',
      createdAt: '2026-03-14T10:00:00Z',
      slots: [
        { start: '2026-03-14T10:00:00Z', end: '2026-03-14T10:15:00Z', gridImportWh: 100 }
      ]
    };
    assert.ok(validate(plan), JSON.stringify(validate.errors));
  });

  it('rejects plan missing required slots array', () => {
    const plan = {
      optimizer: 'eos',
      runId: 'abc',
      createdAt: '2026-03-14T10:00:00Z'
    };
    assert.equal(validate(plan), false);
    assert.ok(validate.errors.some(e => e.instancePath === '' && e.params?.missingProperty === 'slots'));
  });

  it('rejects slot missing start or end fields', () => {
    const plan = {
      optimizer: 'eos',
      runId: 'abc',
      createdAt: '2026-03-14T10:00:00Z',
      slots: [{ gridImportWh: 100 }]
    };
    assert.equal(validate(plan), false);
    assert.ok(validate.errors.some(e => e.params?.missingProperty === 'start' || e.params?.missingProperty === 'end'));
  });
});
