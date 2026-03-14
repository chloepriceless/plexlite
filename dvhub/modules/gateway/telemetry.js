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
