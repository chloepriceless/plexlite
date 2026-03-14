/**
 * Module Registry -- lifecycle management for DVhub modules.
 *
 * Manages registration, dependency validation, ordered initialization,
 * and reverse-ordered destruction of modules.
 */

/**
 * Creates a new module registry.
 * @returns {object} Registry with register, initAll, destroyAll, get, getAll, has
 */
export function createModuleRegistry() {
  /** @type {Map<string, object>} */
  const modules = new Map();

  return {
    /**
     * Register a module. Throws if mod.name is missing.
     * @param {object} mod - Module with at least { name, init(), destroy() }
     */
    register(mod) {
      if (!mod || !mod.name) {
        throw new Error('Module must have a name property');
      }
      modules.set(mod.name, mod);
    },

    /**
     * Initialize all modules in registration order.
     * Validates that every mod.requires[] entry is registered before init.
     * @param {object} ctx - Context object passed to each mod.init(ctx)
     */
    async initAll(ctx) {
      // Validate dependencies first
      for (const [name, mod] of modules) {
        if (Array.isArray(mod.requires)) {
          for (const dep of mod.requires) {
            if (!modules.has(dep)) {
              throw new Error(
                `Module "${name}" requires "${dep}" but it is not registered`
              );
            }
          }
        }
      }

      // Initialize in registration (insertion) order
      for (const [, mod] of modules) {
        await mod.init(ctx);
      }
    },

    /**
     * Destroy all modules in reverse registration order.
     * Each destroy is wrapped in try/catch so all modules get destroyed.
     */
    async destroyAll() {
      const entries = [...modules.values()].reverse();
      for (const mod of entries) {
        try {
          await mod.destroy();
        } catch {
          // Continue destroying remaining modules
        }
      }
    },

    /**
     * Get a module by name.
     * @param {string} name
     * @returns {object|undefined}
     */
    get(name) {
      return modules.get(name);
    },

    /**
     * Get all registered modules as an array.
     * @returns {object[]}
     */
    getAll() {
      return [...modules.values()];
    },

    /**
     * Check if a module is registered.
     * @param {string} name
     * @returns {boolean}
     */
    has(name) {
      return modules.has(name);
    }
  };
}
