/**
 * Optimizer Fastify Plugin
 *
 * Wraps optimizer route registration as a fastify-plugin for proper
 * encapsulation and module lifecycle integration.
 */

import fp from 'fastify-plugin';
import { createOptimizerRoutes } from './routes/optimizer-routes.js';

export default fp(async function optimizerPlugin(fastify, opts) {
  const { planEngine, adapterRegistry, triggerOptimization } = opts;
  const registerRoutes = createOptimizerRoutes({ planEngine, adapterRegistry, triggerOptimization });
  registerRoutes(fastify);
}, { name: 'optimizer-plugin' });
