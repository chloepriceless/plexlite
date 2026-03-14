import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createModuleRegistry } from '../core/module-registry.js';

describe('createModuleRegistry', () => {
  it('register(mod) stores module and getAll() returns it', () => {
    const registry = createModuleRegistry();
    const mod = { name: 'test', async init() {}, async destroy() {} };
    registry.register(mod);
    const all = registry.getAll();
    assert.equal(all.length, 1);
    assert.equal(all[0].name, 'test');
  });

  it('register(mod) throws if mod.name is missing', () => {
    const registry = createModuleRegistry();
    assert.throws(() => registry.register({}), /name/i);
  });

  it('get(name) returns module by name', () => {
    const registry = createModuleRegistry();
    const mod = { name: 'abc', async init() {}, async destroy() {} };
    registry.register(mod);
    assert.equal(registry.get('abc'), mod);
  });

  it('has(name) returns boolean', () => {
    const registry = createModuleRegistry();
    const mod = { name: 'x', async init() {}, async destroy() {} };
    registry.register(mod);
    assert.equal(registry.has('x'), true);
    assert.equal(registry.has('y'), false);
  });

  it('initAll(ctx) calls mod.init(ctx) in registration order', async () => {
    const registry = createModuleRegistry();
    const order = [];
    const modA = { name: 'a', async init(ctx) { order.push('a'); }, async destroy() {} };
    const modB = { name: 'b', async init(ctx) { order.push('b'); }, async destroy() {} };
    registry.register(modA);
    registry.register(modB);
    await registry.initAll({ eventBus: {} });
    assert.deepEqual(order, ['a', 'b']);
  });

  it('destroyAll() calls mod.destroy() in reverse registration order', async () => {
    const registry = createModuleRegistry();
    const order = [];
    const modA = { name: 'a', async init() {}, async destroy() { order.push('a'); } };
    const modB = { name: 'b', async init() {}, async destroy() { order.push('b'); } };
    registry.register(modA);
    registry.register(modB);
    await registry.destroyAll();
    assert.deepEqual(order, ['b', 'a']);
  });

  it('destroyAll() continues even if one module throws', async () => {
    const registry = createModuleRegistry();
    const order = [];
    const modA = { name: 'a', async init() {}, async destroy() { order.push('a'); } };
    const modB = { name: 'b', async init() {}, async destroy() { throw new Error('boom'); } };
    const modC = { name: 'c', async init() {}, async destroy() { order.push('c'); } };
    registry.register(modA);
    registry.register(modB);
    registry.register(modC);
    await registry.destroyAll();
    // reverse order: c, b (throws), a -- both c and a should still run
    assert.deepEqual(order, ['c', 'a']);
  });

  it('initAll throws if module.requires references unregistered module', async () => {
    const registry = createModuleRegistry();
    const mod = { name: 'dv', requires: ['gateway'], async init() {}, async destroy() {} };
    registry.register(mod);
    await assert.rejects(
      () => registry.initAll({}),
      /gateway/i
    );
  });

  it('initAll succeeds if module.requires references registered module', async () => {
    const registry = createModuleRegistry();
    const gw = { name: 'gateway', async init() {}, async destroy() {} };
    const dv = { name: 'dv', requires: ['gateway'], async init() {}, async destroy() {} };
    registry.register(gw);
    registry.register(dv);
    await assert.doesNotReject(() => registry.initAll({}));
  });
});
