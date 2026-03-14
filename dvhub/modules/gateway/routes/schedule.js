function resolveMaybeFn(value) {
  return typeof value === 'function' ? value() : value;
}

export function registerScheduleRoutes(fastify, deps) {
  const {
    getState,
    state,
    getConfig,
    config,
    getRawConfig,
    rawConfig,
    validateScheduleRule,
    isSmallMarketAutomationRule,
    pushLog,
    persistConfig,
    saveAndApplyConfig,
    regenerateSmallMarketAutomationRules
  } = deps;

  const resolveState = () => resolveMaybeFn(getState) || state;
  const resolveConfig = () => resolveMaybeFn(getConfig) || config;
  const resolveRawConfig = () => resolveMaybeFn(getRawConfig) || rawConfig;

  fastify.get('/api/schedule', async (request, reply) => {
    const currentState = resolveState();
    return reply.code(200).send({
      config: currentState.schedule.config,
      rules: currentState.schedule.rules,
      active: currentState.schedule.active,
      lastWrite: currentState.schedule.lastWrite
    });
  });

  fastify.post('/api/schedule/rules', async (request, reply) => {
    const body = request.body || {};
    if (!Array.isArray(body.rules)) return reply.code(400).send({ ok: false, error: 'rules array required' });
    const validRules = body.rules.filter(validateScheduleRule);
    if (validRules.length !== body.rules.length) return reply.code(400).send({ ok: false, error: 'invalid rule structure' });

    const currentState = resolveState();
    const incomingManualRules = validRules.filter((rule) => !isSmallMarketAutomationRule(rule));
    const existingAutomationRules = currentState.schedule.rules.filter((rule) => isSmallMarketAutomationRule(rule));
    currentState.schedule.rules = [...incomingManualRules, ...existingAutomationRules];
    pushLog('schedule_rules_updated', { manual: incomingManualRules.length, automation: existingAutomationRules.length });
    persistConfig();
    return reply.code(200).send({ ok: true, count: currentState.schedule.rules.length });
  });

  fastify.post('/api/schedule/config', async (request, reply) => {
    const body = request.body || {};
    const currentState = resolveState();

    if (body.defaultGridSetpointW !== undefined) {
      const value = Number(body.defaultGridSetpointW);
      if (!Number.isFinite(value)) return reply.code(400).send({ ok: false, error: 'defaultGridSetpointW invalid' });
      currentState.schedule.config.defaultGridSetpointW = value;
    }

    if (body.defaultChargeCurrentA !== undefined) {
      const value = Number(body.defaultChargeCurrentA);
      if (!Number.isFinite(value)) return reply.code(400).send({ ok: false, error: 'defaultChargeCurrentA invalid' });
      currentState.schedule.config.defaultChargeCurrentA = value;
    }

    pushLog('schedule_config_updated', { config: currentState.schedule.config });
    persistConfig();
    return reply.code(200).send({ ok: true, config: currentState.schedule.config });
  });

  fastify.get('/api/schedule/automation/config', async (request, reply) => {
    return reply.code(200).send({ ok: true, config: resolveConfig().schedule?.smallMarketAutomation || {} });
  });

  fastify.post('/api/schedule/automation/config', async (request, reply) => {
    const body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return reply.code(400).send({ ok: false, error: 'invalid body' });
    }

    const allowedKeys = new Set([
      'enabled',
      'searchWindowStart',
      'searchWindowEnd',
      'targetSlotCount',
      'maxDischargeW',
      'batteryCapacityKwh',
      'inverterEfficiencyPct',
      'minSocPct',
      'aggressivePremiumPct',
      'location',
      'stages'
    ]);
    const filteredBody = Object.fromEntries(
      Object.entries(body).filter(([key]) => allowedKeys.has(key))
    );

    const current = JSON.parse(JSON.stringify(resolveRawConfig() || {}));
    current.schedule = current.schedule || {};
    current.schedule.smallMarketAutomation = {
      ...current.schedule.smallMarketAutomation,
      ...filteredBody
    };
    saveAndApplyConfig(current);
    regenerateSmallMarketAutomationRules();

    return reply.code(200).send({ ok: true, config: resolveConfig().schedule.smallMarketAutomation });
  });
}
