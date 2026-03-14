import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Create a compose-manager for programmatic Docker Compose control.
 *
 * @param {object} opts
 * @param {string} opts.composePath - Path to docker-compose.yaml
 * @param {string} [opts.profile='hybrid'] - Compose profile to use
 * @param {object} [deps] - Optional dependency injection for testing
 * @param {Function} [deps.execFn] - Replacement for promisified execFile
 * @returns {object} Manager with up, down, ps, restart, isHealthy methods
 */
export function createComposeManager({ composePath, profile = 'hybrid' }, { execFn } = {}) {
  const exec = execFn || ((bin, args, opts) => execFileAsync(bin, args, opts));
  const baseArgs = ['compose', '-f', composePath, '--profile', profile];

  async function run(args) {
    const { stdout, stderr } = await exec('docker', [...baseArgs, ...args], {
      timeout: 30_000,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  }

  return {
    async up() {
      return run(['up', '-d', '--wait']);
    },

    async down() {
      return run(['down']);
    },

    async ps() {
      const { stdout } = await run(['ps', '--format', 'json']);
      if (!stdout) return [];
      // docker compose ps --format json outputs one JSON object per line
      return stdout.split('\n').filter(Boolean).map(line => JSON.parse(line));
    },

    async restart(service) {
      return run(['restart', service]);
    },

    async isHealthy(service) {
      try {
        const { stdout } = await run(['ps', service, '--format', 'json']);
        if (!stdout) return false;
        const entries = stdout.split('\n').filter(Boolean).map(l => JSON.parse(l));
        return entries.some(e => (e.Health || e.State || '').toLowerCase().includes('healthy'));
      } catch {
        return false;
      }
    },
  };
}
