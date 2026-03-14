import fp from 'fastify-plugin';
import crypto from 'node:crypto';

export const ROLE_HIERARCHY = { readonly: 0, user: 1, admin: 2 };

export function hasRole(userRole, requiredRole) {
  return (ROLE_HIERARCHY[userRole] ?? -1) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}

/**
 * Timing-safe token comparison.
 * Returns true if `provided` matches `expected`, using constant-time comparison.
 */
function tokenEquals(provided, expected) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Fastify auth plugin.
 *
 * Options:
 *   - apiToken: string | null  -- master token. If null/undefined, open access (all get admin).
 *   - roles: Record<string, 'readonly'|'user'|'admin'> | null  -- token-to-role map.
 */
async function authPlugin(fastify, opts) {
  const { apiToken, roles } = opts;

  fastify.decorateRequest('userRole', null);

  fastify.addHook('preHandler', async (request, reply) => {
    // Open access mode: no apiToken configured
    if (!apiToken) {
      request.userRole = 'admin';
      return;
    }

    // Extract token from Authorization header or query string
    const headerToken = request.headers.authorization?.startsWith('Bearer ')
      ? request.headers.authorization.slice(7)
      : null;
    const token = headerToken || request.query?.token || null;

    if (!token) {
      reply.code(401).send({ error: 'Authentication required' });
      return;
    }

    // Check if token is in the roles map
    if (roles && typeof roles === 'object') {
      const knownTokens = Object.keys(roles);
      for (const knownToken of knownTokens) {
        if (tokenEquals(token, knownToken)) {
          request.userRole = roles[knownToken];
          return;
        }
      }
    }

    // Check against master apiToken
    if (tokenEquals(token, apiToken)) {
      // Token matches apiToken but was not in the roles map
      // Default to 'user' if roles are configured, 'admin' if not
      request.userRole = roles ? 'user' : 'admin';
      return;
    }

    // Invalid token
    reply.code(401).send({ error: 'Invalid token' });
  });
}

export default fp(authPlugin, {
  name: 'dvhub-auth',
  fastify: '5.x'
});
