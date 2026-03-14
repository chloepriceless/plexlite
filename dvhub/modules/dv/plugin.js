/**
 * DV Fastify Plugin
 *
 * Wraps DV route registration as a fastify-plugin for proper
 * encapsulation and module lifecycle integration.
 */

import fp from 'fastify-plugin';
import { createDvRoutes } from './routes/dv-routes.js';

export default fp(async function dvPlugin(fastify, opts) {
  const { state, curtailment, provider } = opts;
  const registerRoutes = createDvRoutes({ state, curtailment, provider });
  registerRoutes(fastify);
}, { name: 'dv-plugin' });
