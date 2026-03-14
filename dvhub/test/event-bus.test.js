import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createEventBus } from '../core/event-bus.js';

describe('createEventBus', () => {
  it('createStream(name, initialValue) returns BehaviorSubject', () => {
    const bus = createEventBus();
    const stream = bus.createStream('meter', null);
    assert.equal(typeof stream.subscribe, 'function');
    assert.equal(typeof stream.getValue, 'function');
    assert.equal(stream.getValue(), null);
    bus.destroy();
  });

  it('getStream(name) returns the same BehaviorSubject', () => {
    const bus = createEventBus();
    const created = bus.createStream('meter', null);
    const got = bus.getStream('meter');
    assert.equal(created, got);
    bus.destroy();
  });

  it('getStream(name) returns undefined for nonexistent stream', () => {
    const bus = createEventBus();
    assert.equal(bus.getStream('nonexistent'), undefined);
    bus.destroy();
  });

  it('getValue(name) returns current value synchronously after next()', () => {
    const bus = createEventBus();
    const stream = bus.createStream('meter', { watts: 0 });
    stream.next({ watts: 42 });
    assert.deepEqual(bus.getValue('meter'), { watts: 42 });
    bus.destroy();
  });

  it('getValue(nonexistent) throws Error with stream name', () => {
    const bus = createEventBus();
    assert.throws(
      () => bus.getValue('nonexistent'),
      (err) => err instanceof Error && err.message.includes('nonexistent')
    );
    bus.destroy();
  });

  it('emit({type:"test"}) and on$("test") receives the event', (t, done) => {
    const bus = createEventBus();
    const sub = bus.on$('test').subscribe((event) => {
      assert.equal(event.type, 'test');
      assert.equal(event.payload, 'hello');
      sub.unsubscribe();
      bus.destroy();
      done();
    });
    bus.emit({ type: 'test', payload: 'hello' });
  });

  it('on$ filters by type', (t, done) => {
    const bus = createEventBus();
    const received = [];
    const sub = bus.on$('a').subscribe((event) => {
      received.push(event);
      if (received.length === 1) {
        assert.equal(received[0].type, 'a');
        sub.unsubscribe();
        bus.destroy();
        done();
      }
    });
    bus.emit({ type: 'b', payload: 'ignored' });
    bus.emit({ type: 'a', payload: 'caught' });
  });

  it('destroy() completes all streams', () => {
    const bus = createEventBus();
    const stream = bus.createStream('meter', 0);
    let completed = false;
    stream.subscribe({ complete: () => { completed = true; } });
    bus.destroy();
    assert.equal(completed, true);
  });
});
