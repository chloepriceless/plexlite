/**
 * DV HTTP Route Handlers
 *
 * Provides:
 * - GET /dv/control-value  (text/plain, no auth -- LUOX reads this)
 * - GET /api/dv/status     (JSON, auth required)
 * - POST /api/dv/control   (JSON, admin auth required)
 */

/**
 * Creates a route registration function for DV endpoints.
 * @param {object} opts
 * @param {object} opts.state - DV state (from createDvState)
 * @param {object} opts.curtailment - Curtailment manager
 * @param {object} opts.provider - Provider adapter with name
 * @returns {function} Route registration function (fastify) => void
 */
export function createDvRoutes({ state, curtailment, provider }) {
  return function registerRoutes(fastify) {
    // GET /dv/control-value -- no auth, LUOX polls this
    fastify.get('/dv/control-value', async (request, reply) => {
      return reply
        .type('text/plain')
        .send(String(curtailment.controlValue()));
    });

    // GET /api/dv/status -- auth required (readonly role)
    const statusOpts = {};
    if (fastify.authenticate) {
      statusOpts.preHandler = [fastify.authenticate];
    }
    fastify.get('/api/dv/status', statusOpts, async (request, reply) => {
      return {
        enabled: true,
        provider: provider.name,
        controlValue: curtailment.controlValue(),
        dvRegs: { ...state.dvRegs },
        ctrl: { ...state.ctrl },
        keepalive: {
          modbusLastQuery: state.keepalive.modbusLastQuery,
          staleness: state.keepalive.modbusLastQuery
            ? Date.now() - state.keepalive.modbusLastQuery.ts
            : null
        }
      };
    });

    // POST /api/dv/control -- admin auth required
    const controlOpts = {};
    if (fastify.requireRole) {
      controlOpts.preHandler = [fastify.requireRole('admin')];
    } else if (fastify.authenticate) {
      controlOpts.preHandler = [fastify.authenticate];
    }
    fastify.post('/api/dv/control', controlOpts, async (request, reply) => {
      const { action } = request.body || {};

      if (action === 'curtail') {
        curtailment.setForcedOff('api_control_lease');
      } else if (action === 'release') {
        curtailment.clearForcedOff('api_control_lease_clear');
      } else {
        return reply.code(400).send({ error: 'Invalid action. Use "curtail" or "release".' });
      }

      return { ok: true, controlValue: curtailment.controlValue() };
    });
  };
}
