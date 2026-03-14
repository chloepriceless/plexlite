/**
 * Victron driver for Device HAL.
 * Wraps existing Modbus transport with register mappings from victron.json profile.
 */

export function createDriver({ transport, profile, config }) {
  const victronConfig = profile.victron || {};
  const host = config.host || '192.168.20.19';
  const port = victronConfig.port || 502;
  const unitId = victronConfig.unitId || 100;
  const timeoutMs = victronConfig.timeoutMs || 1000;
  const points = profile.points || {};
  const controlWrite = profile.controlWrite || {};

  let lastPollTs = 0;

  async function readRegisters(pointDef) {
    if (!pointDef || !pointDef.enabled) return null;
    const regs = await transport.mbRequest({
      host,
      port,
      unitId,
      fc: pointDef.fc || 4,
      address: pointDef.address,
      quantity: pointDef.quantity || 1,
      timeoutMs: pointDef.timeoutMs || timeoutMs
    });
    return regs;
  }

  function decodeRegister(regs, pointDef) {
    if (!regs || regs.length === 0) return 0;
    if (pointDef.sumRegisters) {
      let sum = 0;
      for (const r of regs) {
        let val = r;
        if (pointDef.signed && val > 0x7FFF) val = val - 0x10000;
        sum += val;
      }
      return sum * (pointDef.scale || 1) + (pointDef.offset || 0);
    }
    let val = regs[0];
    if (pointDef.signed && val > 0x7FFF) val = val - 0x10000;
    return val * (pointDef.scale || 1) + (pointDef.offset || 0);
  }

  async function readMeter() {
    const raw = {};
    const reading = {
      power: 0,
      soc: 0,
      gridPower: 0,
      pvPower: 0,
      batteryPower: 0,
      timestamp: 0,
      raw
    };

    // Read meter registers (grid power)
    if (profile.meter) {
      const meterRegs = await transport.mbRequest({
        host, port, unitId,
        fc: profile.meter.fc || 4,
        address: profile.meter.address,
        quantity: profile.meter.quantity || 3,
        timeoutMs: profile.meter.timeoutMs || timeoutMs
      });
      raw.meter = meterRegs;
      // Sum L1+L2+L3 for grid power
      let gridSum = 0;
      for (const r of meterRegs) {
        let v = r;
        if (v > 0x7FFF) v = v - 0x10000;
        gridSum += v;
      }
      reading.gridPower = gridSum;
      reading.power = gridSum;
    }

    // Read individual points
    for (const [name, def] of Object.entries(points)) {
      if (!def.enabled) continue;
      const regs = await readRegisters(def);
      raw[name] = regs;

      const value = decodeRegister(regs, def);
      switch (name) {
        case 'soc': reading.soc = value; break;
        case 'batteryPowerW': reading.batteryPower = value; break;
        case 'pvPowerW': reading.pvPower = value; break;
        case 'selfConsumptionW': raw.selfConsumption = value; break;
      }
    }

    reading.timestamp = Date.now();
    lastPollTs = reading.timestamp;
    return reading;
  }

  async function writeControl(target, value) {
    const controlDef = controlWrite[target];
    if (!controlDef || !controlDef.enabled) {
      throw new Error(`Unknown or disabled control target: ${target}`);
    }

    // Apply scaling: the stored value = value / scale (inverse of read scaling)
    const scaledValue = controlDef.scale ? Math.round(value / controlDef.scale) : value;

    // Convert to uint16 for Modbus write (handle signed values)
    let writeValue = scaledValue;
    if (controlDef.signed && writeValue < 0) {
      writeValue = writeValue & 0xFFFF; // Two's complement for 16-bit
    }

    await transport.mbWriteSingle({
      host, port, unitId,
      address: controlDef.address,
      value: writeValue,
      timeoutMs
    });

    return {
      success: true,
      target,
      value,
      register: controlDef.address
    };
  }

  async function checkHealth() {
    const connected = typeof transport.isConnected === 'function'
      ? transport.isConnected()
      : true;

    return {
      connected,
      lastPollTs: lastPollTs || Date.now(),
      manufacturer: 'victron',
      errors: []
    };
  }

  return {
    manufacturer: 'victron',
    readMeter,
    writeControl,
    checkHealth
  };
}
