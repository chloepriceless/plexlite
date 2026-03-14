function resolveMaybeFn(value) {
  return typeof value === 'function' ? value() : value;
}

export function registerHistoryRoutes(fastify, deps) {
  const {
    buildApiHistoryImportStatusResponse,
    getHistoryImportManager,
    historyImportManager,
    getHistoryApi,
    historyApi,
    getConfig,
    config,
    assertValidRuntimeCommand
  } = deps;

  const resolveHistoryImportManager = () => resolveMaybeFn(getHistoryImportManager) || historyImportManager;
  const resolveHistoryApi = () => resolveMaybeFn(getHistoryApi) || historyApi;
  const resolveConfig = () => resolveMaybeFn(getConfig) || config;

  fastify.get('/api/history/import/status', async (request, reply) => {
    return reply.code(200).send(buildApiHistoryImportStatusResponse());
  });

  fastify.post('/api/history/import', async (request, reply) => {
    const importManager = resolveHistoryImportManager();
    if (!importManager) return reply.code(503).send({ ok: false, error: 'internal telemetry store disabled' });

    const body = request.body || {};
    if (body.mode === 'backfill') {
      assertValidRuntimeCommand('history_backfill', { mode: 'gap', requestedBy: 'history_import_endpoint' });
      const result = await importManager.backfillHistoryFromConfiguredSource({ mode: 'gap' });
      return reply.code(result.ok ? 200 : 400).send(result);
    }

    const cfg = resolveConfig();
    const provider = String(body.provider || cfg.telemetry?.historyImport?.provider || 'vrm');
    assertValidRuntimeCommand('history_import', {
      provider,
      requestedFrom: body.requestedFrom ?? body.start ?? null,
      requestedTo: body.requestedTo ?? body.end ?? null,
      interval: body.interval || '15mins'
    });

    const result = Array.isArray(body.rows) && body.rows.length
      ? importManager.importSamples({
        provider,
        requestedFrom: body.requestedFrom ?? null,
        requestedTo: body.requestedTo ?? null,
        sourceAccount: body.sourceAccount ?? null,
        rows: body.rows
      })
      : await importManager.importFromConfiguredSource({
        start: body.requestedFrom ?? body.start,
        end: body.requestedTo ?? body.end,
        interval: body.interval || '15mins'
      });

    return reply.code(result.ok ? 200 : 400).send(result);
  });

  fastify.post('/api/history/backfill/vrm', async (request, reply) => {
    const importManager = resolveHistoryImportManager();
    if (!importManager) return reply.code(503).send({ ok: false, error: 'internal telemetry store disabled' });

    const body = request.body || {};
    const requestedMode = body?.mode === 'full' ? 'full' : 'gap';
    assertValidRuntimeCommand('history_backfill', {
      mode: requestedMode,
      requestedBy: 'history_backfill_endpoint'
    });
    const result = await importManager.backfillHistoryFromConfiguredSource({ ...body, mode: requestedMode });
    return reply.code(result.ok ? 200 : 400).send(result);
  });

  fastify.get('/api/history/summary', async (request, reply) => {
    const api = resolveHistoryApi();
    if (!api || typeof api.getSummary !== 'function') {
      return reply.code(503).send({ ok: false, error: 'internal telemetry store disabled' });
    }

    const query = request.query || {};
    const result = await api.getSummary({
      view: query.view,
      date: query.date
    });
    return reply.code(result.status).send(result.body);
  });

  fastify.post('/api/history/backfill/prices', async (request, reply) => {
    const api = resolveHistoryApi();
    if (!api || typeof api.postPriceBackfill !== 'function') {
      return reply.code(503).send({ ok: false, error: 'internal telemetry store disabled' });
    }

    const body = request.body || {};
    const result = await api.postPriceBackfill(body);
    return reply.code(result.status).send(result.body);
  });
}
