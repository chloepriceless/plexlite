/**
 * Tariff and MISPEL API Route Handlers
 *
 * Provides:
 * - GET /api/tariff/current   (current energy price and network charge)
 * - GET /api/tariff/schedule  (price schedule for next N hours in 15-min slots)
 * - GET /api/mispel/status    (MISPEL annual cap status, if enabled)
 */

/**
 * Creates a route registration function for tariff and MISPEL endpoints.
 * @param {object} opts
 * @param {object} opts.tariffEngine - Tariff engine service instance
 * @param {object} [opts.mispelTracker] - MISPEL tracker service instance (optional)
 * @returns {function} Route registration function (fastify) => void
 */
export function createTariffRoutes({ tariffEngine, mispelTracker }) {
  return function registerRoutes(fastify) {
    const authHook = fastify.authenticate
      ? { preHandler: [fastify.authenticate] }
      : {};

    // GET /api/tariff/current -- current energy price
    fastify.get('/api/tariff/current', authHook, async () => {
      const now = new Date();
      return {
        timestamp: now.toISOString(),
        price: tariffEngine.resolvePrice(now),
        networkCharge: tariffEngine.resolveNetworkCharge(now),
      };
    });

    // GET /api/tariff/schedule -- price schedule for next N hours (15-min slots)
    fastify.get('/api/tariff/schedule', authHook, async (request) => {
      const hours = Number(request.query.hours) || 24;
      const now = new Date();
      const slotCount = hours * 4; // 15-min slots per hour
      const slots = [];

      for (let i = 0; i < slotCount; i++) {
        const ts = new Date(now.getTime() + i * 15 * 60 * 1000);
        slots.push({
          timestamp: ts.toISOString(),
          price: tariffEngine.resolvePrice(ts),
          networkCharge: tariffEngine.resolveNetworkCharge(ts),
        });
      }

      return { slots, resolution: '15min' };
    });

    // GET /api/mispel/status -- MISPEL annual cap status
    fastify.get('/api/mispel/status', authHook, async () => {
      if (!mispelTracker?.isEnabled()) {
        return { enabled: false };
      }
      return await mispelTracker.getAnnualStatus(new Date().getFullYear());
    });
  };
}
