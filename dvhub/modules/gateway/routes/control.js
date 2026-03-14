function resolveMaybeFn(value) {
  return typeof value === 'function' ? value() : value;
}

export function registerControlRoutes(fastify, deps) {
  const {
    getState,
    state,
    assertValidRuntimeCommand,
    applyControlTarget
  } = deps;

  const resolveState = () => resolveMaybeFn(getState) || state;

  fastify.post('/api/control/write', async (request, reply) => {
    const body = request.body || {};
    const target = String(body.target || '');
    const value = Number(body.value);
    assertValidRuntimeCommand('control_write', { target, value });
    resolveState().schedule.manualOverride[target] = { value, at: Date.now() };
    const result = await applyControlTarget(target, value, 'api_manual_write');
    return reply.code(result.ok ? 200 : 500).send(result);
  });

  // /dv/control-value route has been moved to DV module (dvhub/modules/dv/routes/dv-routes.js)
}
