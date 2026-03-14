/**
 * Staggered Scheduler -- distributes optimizer adapter runs evenly within an interval.
 *
 * Prevents CPU saturation on Pi by ensuring EOS and EMHASS never run concurrently.
 * With 2 adapters and 60min interval: eos at :00, emhass at :30.
 * With 3 adapters and 60min interval: eos at :00, emhass at :20, evcc at :40.
 */

/**
 * @param {object} opts
 * @param {string[]} opts.adapters - Adapter name strings (e.g., ['eos', 'emhass'])
 * @param {Function} opts.triggerFn - Called with adapter name to trigger optimization
 * @param {number} [opts.intervalMs=3600000] - Full interval in milliseconds (default 1h)
 * @param {object} [opts.log] - Pino logger
 * @returns {{ start: Function, stop: Function, _getOffsets: Function }}
 */
export function createStaggeredScheduler({ adapters, triggerFn, intervalMs = 3600000, log }) {
  const staggerMs = adapters.length > 0 ? Math.floor(intervalMs / adapters.length) : intervalMs;
  const timers = [];

  function getOffsets() {
    return adapters.map((adapter, i) => ({
      adapter,
      offset: i * staggerMs,
    }));
  }

  function start() {
    const offsets = getOffsets();
    for (const { adapter, offset } of offsets) {
      // Initial trigger after offset delay
      const initTimer = setTimeout(() => {
        triggerFn(adapter);
        // Then repeat at full interval
        const intervalTimer = setInterval(() => {
          triggerFn(adapter);
        }, intervalMs);
        intervalTimer.unref();
        timers.push(intervalTimer);
      }, offset);
      initTimer.unref();
      timers.push(initTimer);
    }
    log?.info({ adapters, intervalMs, staggerMs }, 'Staggered scheduler started');
  }

  function stop() {
    for (const timer of timers) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    timers.length = 0;
    log?.info('Staggered scheduler stopped');
  }

  return { start, stop, _getOffsets: getOffsets };
}
