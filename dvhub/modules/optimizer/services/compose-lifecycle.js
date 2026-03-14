/**
 * Compose Lifecycle Service -- integrates compose-manager into optimizer module lifecycle.
 *
 * Wraps compose-manager creation, up(), and down() with error swallowing
 * so Docker being unavailable (native mode) does not crash the module.
 */

import { createComposeManager } from '../../../core/compose-manager.js';

/**
 * @param {object} opts
 * @param {string} opts.composePath - Path to docker-compose.yaml
 * @param {string} [opts.profile='hybrid'] - Compose profile to use
 * @param {object} [opts.log] - Pino logger
 * @param {Function} [opts._createManager] - DI override for testing
 * @returns {{ start: Function, stop: Function, getManager: Function }}
 */
export function createComposeLifecycle({ composePath, profile = 'hybrid', log, _createManager }) {
  const factory = _createManager || ((opts) => createComposeManager(opts));
  let manager = null;

  async function start() {
    try {
      manager = factory({ composePath, profile });
      await manager.up();
      log?.info({ composePath, profile }, 'Compose lifecycle started');
    } catch (err) {
      log?.warn({ err: err.message, composePath }, 'Compose lifecycle start failed (non-fatal)');
    }
  }

  async function stop() {
    if (!manager) return;
    try {
      await manager.down();
      log?.info('Compose lifecycle stopped');
    } catch (err) {
      log?.warn({ err: err.message }, 'Compose lifecycle stop failed (non-fatal)');
    }
    manager = null;
  }

  function getManager() {
    return manager;
  }

  return { start, stop, getManager };
}
