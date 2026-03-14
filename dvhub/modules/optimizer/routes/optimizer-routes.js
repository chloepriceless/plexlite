/**
 * Optimizer HTTP Route Handlers
 *
 * Provides:
 * - GET  /api/optimizer/plan      (active optimization plan)
 * - GET  /api/optimizer/history   (plan history with optional limit)
 * - GET  /api/optimizer/adapters  (registered adapter names)
 * - POST /api/optimizer/run       (trigger fire-and-forget optimization)
 */

/**
 * Creates a route registration function for optimizer endpoints.
 * @param {object} opts
 * @param {object} opts.planEngine - Plan engine instance
 * @param {object} opts.adapterRegistry - Adapter registry instance
 * @param {Function} opts.triggerOptimization - Fire-and-forget optimization trigger
 * @returns {function} Route registration function (fastify) => void
 */
export function createOptimizerRoutes({ planEngine, adapterRegistry, triggerOptimization }) {
  return function registerRoutes(fastify) {
    // Conditionally apply auth preHandler (skip when fastify.authenticate not decorated)
    const authHook = fastify.authenticate
      ? { preHandler: [fastify.authenticate] }
      : {};

    // GET /api/optimizer/plan -- current active (winning) plan
    fastify.get('/api/optimizer/plan', authHook, async (request, reply) => {
      const active = planEngine.getActivePlan();
      return { active };
    });

    // GET /api/optimizer/history -- plan submission history
    fastify.get('/api/optimizer/history', authHook, async (request, reply) => {
      const limit = Number(request.query.limit) || undefined;
      const plans = planEngine.getHistory({ limit });
      return { plans };
    });

    // GET /api/optimizer/adapters -- registered adapter names
    fastify.get('/api/optimizer/adapters', authHook, async (request, reply) => {
      const adapters = adapterRegistry.getAll().map(a => ({ name: a.name }));
      return { adapters };
    });

    // POST /api/optimizer/run -- trigger optimization (fire-and-forget)
    fastify.post('/api/optimizer/run', authHook, async (request, reply) => {
      const adapterNames = adapterRegistry.getAll().map(a => a.name);
      triggerOptimization(); // fire-and-forget, no await
      return { status: 'triggered', adapters: adapterNames };
    });
  };
}
