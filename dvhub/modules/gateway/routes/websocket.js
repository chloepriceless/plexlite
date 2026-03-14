import crypto from 'node:crypto';
import { ROLE_HIERARCHY } from '../../../core/auth.js';

/**
 * Timing-safe token comparison (same as auth.js).
 */
function tokenEquals(provided, expected) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Resolve the role for a given token against the config.
 */
function resolveRole(token, config) {
  if (!config.apiToken) return 'admin';

  if (config.roles && typeof config.roles === 'object') {
    for (const [knownToken, role] of Object.entries(config.roles)) {
      if (tokenEquals(token, knownToken)) return role;
    }
  }

  if (tokenEquals(token, config.apiToken)) {
    return config.roles ? 'user' : 'admin';
  }

  return null; // invalid token
}

/**
 * Register WebSocket routes on a Fastify instance.
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @param {{ config: { apiToken?: string, roles?: Record<string, string> } }} options
 * @returns {{ broadcast: Function, getClientCount: () => number }}
 */
export function registerWebSocketRoutes(fastify, { config }) {
  const clients = new Set();

  fastify.get('/ws', {
    websocket: true,
    preValidation: async (request, reply) => {
      // If no apiToken configured, allow all connections
      if (!config.apiToken) return;

      const token = request.query?.token;
      if (!token) {
        reply.code(401).send({ error: 'Authentication required' });
        return;
      }

      const role = resolveRole(token, config);
      if (!role) {
        reply.code(401).send({ error: 'Invalid token' });
        return;
      }

      // Attach role for the handler to use
      request.wsRole = role;
    }
  }, (socket, request) => {
    const role = request.wsRole || (config.apiToken ? 'user' : 'admin');
    const client = { socket, role };

    clients.add(client);

    socket.on('close', () => {
      clients.delete(client);
    });

    socket.on('error', () => {
      clients.delete(client);
    });
  });

  /**
   * Broadcast data to connected clients, optionally filtered by minimum role.
   *
   * @param {*} data - Data to send (will be JSON.stringify'd if not a string)
   * @param {string} minRole - Minimum role required to receive the message (default: 'readonly')
   */
  function broadcast(data, minRole = 'readonly') {
    const minLevel = ROLE_HIERARCHY[minRole] || 0;
    const message = typeof data === 'string' ? data : JSON.stringify(data);

    for (const client of clients) {
      const clientLevel = ROLE_HIERARCHY[client.role] ?? 0;
      if (clientLevel < minLevel) continue;
      if (client.socket.readyState !== 1) {
        clients.delete(client);
        continue;
      }

      try {
        client.socket.send(message);
      } catch {
        clients.delete(client);
      }
    }
  }

  return { broadcast, getClientCount: () => clients.size };
}
