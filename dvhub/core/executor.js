/**
 * Execution Layer
 *
 * Wraps Device HAL writes with command logging, readback verification,
 * and deviation alerting. Every hardware command is logged before execution,
 * and readback confirms the commanded value was applied.
 */

const DEFAULT_CONFIG = {
  readbackEnabled: true,
  readbackDelayMs: 50,
  thresholds: {
    gridSetpointW: 500,
    chargeCurrentA: 2,
    minSocPct: 5
  }
};

/**
 * Maps control targets to their readback meter fields.
 * Targets without a mapping have no readback available.
 */
const READBACK_MAP = {
  gridSetpointW: 'gridPower'
  // chargeCurrentA: no direct readback available
  // minSocPct: 'soc' (SoC changes slowly -- wide tolerance)
  // feedExcessDcPv: no readback
  // dontFeedExcessAcPv: no readback
};

const MAX_COMMAND_LOG = 200;

/**
 * Creates a new executor instance.
 * @param {object} [options]
 * @param {object} options.hal - Device HAL with writeControl and readMeter
 * @param {object} options.db - Database adapter with insertControlEvent
 * @param {object} options.eventBus - Event bus with emit()
 * @param {object} [options.log] - Optional Pino-compatible logger
 * @param {object} [options.config] - Override default config
 * @returns {object} Executor with executeCommand, getConfig, getCommandLog
 */
export function createExecutor({ hal, db, eventBus, log, config: userConfig } = {}) {
  const config = { ...DEFAULT_CONFIG, ...userConfig, thresholds: { ...DEFAULT_CONFIG.thresholds, ...userConfig?.thresholds } };

  /** @type {Array<object>} Recent command results (most recent first) */
  const commandLog = [];

  /**
   * Execute a hardware command with logging and readback verification.
   * @param {object} command - { source, priority, target, value, reason }
   * @returns {Promise<{success: boolean, target: string, value: *, readback: *|null, deviation: number|null, deviationAlert: boolean}>}
   */
  async function executeCommand(command) {
    const { source, priority, target, value, reason } = command;
    const ts = new Date();

    // 1. Log command:sent before HAL write
    if (!db) {
      log?.warn({ source, target, value }, 'No database adapter — skipping command log');
    } else {
      await db.insertControlEvent({
        ts,
        type: 'command:sent',
        source,
        severity: 'info',
        message: `${source} -> ${target} = ${value}`,
        details: { priority, target, value, reason }
      });
    }

    log?.info({ source, target, value, priority }, `command:sent ${source} -> ${target} = ${value}`);

    // 2. Execute HAL write
    if (!hal) {
      throw new Error(`HAL unavailable — cannot write ${target}=${value} (source: ${source})`);
    }
    await hal.writeControl(target, value);

    // 3. Readback verification
    if (config.readbackEnabled && READBACK_MAP[target]) {
      // Wait for register settle time
      if (config.readbackDelayMs > 0) {
        await new Promise(r => setTimeout(r, config.readbackDelayMs));
      }

      const meter = await hal.readMeter();
      const readbackField = READBACK_MAP[target];
      const readback = meter[readbackField];
      const deviation = Math.abs(readback - value);
      const threshold = config.thresholds[target];

      if (threshold != null && deviation > threshold) {
        // Deviation exceeds threshold
        if (!db) { /* warn already logged at entry */ } else {
          await db.insertControlEvent({
            ts: new Date(),
            type: 'command:deviation',
            source,
            severity: 'warn',
            message: `${target} deviation: commanded=${value} readback=${readback} delta=${deviation}`,
            details: { target, commanded: value, readback, deviation, threshold }
          });
        }

        eventBus.emit({
          type: 'exec:deviation',
          target,
          commanded: value,
          readback,
          deviation,
          threshold,
          source,
          timestamp: Date.now()
        });

        log?.warn({ target, commanded: value, readback, deviation, threshold },
          `Deviation alert: ${target} delta=${deviation} exceeds threshold=${threshold}`);

        const result = { success: true, target, value, readback, deviation, deviationAlert: true };
        addToLog(result);
        return result;
      }

      // Within threshold -- verified
      if (!db) { /* warn already logged at entry */ } else {
        await db.insertControlEvent({
          ts: new Date(),
          type: 'command:verified',
          source,
          severity: 'info',
          message: `${target} verified: commanded=${value} readback=${readback} delta=${deviation}`,
          details: { target, commanded: value, readback, deviation }
        });
      }

      log?.info({ target, readback, deviation }, `command:verified ${target}`);

      const result = { success: true, target, value, readback, deviation, deviationAlert: false };
      addToLog(result);
      return result;
    }

    // Readback unavailable for this target
    if (!db) { /* warn already logged at entry */ } else {
      await db.insertControlEvent({
        ts: new Date(),
        type: 'command:executed',
        source,
        severity: 'info',
        message: `readback:unavailable for ${target}`,
        details: { target, value }
      });
    }

    log?.info({ target, value }, `readback:unavailable for ${target}`);

    const result = { success: true, target, value, readback: null, deviation: null, deviationAlert: false };
    addToLog(result);
    return result;
  }

  /**
   * Add a result to the command log (most recent first, capped).
   * @param {object} result
   */
  function addToLog(result) {
    commandLog.unshift(result);
    if (commandLog.length > MAX_COMMAND_LOG) {
      commandLog.length = MAX_COMMAND_LOG;
    }
  }

  /**
   * Get recent command results.
   * @param {number} [limit=50]
   * @returns {Array<object>}
   */
  function getCommandLog(limit = 50) {
    return commandLog.slice(0, limit);
  }

  /**
   * Get current executor configuration.
   * @returns {object}
   */
  function getConfig() {
    return { ...config };
  }

  return { executeCommand, getCommandLog, getConfig };
}
