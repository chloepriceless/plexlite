/**
 * Event Bus -- RxJS BehaviorSubject stream factory and generic event channel.
 *
 * Provides synchronous getValue() reads for DV real-time path
 * and push-based subscriptions via RxJS.
 */

import { BehaviorSubject, Subject, filter } from 'rxjs';

/**
 * Creates a new event bus.
 * @returns {object} Bus with createStream, getStream, getValue, emit, on$, destroy
 */
export function createEventBus() {
  /** @type {Map<string, BehaviorSubject>} */
  const streams = new Map();

  /** @type {Subject} Generic event channel */
  const events = new Subject();

  return {
    /**
     * Create a named BehaviorSubject stream.
     * @param {string} name - Stream identifier
     * @param {*} initialValue - Initial value for the BehaviorSubject
     * @returns {BehaviorSubject}
     */
    createStream(name, initialValue) {
      const subject = new BehaviorSubject(initialValue);
      streams.set(name, subject);
      return subject;
    },

    /**
     * Get a stream by name.
     * @param {string} name
     * @returns {BehaviorSubject|undefined}
     */
    getStream(name) {
      return streams.get(name);
    },

    /**
     * Synchronously read the current value of a named stream.
     * This is the fast path for DV real-time measurement reads.
     * @param {string} name
     * @returns {*} Current value
     * @throws {Error} If stream is not registered
     */
    getValue(name) {
      const stream = streams.get(name);
      if (!stream) {
        throw new Error(`Stream "${name}" not registered`);
      }
      return stream.getValue();
    },

    /**
     * Emit a generic event on the event channel.
     * @param {object} event - Event object with at least { type }
     */
    emit(event) {
      events.next(event);
    },

    /**
     * Subscribe to events of a specific type.
     * @param {string} type - Event type to filter for
     * @returns {Observable}
     */
    on$(type) {
      return events.pipe(filter(e => e.type === type));
    },

    /**
     * Complete all streams and the event channel.
     */
    destroy() {
      for (const [, stream] of streams) {
        stream.complete();
      }
      events.complete();
    }
  };
}
