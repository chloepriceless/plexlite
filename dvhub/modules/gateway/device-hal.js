import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Create a Device Hardware Abstraction Layer instance.
 * Loads manufacturer JSON profile from hersteller/ and creates the appropriate driver.
 *
 * @param {Object} config - Configuration with at least { manufacturer: string }
 * @param {Object} transport - Modbus transport instance with mbRequest/mbWriteSingle
 * @returns {Object} Driver implementing { manufacturer, readMeter, writeControl, checkHealth }
 */
export async function createDeviceHal(config, transport) {
  const manufacturer = config.manufacturer || 'victron';

  // Resolve profile path relative to hersteller/ directory
  const profilePath = join(__dirname, '../../hersteller', manufacturer + '.json');

  let profileData;
  try {
    const raw = await readFile(profilePath, 'utf8');
    profileData = JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Manufacturer profile not found: ${manufacturer}`);
    }
    throw new Error(`Failed to load manufacturer profile '${manufacturer}': ${err.message}`);
  }

  // Dynamic import of the manufacturer driver
  let driverModule;
  try {
    driverModule = await import('./drivers/' + manufacturer + '.js');
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(`Driver not found for manufacturer: ${manufacturer}`);
    }
    throw err;
  }

  return driverModule.createDriver({ transport, profile: profileData, config });
}
