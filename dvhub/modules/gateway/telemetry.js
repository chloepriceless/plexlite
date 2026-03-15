export function createTelemetryStreams(eventBus) {
  const streams = {
    meter$: eventBus.createStream('gateway:meter$', null),
    soc$: eventBus.createStream('gateway:soc$', null),
    gridPower$: eventBus.createStream('gateway:gridPower$', null),
    pvPower$: eventBus.createStream('gateway:pvPower$', null),
    batteryPower$: eventBus.createStream('gateway:batteryPower$', null),
    victron$: eventBus.createStream('gateway:victron$', null),
    schedule$: eventBus.createStream('gateway:schedule$', null),
    epex$: eventBus.createStream('gateway:epex$', null)
  };

  // Aggregate telemetry stream for downstream modules (DV, Optimizer)
  const telemetry$ = eventBus.createStream('telemetry', null);

  function update(snapshot = {}) {
    if (snapshot.meter !== undefined) streams.meter$.next(snapshot.meter);
    if (snapshot.victron !== undefined) streams.victron$.next(snapshot.victron);
    if (snapshot.schedule !== undefined) streams.schedule$.next(snapshot.schedule);
    if (snapshot.epex !== undefined) streams.epex$.next(snapshot.epex);

    const victron = snapshot.victron || null;
    if (victron) {
      streams.soc$.next(victron.soc ?? null);
      streams.pvPower$.next(victron.pvTotalW ?? victron.pvPowerW ?? null);
      streams.batteryPower$.next(victron.batteryPowerW ?? null);
    }

    if (snapshot.meter) {
      streams.gridPower$.next(snapshot.meter.grid_total_w ?? null);
    }

    // Update aggregate telemetry stream for DV + Optimizer consumers
    telemetry$.next({
      meter: streams.meter$.getValue(),
      soc: streams.soc$.getValue(),
      gridPower: streams.gridPower$.getValue(),
      pvPower: streams.pvPower$.getValue(),
      pvTotalW: snapshot.victron?.pvTotalW ?? snapshot.victron?.pvPowerW ?? null,
      batteryPower: streams.batteryPower$.getValue(),
      victron: streams.victron$.getValue(),
      schedule: streams.schedule$.getValue(),
      epex: streams.epex$.getValue(),
      // Fields optimizer expects (from triggerOptimization snapshot)
      loadPowerW: null,
      batteryPowerW: snapshot.victron?.batteryPowerW ?? null,
      gridImportW: snapshot.victron?.gridImportW ?? null,
      gridExportW: snapshot.victron?.gridExportW ?? null,
      gridTotalW: snapshot.meter?.grid_total_w ?? null,
      gridSetpointW: snapshot.victron?.gridSetpointW ?? null,
      minSocPct: snapshot.victron?.minSocPct ?? null,
      selfConsumptionW: snapshot.victron?.selfConsumptionW ?? null,
      // Dashboard live-update fields (INTEG-02)
      costs: snapshot.costs ?? null,
      ctrl: snapshot.ctrl ?? null,
      keepalive: snapshot.keepalive ?? null,
    });
  }

  function getSnapshot() {
    return {
      meter: streams.meter$.getValue(),
      soc: streams.soc$.getValue(),
      gridPower: streams.gridPower$.getValue(),
      pvPower: streams.pvPower$.getValue(),
      batteryPower: streams.batteryPower$.getValue(),
      victron: streams.victron$.getValue(),
      schedule: streams.schedule$.getValue(),
      epex: streams.epex$.getValue()
    };
  }

  return {
    streams,
    update,
    getSnapshot
  };
}
