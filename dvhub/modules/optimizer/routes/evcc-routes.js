/**
 * EVCC API Route Handlers
 *
 * Provides:
 * - GET /api/evcc/state       (full EVCC state from bridge)
 * - GET /api/evcc/loadpoints  (loadpoints array only)
 */

/**
 * Creates a route registration function for EVCC endpoints.
 * @param {object} opts
 * @param {object} opts.evccBridge - EVCC bridge service instance
 * @returns {function} Route registration function (fastify) => void
 */
export function createEvccRoutes({ evccBridge }) {
  return function registerRoutes(fastify) {
    const authHook = fastify.authenticate
      ? { preHandler: [fastify.authenticate] }
      : {};

    // GET /api/evcc/state -- full EVCC state snapshot
    fastify.get('/api/evcc/state', authHook, async () => {
      return { state: evccBridge.getState() };
    });

    // GET /api/evcc/loadpoints -- loadpoints array only
    fastify.get('/api/evcc/loadpoints', authHook, async () => {
      return { loadpoints: evccBridge.getState()?.loadpoints || [] };
    });
  };
}
