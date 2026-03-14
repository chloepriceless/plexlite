function resolveMaybeFn(value) {
  return typeof value === 'function' ? value() : value;
}

export function registerControlRoutes(fastify, deps) {
  const {
    getState,
    state,
    controlValue,
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

  fastify.get('/dv/control-value', async (request, reply) => {
    reply.type('text/plain; charset=utf-8');
    return String(controlValue());
  });
}
