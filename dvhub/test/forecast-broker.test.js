import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createForecastBroker } from '../modules/optimizer/services/forecast-broker.js';

describe('createForecastBroker', () => {
  it('returns object with all required methods', () => {
    const broker = createForecastBroker();
    assert.equal(typeof broker.ingestFromPlan, 'function');
    assert.equal(typeof broker.getPvForecast, 'function');
    assert.equal(typeof broker.getPvForecast$, 'function');
    assert.equal(typeof broker.getLoadForecast, 'function');
    assert.equal(typeof broker.getLoadForecast$, 'function');
    assert.equal(typeof broker.isForecastStale, 'function');
    assert.equal(typeof broker.destroy, 'function');
    broker.destroy();
  });

  it('ingestFromPlan extracts pvForecastWh from plan.meta and publishes to pvForecast$', () => {
    const broker = createForecastBroker();
    const plan = {
      optimizer: 'eos',
      createdAt: '2026-03-14T10:00:00Z',
      meta: { pvForecastWh: [100, 200, 300] }
    };
    broker.ingestFromPlan(plan);
    const pv = broker.getPvForecast();
    assert.deepEqual(pv.slots, [100, 200, 300]);
    assert.equal(pv.source, 'eos');
    assert.equal(pv.createdAt, '2026-03-14T10:00:00Z');
    broker.destroy();
  });

  it('ingestFromPlan extracts loadForecastWh from plan.meta and publishes to loadForecast$', () => {
    const broker = createForecastBroker();
    const plan = {
      optimizer: 'emhass',
      createdAt: '2026-03-14T11:00:00Z',
      meta: { loadForecastWh: [400, 500, 600] }
    };
    broker.ingestFromPlan(plan);
    const load = broker.getLoadForecast();
    assert.deepEqual(load.slots, [400, 500, 600]);
    assert.equal(load.source, 'emhass');
    assert.equal(load.createdAt, '2026-03-14T11:00:00Z');
    broker.destroy();
  });

  it('getPvForecast() returns null before any plan ingestion', () => {
    const broker = createForecastBroker();
    assert.equal(broker.getPvForecast(), null);
    assert.equal(broker.getLoadForecast(), null);
    broker.destroy();
  });

  it('forecast object includes source, slots array, and createdAt timestamp', () => {
    const broker = createForecastBroker();
    const plan = {
      optimizer: 'eos',
      createdAt: '2026-03-14T12:00:00Z',
      meta: { pvForecastWh: [10, 20], loadForecastWh: [30, 40] }
    };
    broker.ingestFromPlan(plan);

    const pv = broker.getPvForecast();
    assert.ok(pv.source, 'pv forecast should have source');
    assert.ok(Array.isArray(pv.slots), 'pv forecast should have slots array');
    assert.ok(pv.createdAt, 'pv forecast should have createdAt');

    const load = broker.getLoadForecast();
    assert.ok(load.source, 'load forecast should have source');
    assert.ok(Array.isArray(load.slots), 'load forecast should have slots array');
    assert.ok(load.createdAt, 'load forecast should have createdAt');
    broker.destroy();
  });

  it('plans without meta.pvForecastWh do not overwrite existing PV forecast', () => {
    const broker = createForecastBroker();
    // First plan with PV forecast
    broker.ingestFromPlan({
      optimizer: 'eos',
      createdAt: '2026-03-14T10:00:00Z',
      meta: { pvForecastWh: [100, 200] }
    });
    // Second plan without PV forecast
    broker.ingestFromPlan({
      optimizer: 'emhass',
      createdAt: '2026-03-14T11:00:00Z',
      meta: { loadForecastWh: [300, 400] }
    });
    const pv = broker.getPvForecast();
    assert.deepEqual(pv.slots, [100, 200], 'PV forecast should not be overwritten');
    assert.equal(pv.source, 'eos');
    broker.destroy();
  });

  it('plans without meta.loadForecastWh do not overwrite existing load forecast', () => {
    const broker = createForecastBroker();
    // First plan with load forecast
    broker.ingestFromPlan({
      optimizer: 'eos',
      createdAt: '2026-03-14T10:00:00Z',
      meta: { loadForecastWh: [500, 600] }
    });
    // Second plan without load forecast
    broker.ingestFromPlan({
      optimizer: 'emhass',
      createdAt: '2026-03-14T11:00:00Z',
      meta: { pvForecastWh: [700, 800] }
    });
    const load = broker.getLoadForecast();
    assert.deepEqual(load.slots, [500, 600], 'Load forecast should not be overwritten');
    assert.equal(load.source, 'eos');
    broker.destroy();
  });

  it('isForecastStale returns true when forecast.createdAt is older than maxAgeMs', () => {
    const broker = createForecastBroker({ maxStaleMs: 21600000 }); // 6h
    // Forecast from 7 hours ago
    const oldForecast = {
      source: 'eos',
      slots: [100],
      createdAt: new Date(Date.now() - 7 * 3600 * 1000).toISOString()
    };
    assert.equal(broker.isForecastStale(oldForecast), true);

    // Forecast from 1 hour ago
    const freshForecast = {
      source: 'eos',
      slots: [100],
      createdAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString()
    };
    assert.equal(broker.isForecastStale(freshForecast), false);

    // null forecast is stale
    assert.equal(broker.isForecastStale(null), true);
    broker.destroy();
  });

  it('destroy() completes both BehaviorSubjects', () => {
    const broker = createForecastBroker();
    let pvCompleted = false;
    let loadCompleted = false;

    broker.getPvForecast$().subscribe({
      complete: () => { pvCompleted = true; }
    });
    broker.getLoadForecast$().subscribe({
      complete: () => { loadCompleted = true; }
    });

    broker.destroy();
    assert.equal(pvCompleted, true, 'pvForecast$ should be completed');
    assert.equal(loadCompleted, true, 'loadForecast$ should be completed');
  });
});
