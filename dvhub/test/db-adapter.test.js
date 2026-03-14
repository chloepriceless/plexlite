import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Database Adapter Factory', () => {

  it('createDatabaseAdapter with backend=sqlite returns object with all interface methods', async () => {
    const { createDatabaseAdapter, ADAPTER_METHODS } = await import('../core/database/adapter.js');
    const adapter = await createDatabaseAdapter({ database: { backend: 'sqlite' } });

    for (const method of ADAPTER_METHODS) {
      assert.equal(typeof adapter[method], 'function', `adapter.${method} should be a function`);
    }
  });

  it('createDatabaseAdapter with backend=timescaledb returns object with all interface methods', async () => {
    const { createDatabaseAdapter, ADAPTER_METHODS } = await import('../core/database/adapter.js');
    const adapter = await createDatabaseAdapter({ database: { backend: 'timescaledb' } });

    for (const method of ADAPTER_METHODS) {
      assert.equal(typeof adapter[method], 'function', `adapter.${method} should be a function`);
    }
  });

  it('createDatabaseAdapter with backend=unknown throws Error', async () => {
    const { createDatabaseAdapter } = await import('../core/database/adapter.js');

    await assert.rejects(
      () => createDatabaseAdapter({ database: { backend: 'unknown' } }),
      { message: /Unknown database backend: unknown/ }
    );
  });

  it('createDatabaseAdapter with no backend defaults to timescaledb', async () => {
    const { createDatabaseAdapter } = await import('../core/database/adapter.js');
    const adapter = await createDatabaseAdapter({ database: {} });
    const info = adapter.getBackendInfo();
    assert.equal(info.backend, 'timescaledb');
  });

  it('every method on returned adapter is typeof function', async () => {
    const { createDatabaseAdapter, ADAPTER_METHODS } = await import('../core/database/adapter.js');
    const adapter = await createDatabaseAdapter({ database: { backend: 'sqlite' } });

    for (const method of ADAPTER_METHODS) {
      assert.equal(typeof adapter[method], 'function', `${method} must be a function`);
    }
  });

  it('getBackendInfo() returns correct backend identifier', async () => {
    const { createDatabaseAdapter } = await import('../core/database/adapter.js');

    const sqliteAdapter = await createDatabaseAdapter({ database: { backend: 'sqlite' } });
    assert.equal(sqliteAdapter.getBackendInfo().backend, 'sqlite');

    const tsAdapter = await createDatabaseAdapter({ database: { backend: 'timescaledb' } });
    assert.equal(tsAdapter.getBackendInfo().backend, 'timescaledb');
  });

  it('ADAPTER_METHODS contains all 11 required methods', async () => {
    const { ADAPTER_METHODS } = await import('../core/database/adapter.js');
    const expected = [
      'initialize', 'healthCheck', 'close',
      'insertSamples', 'insertControlEvent',
      'querySamples', 'queryAggregates', 'queryLatest',
      'runRollups', 'runRetention', 'runCompression',
      'getBackendInfo'
    ];
    assert.deepEqual(ADAPTER_METHODS, expected);
  });
});
