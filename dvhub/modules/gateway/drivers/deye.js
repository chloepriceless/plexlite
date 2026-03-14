/**
 * Deye driver stub for Device HAL.
 * Interface-only -- requires real hardware for development.
 */

export function createDriver({ transport, profile, config }) {
  function notImplemented() {
    throw new Error('Deye driver not yet implemented - requires real hardware for development');
  }

  return {
    manufacturer: 'deye',
    readMeter: notImplemented,
    writeControl: notImplemented,
    checkHealth: notImplemented
  };
}
