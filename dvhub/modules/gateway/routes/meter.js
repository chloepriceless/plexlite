function resolveMaybeFn(value) {
  return typeof value === 'function' ? value() : value;
}

export function registerMeterRoutes(fastify, deps) {
  const {
    getState,
    state,
    fetchEpexDay,
    runMeterScan
  } = deps;

  const resolveState = () => resolveMaybeFn(getState) || state;

  fastify.post('/api/meter/scan', async (request, reply) => {
    const body = request.body || {};
    runMeterScan(body).catch((error) => {
      const currentState = resolveState();
      currentState.scan.running = false;
      currentState.scan.error = error.message;
    });
    return reply.code(200).send({ ok: true, running: true });
  });

  fastify.get('/api/meter/scan', async (request, reply) => {
    return reply.code(200).send(resolveState().scan);
  });

  fastify.post('/api/epex/refresh', async (request, reply) => {
    await fetchEpexDay();
    const currentState = resolveState();
    return reply.code(200).send({ ok: currentState.epex.ok, error: currentState.epex.error });
  });
}
