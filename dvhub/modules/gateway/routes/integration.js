function resolveMaybeFn(value) {
  return typeof value === 'function' ? value() : value;
}

export function registerIntegrationRoutes(fastify, deps) {
  const {
    integrationState,
    eosState,
    emhassState,
    applyControlTarget,
    pushLog,
    telemetrySafeWrite,
    buildOptimizerRunPayload,
    getTelemetryStore,
    telemetryStore
  } = deps;

  const resolveTelemetryStore = () => resolveMaybeFn(getTelemetryStore) || telemetryStore;

  fastify.get('/api/integration/home-assistant', async (request, reply) => {
    return reply.code(200).send(integrationState());
  });

  fastify.get('/api/integration/loxone', async (request, reply) => {
    const payload = integrationState();
    const lines = Object.entries(payload).map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`);
    reply.type('text/plain; charset=utf-8');
    return lines.join('\n');
  });

  fastify.get('/api/integration/eos', async (request, reply) => {
    return reply.code(200).send(eosState());
  });

  fastify.post('/api/integration/eos/apply', async (request, reply) => {
    const body = request.body || {};
    const results = [];

    if (body.gridSetpointW !== undefined && Number.isFinite(Number(body.gridSetpointW))) {
      results.push(await applyControlTarget('gridSetpointW', Number(body.gridSetpointW), 'eos_optimization'));
    }
    if (body.chargeCurrentA !== undefined && Number.isFinite(Number(body.chargeCurrentA))) {
      results.push(await applyControlTarget('chargeCurrentA', Number(body.chargeCurrentA), 'eos_optimization'));
    }
    if (body.minSocPct !== undefined && Number.isFinite(Number(body.minSocPct))) {
      results.push(await applyControlTarget('minSocPct', Number(body.minSocPct), 'eos_optimization'));
    }

    pushLog('eos_apply', { targets: results.length, body });
    telemetrySafeWrite(() => resolveTelemetryStore().writeOptimizerRun(buildOptimizerRunPayload({
      optimizer: 'eos',
      body,
      source: 'eos_apply'
    })));

    return reply.code(200).send({ ok: true, results });
  });

  fastify.get('/api/integration/emhass', async (request, reply) => {
    return reply.code(200).send(emhassState());
  });

  fastify.post('/api/integration/emhass/apply', async (request, reply) => {
    const body = request.body || {};
    const results = [];

    if (body.gridSetpointW !== undefined && Number.isFinite(Number(body.gridSetpointW))) {
      results.push(await applyControlTarget('gridSetpointW', Number(body.gridSetpointW), 'emhass_optimization'));
    }
    if (body.chargeCurrentA !== undefined && Number.isFinite(Number(body.chargeCurrentA))) {
      results.push(await applyControlTarget('chargeCurrentA', Number(body.chargeCurrentA), 'emhass_optimization'));
    }
    if (body.minSocPct !== undefined && Number.isFinite(Number(body.minSocPct))) {
      results.push(await applyControlTarget('minSocPct', Number(body.minSocPct), 'emhass_optimization'));
    }

    pushLog('emhass_apply', { targets: results.length, body });
    telemetrySafeWrite(() => resolveTelemetryStore().writeOptimizerRun(buildOptimizerRunPayload({
      optimizer: 'emhass',
      body,
      source: 'emhass_apply'
    })));

    return reply.code(200).send({ ok: true, results });
  });
}
