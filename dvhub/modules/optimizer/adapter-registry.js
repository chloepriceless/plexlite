/**
 * Optimizer Adapter Registry
 *
 * Central registry for optimizer adapters (EOS, EMHASS, etc.).
 * Provides registration, discovery, and health-check orchestration.
 *
 * Each adapter must implement:
 *   { name, testedVersions, buildInput, validateResponse, normalizeOutput, healthCheck }
 */

/**
 * Create an adapter registry.
 * @param {object} [options]
 * @param {object} [options.log] - Logger with .warn/.info methods
 * @returns {object} Registry with register, get, getAll, healthCheckAll
 */
export function createAdapterRegistry({ log } = {}) {
  /** @type {Map<string, object>} */
  const adapters = new Map();

  return {
    /**
     * Register an optimizer adapter.
     * @param {object} adapter - Adapter implementing the adapter interface
     * @throws {Error} If adapter is missing required methods
     */
    register(adapter) {
      if (!adapter || !adapter.name) {
        throw new Error('Adapter must have a name');
      }
      const required = ['buildInput', 'validateResponse', 'normalizeOutput', 'healthCheck'];
      for (const method of required) {
        if (typeof adapter[method] !== 'function') {
          throw new Error(`Adapter "${adapter.name}" missing required method: ${method}`);
        }
      }
      adapters.set(adapter.name, adapter);
    },

    /**
     * Get an adapter by name.
     * @param {string} name
     * @returns {object|undefined}
     */
    get(name) {
      return adapters.get(name);
    },

    /**
     * Get all registered adapters.
     * @returns {object[]}
     */
    getAll() {
      return Array.from(adapters.values());
    },

    /**
     * Run health checks on all registered adapters.
     * Logs warning for adapters whose version is not in testedVersions (SEC-03).
     * @returns {Promise<Map<string, {healthy: boolean, version?: string, warning?: string, error?: string}>>}
     */
    async healthCheckAll() {
      const results = new Map();

      for (const [name, adapter] of adapters) {
        try {
          const result = await adapter.healthCheck();
          // SEC-03: Warn on untested versions
          if (result.version && adapter.testedVersions instanceof Set) {
            if (!adapter.testedVersions.has(result.version)) {
              const msg = `Optimizer ${name} version ${result.version} is untested (tested: ${[...adapter.testedVersions].join(', ')})`;
              if (log?.warn) log.warn(msg);
              result.warning = msg;
            }
          }
          results.set(name, result);
        } catch (err) {
          results.set(name, { healthy: false, error: err.message });
        }
      }

      return results;
    }
  };
}
